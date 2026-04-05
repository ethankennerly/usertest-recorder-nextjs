"use client";

import { fixWebmDuration } from "@fix-webm-duration/fix";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RecorderUiState = RecordingState | "idle" | "requesting" | "error";

type AudioWarning = "silent" | "quiet" | null;

type RecorderSnapshot = {
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

/**
 * Audio level thresholds (dBFS, tunable via env vars).
 *
 * Professional reference (ITU-T P.56 active speech level):
 * - Conversational speech at a laptop mic: roughly -20 to -30 dBFS
 * - Quiet room ambient noise floor: roughly -45 to -55 dBFS
 * - Dead/blocked mic (digital silence): below -70 dBFS
 *
 * SILENT_THRESHOLD: below this the mic is dead or OS-level blocked.
 * QUIET_THRESHOLD: below this the user's voice cannot be distinguished
 *   from ambient noise. Set to -26 dBFS by default — the bottom of the
 *   conversational speech range.
 */
const SILENT_THRESHOLD_DB = Number(
  process.env.NEXT_PUBLIC_AUDIO_SILENT_DB ?? "-50"
);
const QUIET_THRESHOLD_DB = Number(
  process.env.NEXT_PUBLIC_AUDIO_QUIET_DB ?? "-26"
);
/** How often (ms) to sample the audio level. */
const AUDIO_POLL_MS = 500;
/** Seconds of consecutive quiet/silent polls before the meter auto-shows. */
const METER_SHOW_AFTER_QUIET_S = Number(
  process.env.NEXT_PUBLIC_AUDIO_METER_SHOW_AFTER_S ?? "3"
);
/** Min/max dB range for the visual meter bar. */
const METER_MIN_DB = -60;
const METER_MAX_DB = 0;

const initialSnapshot: RecorderSnapshot = {
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
  meterVisible: false
};

function getPreferredMimeType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "";
  }

  const mimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  return (
    mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? ""
  );
}

function AudioMeter({
  level,
  warning,
  visible
}: {
  level: number;
  warning: AudioWarning;
  visible: boolean;
}) {
  const clampedDb = Math.max(METER_MIN_DB, Math.min(METER_MAX_DB, level));
  const pct = ((clampedDb - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB)) * 100;
  const thresholdPct =
    ((QUIET_THRESHOLD_DB - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB)) * 100;
  const emoji = warning ? "🔇" : "🎙️";

  return (
    <div
      className={`audio-meter ${visible ? "audio-meter--visible" : ""}`}
      data-testid="audio-meter"
      data-warning={warning}
      role="meter"
      aria-valuenow={level}
      aria-valuemin={METER_MIN_DB}
      aria-valuemax={METER_MAX_DB}
      aria-label="Microphone audio level"
    >
      <span className="audio-meter__icon" aria-hidden="true">
        {emoji}
      </span>
      <div className="audio-meter__track">
        <div
          className="audio-meter__threshold"
          style={{ left: `${thresholdPct}%` }}
        />
        <div
          className={`audio-meter__fill ${
            warning === "silent"
              ? "audio-meter__fill--silent"
              : warning === "quiet"
                ? "audio-meter__fill--quiet"
                : "audio-meter__fill--ok"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function RecorderHarness() {
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
          meterVisible: shouldShow || (current.meterVisible && warning !== null)
        }));
      }, AUDIO_POLL_MS);
    },
    [stopAudioMonitor, updateSnapshot]
  );

  const uploadBlob = useCallback(
    async (blob: Blob) => {
      const contentType = blob.type || "video/webm";
      const response = await fetch(UPLOAD_PATH, {
        method: "PUT",
        headers: {
          "Content-Type": contentType
        },
        body: blob
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        key?: string;
        target?: string;
      };

      updateSnapshot((current) => ({
        ...current,
        uploadCount: current.uploadCount + 1,
        uploadMethod: "PUT",
        uploadContentType: contentType,
        uploadTarget: payload.target ?? UPLOAD_PATH,
        uploadKey: payload.key ?? null
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
      stopCount: current.stopCount + 1
    }));

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, [updateSnapshot]);

  const startRecording = useCallback(async () => {
    try {
      // Increment generation so any in-flight getUserMedia from a previous
      // mount will detect it is stale and bail out after resolving.
      const generation = ++startGenerationRef.current;
      log("startRecording gen", generation);

      // Stop any existing recorder from a previous mount to prevent
      // two concurrent recordings sharing the same chunksRef.
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
        error: null
      }));

      log("getUserMedia requesting, gen", generation);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      log("getUserMedia resolved, gen", generation, "current", startGenerationRef.current);

      // After the async getUserMedia, check if a newer startRecording call
      // has superseded this one (React Strict Mode double-mount race).
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
          state: recorder.state
        }));
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }

        updateSnapshot((current) => ({
          ...current,
          state: recorder.state,
          bytes: current.bytes + event.data.size
        }));
      };

      recorder.onerror = () => {
        updateSnapshot((current) => ({
          ...current,
          state: "error",
          error: "MediaRecorder reported an error."
        }));
      };

      recorder.onstop = () => {
        log("recorder stopped, chunks:", chunksRef.current.length);
        stopAudioMonitor();
        void (async () => {
          const rawBlob = new Blob(chunksRef.current, {
            type: recorder.mimeType || preferredMimeType || "video/webm"
          });

          const duration = Date.now() - recordingStartTimeRef.current;
          const blob = await fixWebmDuration(rawBlob, duration, {
            logger: false
          });

          updateSnapshot((current) => ({
            ...current,
            state: recorder.state,
            hasFinalBlob: true,
            blobSize: blob.size
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
              error instanceof Error ? error.message : "Failed to finalize upload."
          }));
        });
      };

      recorder.start(250);
      recordingStartTimeRef.current = Date.now();
      log("recorder started, gen", generation);
      updateSnapshot((current) => ({
        ...current,
        state: recorder.state
      }));
    } catch (error: unknown) {
      updateSnapshot((current) => ({
        ...current,
        state: "error",
        error:
          error instanceof Error ? error.message : "Failed to start recorder."
      }));
    }
  }, [preferredMimeType, updateSnapshot, uploadBlob, startAudioMonitor, stopAudioMonitor]);

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
  }, [stopRecording]);

  return (
    <section className="card grid">
      <div className="grid">
        <span className="kicker">Integration Harness</span>
        <div className="status-pill" data-testid="recorder-state">
          Recorder state: {snapshot.state}
        </div>
        <p>
          The recorder starts on page load and stops when the test triggers the
          Unity quit bridge.
        </p>
      </div>
      <ul className="metric-list">
        <li>
          <span className="metric-label">Recorded bytes</span>
          <span className="metric-value" data-testid="recorded-bytes">
            {snapshot.bytes}
          </span>
        </li>
        <li>
          <span className="metric-label">Final blob ready</span>
          <span className="metric-value" data-testid="blob-ready">
            {snapshot.hasFinalBlob ? "yes" : "no"}
          </span>
        </li>
        <li>
          <span className="metric-label">Final blob size</span>
          <span className="metric-value" data-testid="blob-size">
            {snapshot.blobSize}
          </span>
        </li>
        <li>
          <span className="metric-label">Stop count</span>
          <span className="metric-value" data-testid="stop-count">
            {snapshot.stopCount}
          </span>
        </li>
        <li>
          <span className="metric-label">Upload count</span>
          <span className="metric-value" data-testid="upload-count">
            {snapshot.uploadCount}
          </span>
        </li>
        <li>
          <span className="metric-label">Upload target</span>
          <span className="metric-value" data-testid="upload-target">
            {snapshot.uploadTarget ?? "pending"}
          </span>
        </li>
      </ul>
      {snapshot.state === "recording" ? (
        <AudioMeter
          level={snapshot.audioLevel}
          warning={snapshot.audioWarning}
          visible={snapshot.meterVisible}
        />
      ) : null}
      {snapshot.error ? <p className="error-text">{snapshot.error}</p> : null}
      <div>
        <button className="button" onClick={() => void stopRecording()} type="button">
          Simulate Unity Quit
        </button>
      </div>
    </section>
  );
}
