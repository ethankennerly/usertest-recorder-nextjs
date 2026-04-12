import { S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

export function getS3Client() {
  const region = process.env.AWS_REGION;

  if (!region) {
    throw new Error(
      "AWS_REGION is required for recording uploads.",
    );
  }

  const endpoint = process.env.AWS_S3_ENDPOINT || undefined;
  const forcePathStyle =
    process.env.AWS_S3_FORCE_PATH_STYLE === "true";

  return new S3Client({
    region,
    endpoint,
    forcePathStyle,
  });
}

export function getObjectKey(contentType = "video/webm") {
  const prefix =
    process.env.AWS_S3_RECORDINGS_PREFIX || "recordings";
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now
    .toISOString()
    .slice(11, 19)
    .replace(/:/g, "");
  const ext = contentType.startsWith("video/mp4")
    ? "mp4"
    : "webm";
  return (
    `${prefix}/${date}/${date}T${time}_${randomUUID()}.${ext}`
  );
}

export function getS3Bucket() {
  return process.env.AWS_S3_BUCKET ?? "";
}

export function isMockMode() {
  const bucket = getS3Bucket();
  return (
    !bucket ||
    bucket.includes("replace-me") ||
    bucket.includes("placeholder")
  );
}
