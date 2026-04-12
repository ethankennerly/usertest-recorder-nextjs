import posthog from "posthog-js";

import { log } from "./recorder-log";
import { type UploadResult, UPLOAD_PATH } from "./recorder-config";
import { buildFinalBlob } from "./recorder-media";

export async function processStopAndUpload(
  chunks: Blob[],
  mimeType: string,
  startTime: number,
): Promise<{ blob: Blob; upload: UploadResult | null }> {
  const blob = await buildFinalBlob(
    chunks,
    mimeType,
    startTime,
  );
  if (blob.size === 0) {
    log("blob empty, skipping upload");
    return { blob, upload: null };
  }
  log("uploading blob, size:", blob.size);
  const upload = await uploadBlob(blob);
  return { blob, upload };
}

export async function uploadBlob(
  blob: Blob,
): Promise<UploadResult> {
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

  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: "PUT",
      headers,
      body: blob,
    });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_err) {
    log("uploadBlob: network error (likely CORS)");
    throw new Error(
      "Upload network error (check S3 CORS).",
    );
  }

  if (!response.ok) {
    log("uploadBlob: failed, status:", response.status);
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

  return {
    key: key ?? null,
    target: target ?? UPLOAD_PATH,
    contentType,
    posthogSessionId,
  };
}
