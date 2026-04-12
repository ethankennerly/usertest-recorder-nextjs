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

  if (body.byteLength === 0) {
    return NextResponse.json(
      { ok: false, error: "Empty recording body. Upload rejected." },
      { status: 400 }
    );
  }

  // Validate EBML magic bytes: a valid WebM file starts with 0x1A45DFA3.
  // A truncated upload (e.g. tab closed mid-fetch) may deliver non-zero but
  // corrupted bytes that would otherwise be stored to S3.
  const EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];
  if (
    body.byteLength < EBML_MAGIC.length ||
    body[0] !== EBML_MAGIC[0] ||
    body[1] !== EBML_MAGIC[1] ||
    body[2] !== EBML_MAGIC[2] ||
    body[3] !== EBML_MAGIC[3]
  ) {
    return NextResponse.json(
      { ok: false, error: "Invalid WebM: missing EBML header." },
      { status: 400 }
    );
  }

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