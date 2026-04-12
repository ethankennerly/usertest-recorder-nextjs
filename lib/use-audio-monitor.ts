"use client";

import {
  useCallback,
  useRef,
} from "react";

import type {
  AudioWarning,
  RecorderSnapshot,
} from "./recorder-config";
import {
  AUDIO_POLL_MS,
  METER_SHOW_AFTER_QUIET_S,
} from "./recorder-config";
import { log } from "./recorder-log";
import {
  classifyAudioWarning,
  computeAudioLevel,
} from "./recorder-media";

type Updater = (
  fn: (c: RecorderSnapshot) => RecorderSnapshot,
) => void;

export function useAudioMonitor(update: Updater) {
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pollRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAudio = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const startAudio = useCallback(
    (stream: MediaStream) => {
      stopAudio();
      const track = stream.getAudioTracks()[0];
      if (!track) {
        log("no audio track, skipping monitor");
        return;
      }
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      src.connect(an);
      ctxRef.current = ctx;
      analyserRef.current = an;

      const buf = new Float32Array(an.fftSize);
      let quietPolls = 0;
      const threshold = Math.ceil(
        (METER_SHOW_AFTER_QUIET_S * 1000) /
          AUDIO_POLL_MS,
      );

      pollRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buf);
        const dB = computeAudioLevel(buf);
        const warning: AudioWarning =
          classifyAudioWarning(dB);
        if (warning) quietPolls++;
        else quietPolls = 0;
        const show = quietPolls >= threshold;
        update((c) => ({
          ...c,
          audioLevel: Math.round(dB),
          audioWarning: warning,
          meterVisible:
            show ||
            (c.meterVisible && warning !== null),
        }));
      }, AUDIO_POLL_MS);
    },
    [stopAudio, update],
  );

  return { startAudio, stopAudio };
}
