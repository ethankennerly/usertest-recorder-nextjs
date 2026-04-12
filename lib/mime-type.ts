const VIDEO_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4;codecs=avc1",
  "video/mp4",
];

export function getPreferredMimeType(): string {
  if (
    typeof window === "undefined" ||
    typeof MediaRecorder === "undefined"
  ) {
    return "";
  }

  return (
    VIDEO_MIME_TYPES.find((t) =>
      MediaRecorder.isTypeSupported(t)
    ) ?? ""
  );
}

export function isWebm(mimeType: string): boolean {
  return mimeType.startsWith("video/webm");
}

export function fileExtension(mimeType: string): string {
  if (mimeType.startsWith("video/mp4")) return "mp4";
  if (mimeType.startsWith("audio/mp4")) return "mp4";
  return "webm";
}
