import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

function getS3Client() {
  const region = process.env.AWS_REGION;

  if (!region) {
    throw new Error("AWS_REGION is required for recording uploads.");
  }

  const endpoint = process.env.AWS_S3_ENDPOINT || undefined;
  const forcePathStyle = process.env.AWS_S3_FORCE_PATH_STYLE === "true";

  return new S3Client({
    region,
    endpoint,
    forcePathStyle
  });
}

export function getObjectKey() {
  const prefix = process.env.AWS_S3_RECORDINGS_PREFIX || "recordings";
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  return `${prefix}/${date}/${date}T${time}_${randomUUID()}.webm`;
}

export async function PUT(request: Request) {
  const bucket = process.env.AWS_S3_BUCKET;

  if (!bucket || bucket.includes("replace-me") || bucket.includes("placeholder")) {
    const payload = await request.arrayBuffer();
    const posthogSessionId = request.headers.get("x-posthog-session-id") ?? null;

    return NextResponse.json({
      ok: true,
      key: getObjectKey(),
      target: "mock",
      size: payload.byteLength,
      contentType:
        request.headers.get("content-type") ?? "application/octet-stream",
      posthogSessionId,
    });
  }

  const client = getS3Client();
  const contentType = request.headers.get("content-type") || "video/webm";
  const posthogSessionId = request.headers.get("x-posthog-session-id");
  const key = getObjectKey();
  const body = Buffer.from(await request.arrayBuffer());

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: posthogSessionId
        ? { "posthog-session-id": posthogSessionId }
        : undefined,
    })
  );

  return NextResponse.json({
    ok: true,
    key,
    target: "s3",
    size: body.byteLength,
    contentType
  });
}