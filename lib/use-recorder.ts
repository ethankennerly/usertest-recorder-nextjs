"use client";

import { fixWebmDuration } from "@fix-webm-duration/fix";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
};

const TEST_MODE = process.env.NEXT_PUBLIC_RECORDER_TEST_MODE === "true";
const UPLOAD_PATH =
  process.env.NEXT_PUBLIC_RECORDER_UPLOAD_PATH ?? "/api/mock-upload";
const VERBOSE = process.env.NEXT_PUBLIC_RECORDER_VERBOSE === "true";

function log(...args: unknown[]) {
  if (VERBOSE) {
    console.log("[recorder]", ...args);
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
};

function getPreferredMimeType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "";
  }

  const mimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  return (
    mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? ""
  );
}

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

  const preferredMimeType = useMemo(() => getPreferredMimeType(), []);

  const updateSnapshot = useCallback(
    (updater: (current: RecorderSnapshot) => RecorderSnapshot) => {
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
      const contentType = blob.type || "video/webm";
      const posthogSessionId = posthog.get_session_id() ?? null;
      const headers: Record<string, string> = { "Content-Type": contentType };
      if (posthogSessionId) {
        headers["X-PostHog-Session-Id"] = posthogSessionId;
      }
      const response = await fetch(UPLOAD_PATH, {
        method: "PUT",
        headers,
        body: blob,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        key?: string;
        target?: string;
      };

      if (payload.key) {
        posthog.capture("camera_recording_uploaded", { s3_key: payload.key });
      }

      updateSnapshot((current) => ({
        ...current,
        uploadCount: current.uploadCount + 1,
        uploadMethod: "PUT",
        uploadContentType: contentType,
        uploadTarget: payload.target ?? UPLOAD_PATH,
        uploadKey: payload.key ?? null,
        posthogSessionId,
      }));
    },
    [updateSnapshot]
  );

  const stopRecording = useCallback(async () => {
    if (stopRequestedRef.current) {
      return;
    }

    stopRequestedRef.current = true;
    updateSnapshot((current) => ({
      ...current,
      stopCount: current.stopCount + 1,
    }));

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, [updateSnapshot]);

  const startRecording = useCallback(async () => {
    try {
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
        video: true,
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

      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      stopRequestedRef.current = false;

      startAudioMonitor(stream);

      recorder.onstart = () => {
        updateSnapshot((current) => ({
          ...current,
          state: recorder.state,
        }));
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }

        updateSnapshot((current) => ({
          ...current,
          state: recorder.state,
          bytes: current.bytes + event.data.size,
        }));
      };

      recorder.onerror = () => {
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
          const rawBlob = new Blob(chunksRef.current, {
            type: recorder.mimeType || preferredMimeType || "video/webm",
          });

          const duration = Date.now() - recordingStartTimeRef.current;
          const blob = await fixWebmDuration(rawBlob, duration, {
            logger: false,
          });

          updateSnapshot((current) => ({
            ...current,
            state: recorder.state,
            hasFinalBlob: true,
            blobSize: blob.size,
          }));

          if (blob.size > 0) {
            await uploadBlob(blob);
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
      updateSnapshot((current) => ({
        ...current,
        state: "error",
        error:
          error instanceof Error
            ? error.message
            : "Failed to start recorder.",
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
    log("useEffect mount");
    void startRecording();

    return () => {
      log("useEffect cleanup");
      stopAudioMonitor();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [startRecording, stopAudioMonitor]);

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
