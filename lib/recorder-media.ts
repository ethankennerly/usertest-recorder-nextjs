import type { AudioWarning } from "./recorder-config";
import {
  AUDIO_BITRATE,
  QUIET_THRESHOLD_DB,
  SILENT_THRESHOLD_DB,
  VIDEO_BITRATE,
} from "./recorder-config";
import { fixWebmDuration } from "@fix-webm-duration/fix";
import { isWebm } from "./mime-type";
import { log } from "./recorder-log";

export function computeAudioLevel(
  buf: Float32Array,
): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    sum += buf[i] * buf[i];
  }
  const rms = Math.sqrt(sum / buf.length);
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

export function classifyAudioWarning(
  dB: number,
): AudioWarning {
  if (dB < SILENT_THRESHOLD_DB) return "silent";
  if (dB < QUIET_THRESHOLD_DB) return "quiet";
  return null;
}

export function checkMediaAvailability():
  string | null {
  const hasGetUserMedia =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia ===
      "function";
  if (hasGetUserMedia) return null;

  const isInsecure =
    typeof window !== "undefined" &&
    window.location.protocol === "http:" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  return isInsecure
    ? `Camera requires HTTPS. This page is loaded over HTTP (${window.location.origin}). Use HTTPS or localhost.`
    : "Camera not available in this browser.";
}

export function parseGetUserMediaError(error: unknown): {
  message: string;
  cameraAllowed: boolean | null;
  microphoneAllowed: boolean | null;
} {
  let message =
    error instanceof Error
      ? error.message
      : "Failed to start recorder.";
  let cameraAllowed: boolean | null = null;
  let microphoneAllowed: boolean | null = null;

  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      cameraAllowed = false;
      microphoneAllowed = false;
      message =
        "Camera or microphone permission denied." +
        " Allow both to record.";
    }
    if (error.name === "NotFoundError") {
      cameraAllowed = false;
      microphoneAllowed = false;
      message =
        "No camera or microphone devices found.";
    }
  }

  return { message, cameraAllowed, microphoneAllowed };
}

export function isStreamAlive(
  stream: MediaStream | null,
): boolean {
  if (!stream) return false;
  return stream.getTracks().every(
    (t) => t.readyState === "live",
  );
}

export async function acquireStream(
  current: MediaStream | null,
): Promise<MediaStream> {
  if (isStreamAlive(current)) {
    log("reusing existing stream");
    return current!;
  }
  current?.getTracks().forEach((t) => t.stop());
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: true,
  });
}

export function createRecorder(
  stream: MediaStream,
  mime: string | null,
): MediaRecorder {
  const opts: MediaRecorderOptions = {};
  if (mime) opts.mimeType = mime;
  if (VIDEO_BITRATE > 0)
    opts.videoBitsPerSecond = VIDEO_BITRATE;
  if (AUDIO_BITRATE > 0)
    opts.audioBitsPerSecond = AUDIO_BITRATE;
  return new MediaRecorder(stream, opts);
}

export function setupTrackEndHandlers(
  stream: MediaStream,
  onEnd: () => void,
): void {
  stream.getTracks().forEach((t) => {
    t.onended = () => {
      log("track ended:", t.kind);
      onEnd();
    };
  });
}

export async function buildFinalBlob(
  chunks: Blob[],
  mimeType: string,
  startTime: number,
): Promise<Blob> {
  const blobType = mimeType || "video/webm";
  const raw = new Blob(chunks, { type: blobType });
  const dur = Date.now() - startTime;
  log(
    "buildFinalBlob:",
    raw.size, "bytes",
    dur, "ms",
    chunks.length, "chunks",
  );
  if (isWebm(blobType)) {
    return fixWebmDuration(raw, dur, { logger: false });
  }
  return raw;
}

