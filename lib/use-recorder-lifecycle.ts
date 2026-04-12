"use client";

import { useEffect } from "react";

import type { RecorderSnapshot } from "./recorder-config";
import { TEST_MODE } from "./recorder-config";
import { log } from "./recorder-log";

export function useRecorderLifecycle(
  recRef: React.RefObject<MediaRecorder | null>,
  streamRef: React.RefObject<MediaStream | null>,
  start: () => Promise<void>,
  stop: () => Promise<void>,
  stopAudio: () => void,
  clearTm: () => void,
  mountedRef: React.MutableRefObject<boolean>,
  snapshot: RecorderSnapshot,
) {
  useEffect(() => {
    mountedRef.current = true;
    const rec = recRef.current;
    const stream = streamRef.current;
    void start();
    return () => {
      mountedRef.current = false;
      if (rec && rec.state !== "inactive") rec.stop();
      clearTm();
      stopAudio();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [
    start,
    stopAudio,
    clearTm,
    mountedRef,
    recRef,
    streamRef,
  ]);

  useEffect(() => {
    const onHide = () => {
      const r = recRef.current;
      if (r && r.state !== "inactive") {
        log("pagehide: stopping");
        void stop();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      const r = recRef.current;
      if (r && r.state !== "inactive") {
        log("beforeunload: stopping");
        void stop();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener(
        "beforeunload",
        onUnload,
      );
    };
  }, [stop, recRef]);

  useEffect(() => {
    if (!TEST_MODE) return;
    window.__recorderTest = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (!TEST_MODE) return;
    window.__simulateUnityQuit = () => stop();
    window.__simulateRemount = () => start();
    return () => {
      delete window.__simulateUnityQuit;
      delete window.__recorderTest;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop]);
}
