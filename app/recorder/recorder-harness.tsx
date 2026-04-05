"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RecorderUiState = RecordingState | "idle" | "requesting" | "error";

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
};

const TEST_MODE = process.env.NEXT_PUBLIC_RECORDER_TEST_MODE === "true";
const UPLOAD_PATH =
  process.env.NEXT_PUBLIC_RECORDER_UPLOAD_PATH ?? "/api/mock-upload";

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
  error: null
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

export function RecorderHarness() {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopRequestedRef = useRef(false);

  const preferredMimeType = useMemo(() => getPreferredMimeType(), []);

  const updateSnapshot = useCallback(
    (updater: (current: RecorderSnapshot) => RecorderSnapshot) => {
      setSnapshot((current) => updater(current));
    },
    []
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
      updateSnapshot((current) => ({
        ...current,
        state: "requesting",
        error: null
      }));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      stopRequestedRef.current = false;

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
        void (async () => {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || preferredMimeType || "video/webm"
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
  }, [preferredMimeType, updateSnapshot, uploadBlob]);

  useEffect(() => {
    void startRecording();

    return () => {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [startRecording]);

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
      {snapshot.error ? <p className="error-text">{snapshot.error}</p> : null}
      <div>
        <button className="button" onClick={() => void stopRecording()} type="button">
          Simulate Unity Quit
        </button>
      </div>
    </section>
  );
}
