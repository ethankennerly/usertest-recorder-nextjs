"use client";

import { fixWebmDuration } from "@fix-webm-duration/fix";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getPreferredMimeType, isWebm } from "./mime-type";

export type RecorderUiState = RecordingState | "idle" | "requesting" | "error";

export type AudioWarning = "silent" | "quiet" | null;

export type RecorderSnapshot = {
  state: RecorderUiState;
  bytes: number;
  stopCount: number;
  hasFinalBlob: boolean;
  blobSize: number;
  uploadCount: number;
  uploadMethod: string | null;
  uploadContentType: string | null;
  uploadTarget: string | null;
  uploadKey: string | null;
  error: string | null;
  audioLevel: number;
  audioWarning: AudioWarning;
  meterVisible: boolean;
  posthogSessionId: string | null;
  cameraAllowed: boolean | null;
  microphoneAllowed: boolean | null;
};

const TEST_MODE = process.env.NEXT_PUBLIC_RECORDER_TEST_MODE === "true";
const UPLOAD_PATH =
  process.env.NEXT_PUBLIC_RECORDER_UPLOAD_PATH ?? "/api/mock-upload";
const VERBOSE = process.env.NEXT_PUBLIC_RECORDER_VERBOSE === "true";

function log(...args: unknown[]) {
  if (!VERBOSE) return;
  const message = ["[recorder]", ...args]
    .map((a) => (typeof a === "string" ? a : String(a)))
    .join(" ");
  console.log(message);
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/recorder-log",
      new Blob(
        [JSON.stringify({ message })],
        { type: "application/json" },
      ),
    );
  }
}

const SILENT_THRESHOLD_DB = Number(
  process.env.NEXT_PUBLIC_AUDIO_SILENT_DB ?? "-50"
);
const QUIET_THRESHOLD_DB = Number(
  process.env.NEXT_PUBLIC_AUDIO_QUIET_DB ?? "-26"
);
const AUDIO_POLL_MS = 500;
const METER_SHOW_AFTER_QUIET_S = Number(
  process.env.NEXT_PUBLIC_AUDIO_METER_SHOW_AFTER_S ?? "3"
);
export const METER_MIN_DB = -60;
export const METER_MAX_DB = 0;
export const QUIET_THRESHOLD = QUIET_THRESHOLD_DB;
const MAX_RECORDING_BYTES = Number(
  process.env.NEXT_PUBLIC_RECORDER_MAX_BYTES ??
    String(20 * 1024 * 1024),
);
const MAX_RECORDING_MS = Number(
  process.env.NEXT_PUBLIC_RECORDER_MAX_DURATION_MS ?? "20000",
);
const VIDEO_BITRATE = Number(
  process.env.NEXT_PUBLIC_RECORDER_VIDEO_BITS ?? "600000",
);
const AUDIO_BITRATE = Number(
  process.env.NEXT_PUBLIC_RECORDER_AUDIO_BITS ?? "96000",
);

export const initialSnapshot: RecorderSnapshot = {
  state: "idle",
  bytes: 0,
  stopCount: 0,
  hasFinalBlob: false,
  blobSize: 0,
  uploadCount: 0,
  uploadMethod: null,
  uploadContentType: null,
  uploadTarget: null,
  uploadKey: null,
  error: null,
  audioLevel: -Infinity,
  audioWarning: null,
  meterVisible: false,
  posthogSessionId: null,
  cameraAllowed: null,
  microphoneAllowed: null,
};



export function useRecorder() {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopRequestedRef = useRef(false);
  const recordingStartTimeRef = useRef(0);
  const startGenerationRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalBlobRef = useRef<Blob | null>(null);
  const mountedRef = useRef(true);

  const preferredMimeType = useMemo(() => {
    const mime = getPreferredMimeType();
    if (typeof window !== "undefined") {
      log("preferredMimeType:", mime || "(browser default)");
    }
    return mime;
  }, []);

  const updateSnapshot = useCallback(
    (updater: (current: RecorderSnapshot) => RecorderSnapshot) => {
      if (!mountedRef.current) return;
      setSnapshot((current) => updater(current));
    },
    []
  );

  const stopAudioMonitor = useCallback(() => {
    if (audioPollRef.current !== null) {
      clearInterval(audioPollRef.current);
      audioPollRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const clearRecordingTimeout = useCallback(() => {
    if (recordingTimeoutRef.current !== null) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  }, []);

  const setPermissionFlags = useCallback(
    (cameraAllowed: boolean | null, microphoneAllowed: boolean | null) => {
      updateSnapshot((current) => ({
        ...current,
        cameraAllowed,
        microphoneAllowed,
      }));
    },
    [updateSnapshot],
  );

  const startAudioMonitor = useCallback(
    (stream: MediaStream) => {
      stopAudioMonitor();

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        log("no audio track, skipping monitor");
        return;
      }

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const buf = new Float32Array(analyser.fftSize);
      let consecutiveQuietPolls = 0;
      const quietPollsToShow = Math.ceil(
        (METER_SHOW_AFTER_QUIET_S * 1000) / AUDIO_POLL_MS
      );

      audioPollRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buf);

        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          sum += buf[i] * buf[i];
        }
        const rms = Math.sqrt(sum / buf.length);
        const dB = rms > 0 ? 20 * Math.log10(rms) : -Infinity;

        let warning: AudioWarning = null;
        if (dB < SILENT_THRESHOLD_DB) {
          warning = "silent";
        } else if (dB < QUIET_THRESHOLD_DB) {
          warning = "quiet";
        }

        if (warning) {
          consecutiveQuietPolls++;
        } else {
          consecutiveQuietPolls = 0;
        }

        const shouldShow = consecutiveQuietPolls >= quietPollsToShow;

        updateSnapshot((current) => ({
          ...current,
          audioLevel: Math.round(dB),
          audioWarning: warning,
          meterVisible:
            shouldShow || (current.meterVisible && warning !== null),
        }));
      }, AUDIO_POLL_MS);
    },
    [stopAudioMonitor, updateSnapshot]
  );

  const uploadBlob = useCallback(
    async (blob: Blob) => {
      log(
        "uploadBlob: start, size:",
        blob.size,
        "type:",
        blob.type,
      );
      const contentType = blob.type || "video/webm";
      const posthogSessionId =
        posthog.get_session_id() ?? null;
      const params = new URLSearchParams({ contentType });
      if (posthogSessionId) {
        params.set("posthogSessionId", posthogSessionId);
      }

      const presignRes = await fetch(
        `/api/presigned-upload?${params}`,
      );
      if (!presignRes.ok) {
        log(
          "uploadBlob: presign failed, status:",
          presignRes.status,
        );
        throw new Error(
          `Presigned URL failed: ${presignRes.status}`,
        );
      }

      const { url: presignedUrl, key, target } =
        (await presignRes.json()) as {
          url: string | null;
          key: string;
          target: string;
        };

      const headers: Record<string, string> = {
        "Content-Type": contentType,
      };
      let uploadUrl: string;
      if (presignedUrl) {
        uploadUrl = presignedUrl;
        log("uploadBlob: direct S3 upload");
      } else {
        uploadUrl = UPLOAD_PATH;
        if (posthogSessionId) {
          headers["X-PostHog-Session-Id"] = posthogSessionId;
        }
        log("uploadBlob: server proxy", UPLOAD_PATH);
      }

      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers,
        body: blob,
      });

      if (!response.ok) {
        log(
          "uploadBlob: failed, status:",
          response.status,
        );
        if (response.status === 413) {
          throw new Error(
            "Upload failed: recording exceeds server size limit.",
          );
        }
        throw new Error(
          `Upload failed with status ${response.status}`,
        );
      }

      log(
        "uploadBlob: complete, key:",
        key,
        "target:",
        target,
      );
      if (key) {
        posthog.capture(
          "camera_recording_uploaded",
          { s3_key: key },
        );
      }

      updateSnapshot((current) => ({
        ...current,
        uploadCount: current.uploadCount + 1,
        uploadMethod: "PUT",
        uploadContentType: contentType,
        uploadTarget: target ?? UPLOAD_PATH,
        uploadKey: key ?? null,
        posthogSessionId,
      }));
    },
    [updateSnapshot],
  );

  const stopRecording = useCallback(async () => {
    if (stopRequestedRef.current) {
      log("stopRecording: already requested, skipping");
      return;
    }

    log("stopRecording: requested");
    stopRequestedRef.current = true;
    clearRecordingTimeout();
    updateSnapshot((current) => ({
      ...current,
      stopCount: current.stopCount + 1,
    }));

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, [updateSnapshot, clearRecordingTimeout]);

  const startRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        const isInsecure =
          typeof window !== "undefined" &&
          window.location.protocol === "http:" &&
          window.location.hostname !== "localhost" &&
          window.location.hostname !== "127.0.0.1";
        const reason = isInsecure
          ? `Camera requires HTTPS. This page is loaded over HTTP (${window.location.origin}). Use HTTPS or localhost.`
          : "Camera not available in this browser.";
        log(
          "getUserMedia unavailable.",
          "isSecureContext:",
          typeof window !== "undefined" && window.isSecureContext,
          "protocol:",
          typeof window !== "undefined" && window.location.protocol,
          "hostname:",
          typeof window !== "undefined" && window.location.hostname,
          "navigator.mediaDevices:",
          typeof navigator !== "undefined" && !!navigator.mediaDevices,
        );
        updateSnapshot((current) => ({
          ...current,
          state: "error",
          error: reason,
        }));
        return;
      }

      const generation = ++startGenerationRef.current;
      log("startRecording gen", generation);

      const prevRecorder = mediaRecorderRef.current;
      if (prevRecorder && prevRecorder.state !== "inactive") {
        prevRecorder.onstop = null;
        prevRecorder.ondataavailable = null;
        prevRecorder.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      chunksRef.current = [];

      updateSnapshot((current) => ({
        ...current,
        state: "requesting",
        error: null,
      }));

      log("getUserMedia requesting, gen", generation);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      log(
        "getUserMedia resolved, gen",
        generation,
        "current",
        startGenerationRef.current
      );

      if (generation !== startGenerationRef.current) {
        log("stale generation", generation, "discarding stream");
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;
      setPermissionFlags(hasVideo, hasAudio);

      const mediaRecorderOptions: MediaRecorderOptions = {};
      if (preferredMimeType) {
        mediaRecorderOptions.mimeType = preferredMimeType;
      }
      if (VIDEO_BITRATE > 0) {
        mediaRecorderOptions.videoBitsPerSecond = VIDEO_BITRATE;
      }
      if (AUDIO_BITRATE > 0) {
        mediaRecorderOptions.audioBitsPerSecond = AUDIO_BITRATE;
      }

      const recorder = new MediaRecorder(stream, mediaRecorderOptions);
      log(
        "MediaRecorder created, mimeType:",
        recorder.mimeType,
        "tracks:",
        stream.getTracks().map((t) => t.kind).join(","),
      );

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      stopRequestedRef.current = false;

      recordingTimeoutRef.current = setTimeout(() => {
        log("max recording duration reached, stopping");
        void stopRecording();
      }, MAX_RECORDING_MS);

      startAudioMonitor(stream);

      recorder.onstart = () => {
        log("onstart: state:", recorder.state);
        updateSnapshot((current) => ({
          ...current,
          state: recorder.state,
        }));
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }

        updateSnapshot((current) => {
          const bytes = current.bytes + event.data.size;
          if (
            bytes >= MAX_RECORDING_BYTES &&
            recorder.state !== "inactive"
          ) {
            log("max recording size reached, stopping");
            void stopRecording();
          }
          return {
            ...current,
            state: recorder.state,
            bytes,
          };
        });
      };

      recorder.onerror = () => {
        log("onerror: MediaRecorder error");
        updateSnapshot((current) => ({
          ...current,
          state: "error",
          error: "MediaRecorder reported an error.",
        }));
      };

      recorder.onstop = () => {
        log("recorder stopped, chunks:", chunksRef.current.length);
        stopAudioMonitor();
        void (async () => {
          const blobType =
            recorder.mimeType || preferredMimeType || "video/webm";
          const rawBlob = new Blob(chunksRef.current, {
            type: blobType,
          });

          const duration = Date.now() - recordingStartTimeRef.current;
          log(
            "onstop: rawBlob.size:",
            rawBlob.size,
            "duration:",
            duration,
            "ms",
          );
          const blob = isWebm(blobType)
            ? await fixWebmDuration(rawBlob, duration, {
                logger: false,
              })
            : rawBlob;

          finalBlobRef.current = blob;
          clearRecordingTimeout();
          updateSnapshot((current) => ({
            ...current,
            state: recorder.state,
            hasFinalBlob: true,
            blobSize: blob.size,
          }));

          if (blob.size > 0) {
            log("onstop: uploading blob, size:", blob.size);
            await uploadBlob(blob);
          } else {
            log("onstop: blob empty, skipping upload");
          }

          stream.getTracks().forEach((track) => track.stop());
        })().catch((error: unknown) => {
          updateSnapshot((current) => ({
            ...current,
            state: "error",
            error:
              error instanceof Error
                ? error.message
                : "Failed to finalize upload.",
          }));
        });
      };

      recorder.start(250);
      recordingStartTimeRef.current = Date.now();
      log("recorder started, gen", generation);
      updateSnapshot((current) => ({
        ...current,
        state: recorder.state,
      }));
    } catch (error: unknown) {
      let cameraAllowed: boolean | null = null;
      let microphoneAllowed: boolean | null = null;
      let message =
        error instanceof Error
          ? error.message
          : "Failed to start recorder.";

      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError") {
          cameraAllowed = false;
          microphoneAllowed = false;
          message =
            "Camera or microphone permission denied. Allow both to record.";
        }
        if (error.name === "NotFoundError") {
          cameraAllowed = false;
          microphoneAllowed = false;
          message = "No camera or microphone devices found.";
        }
      }

      setPermissionFlags(cameraAllowed, microphoneAllowed);
      updateSnapshot((current) => ({
        ...current,
        state: "error",
        error: message,
      }));
    }
  }, [
    preferredMimeType,
    updateSnapshot,
    uploadBlob,
    startAudioMonitor,
    stopAudioMonitor,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    log("useEffect mount");
    void startRecording();

    return () => {
      mountedRef.current = false;
      log("useEffect cleanup");
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      clearRecordingTimeout();
      stopAudioMonitor();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [startRecording, stopAudioMonitor, clearRecordingTimeout]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        log("beforeunload: stopping recording");
        void stopRecording();
        event.preventDefault();
        event.returnValue = "";
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [stopRecording]);

  useEffect(() => {
    if (!TEST_MODE) {
      return;
    }

    window.__recorderTest = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (!TEST_MODE) {
      return;
    }

    window.__simulateUnityQuit = async () => {
      await stopRecording();
    };

    window.__simulateRemount = async () => {
      await startRecording();
    };

    return () => {
      delete window.__simulateUnityQuit;
      delete window.__recorderTest;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopRecording]);

  return { snapshot, stopRecording, startRecording };
}
