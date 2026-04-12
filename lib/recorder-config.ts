export type RecorderUiState =
  RecordingState | "idle" | "requesting" | "error";

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

export type UploadResult = {
  key: string | null;
  target: string;
  contentType: string;
  posthogSessionId: string | null;
};

export const TEST_MODE =
  process.env.NEXT_PUBLIC_RECORDER_TEST_MODE === "true";

export const UPLOAD_PATH =
  process.env.NEXT_PUBLIC_RECORDER_UPLOAD_PATH ??
  "/api/mock-upload";

export const SILENT_THRESHOLD_DB = Number(
  process.env.NEXT_PUBLIC_AUDIO_SILENT_DB ?? "-50",
);

export const QUIET_THRESHOLD_DB = Number(
  process.env.NEXT_PUBLIC_AUDIO_QUIET_DB ?? "-26",
);

export const AUDIO_POLL_MS = 500;

export const METER_SHOW_AFTER_QUIET_S = Number(
  process.env.NEXT_PUBLIC_AUDIO_METER_SHOW_AFTER_S ?? "3",
);

export const METER_MIN_DB = -60;
export const METER_MAX_DB = 0;
export const QUIET_THRESHOLD = QUIET_THRESHOLD_DB;

export const MAX_RECORDING_BYTES = Number(
  process.env.NEXT_PUBLIC_RECORDER_MAX_BYTES ??
    String(20 * 1024 * 1024),
);

export const MAX_RECORDING_MS = Number(
  process.env.NEXT_PUBLIC_RECORDER_MAX_DURATION_MS ?? "20000",
);

export const VIDEO_BITRATE = Number(
  process.env.NEXT_PUBLIC_RECORDER_VIDEO_BITS ?? "600000",
);

export const AUDIO_BITRATE = Number(
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
