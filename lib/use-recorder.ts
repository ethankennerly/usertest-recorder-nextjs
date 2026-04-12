"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { getPreferredMimeType } from "./mime-type";
import {
  type RecorderSnapshot,
  MAX_RECORDING_BYTES,
  MAX_RECORDING_MS,
  initialSnapshot,
} from "./recorder-config";
import { log } from "./recorder-log";
import {
  acquireStream,
  checkMediaAvailability,
  createRecorder,
  parseGetUserMediaError,
  setupTrackEndHandlers,
} from "./recorder-media";
import { processStopAndUpload } from "./recorder-upload";
import { useAudioMonitor } from "./use-audio-monitor";
import { useRecorderLifecycle } from "./use-recorder-lifecycle";

export {
  type AudioWarning,
  type RecorderSnapshot,
  type RecorderUiState,
  METER_MAX_DB,
  METER_MIN_DB,
  QUIET_THRESHOLD,
  initialSnapshot,
} from "./recorder-config";

export function useRecorder() {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopReqRef = useRef(false);
  const startTimeRef = useRef(0);
  const genRef = useRef(0);
  const timeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const mountedRef = useRef(true);
  const finalRef = useRef(false);
  const startRef = useRef<() => Promise<void>>(
    async () => {},
  );

  const mime = useMemo(() => {
    const m = getPreferredMimeType();
    if (typeof window !== "undefined")
      log("preferredMimeType:", m || "(default)");
    return m;
  }, []);

  const update = useCallback(
    (fn: (c: RecorderSnapshot) => RecorderSnapshot) => {
      if (mountedRef.current) setSnapshot(fn);
    }, [],
  );

  const { startAudio, stopAudio } =
    useAudioMonitor(update);

  const clearTm = useCallback(() => {
    if (timeoutRef.current === null) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const stop = useCallback(async () => {
    if (stopReqRef.current) return;
    log("stopRecording: requested");
    stopReqRef.current = true;
    clearTm();
    update((c) => ({
      ...c,
      stopCount: c.stopCount + 1,
    }));
    const r = recRef.current;
    if (r && r.state !== "inactive") r.stop();
  }, [update, clearTm]);

  async function onRecorderStop(
    rec: MediaRecorder,
    stream: MediaStream,
  ) {
    try {
      const { blob, upload } =
        await processStopAndUpload(
          chunksRef.current,
          rec.mimeType || mime || "video/webm",
          startTimeRef.current,
        );
      blobRef.current = blob;
      clearTm();
      update((c) => ({
        ...c,
        state: rec.state,
        hasFinalBlob: true,
        blobSize: blob.size,
        ...(upload
          ? {
              uploadCount: c.uploadCount + 1,
              uploadMethod: "PUT",
              uploadContentType: upload.contentType,
              uploadTarget: upload.target,
              uploadKey: upload.key,
              posthogSessionId: upload.posthogSessionId,
            }
          : {}),
      }));
      if (mountedRef.current && !finalRef.current) {
        log("page still open, restarting");
        void startRef.current();
      } else {
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch (error: unknown) {
      update((c) => ({
        ...c,
        state: "error",
        error:
          error instanceof Error
            ? error.message
            : "Failed to finalize upload.",
      }));
    }
  }

  const start = useCallback(async () => {
    try {
      const err = checkMediaAvailability();
      if (err) {
        update((c) => ({
          ...c,
          state: "error",
          error: err,
        }));
        return;
      }
      const gen = ++genRef.current;
      log("startRecording gen", gen);
      const prev = recRef.current;
      if (prev && prev.state !== "inactive") {
        prev.onstop = null;
        prev.ondataavailable = null;
        prev.stop();
      }
      chunksRef.current = [];
      update((c) => ({
        ...c,
        state: "requesting",
        error: null,
      }));

      const stream = await acquireStream(
        streamRef.current,
      );
      if (gen !== genRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      update((c) => ({
        ...c,
        cameraAllowed: stream.getVideoTracks().length > 0,
        microphoneAllowed: stream.getAudioTracks().length > 0,
      }));
      setupTrackEndHandlers(
        stream, () => void stop(),
      );

      const rec = createRecorder(stream, mime);
      streamRef.current = stream;
      recRef.current = rec;
      stopReqRef.current = false;

      timeoutRef.current = setTimeout(() => {
        log("max duration reached, stopping");
        void stop();
      }, MAX_RECORDING_MS);
      startAudio(stream);

      rec.onstart = () =>
        update((c) => ({ ...c, state: rec.state }));
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0)
          chunksRef.current.push(ev.data);
        update((c) => {
          const bytes = c.bytes + ev.data.size;
          if (
            bytes >= MAX_RECORDING_BYTES &&
            rec.state !== "inactive"
          ) {
            void stop();
          }
          return { ...c, state: rec.state, bytes };
        });
      };
      rec.onerror = () =>
        update((c) => ({
          ...c,
          state: "error",
          error: "MediaRecorder reported an error.",
        }));
      rec.onstop = () => {
        stopAudio();
        if (gen !== genRef.current) {
          log(
            "stale onstop, gen:", gen,
            "current:", genRef.current,
          );
          stream.getTracks().forEach(
            (t) => t.stop(),
          );
          return;
        }
        void onRecorderStop(rec, stream);
      };

      rec.start(250);
      startTimeRef.current = Date.now();
      update((c) => ({ ...c, state: rec.state }));
    } catch (error: unknown) {
      const p = parseGetUserMediaError(error);
      update((c) => ({
        ...c,
        state: "error",
        error: p.message,
        cameraAllowed: p.cameraAllowed,
        microphoneAllowed: p.microphoneAllowed,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mime, update, stop, startAudio, stopAudio]);

  startRef.current = start;

  useRecorderLifecycle(
    recRef,
    streamRef,
    start,
    stop,
    stopAudio,
    clearTm,
    mountedRef,
    snapshot,
  );

  const stopFinal = useCallback(async () => {
    finalRef.current = true;
    log("stopFinal: terminal stop");
    await stop();
  }, [stop]);

  return {
    snapshot,
    stopRecording: stop,
    stopFinal,
    startRecording: start,
  };
}
