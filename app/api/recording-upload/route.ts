import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import {
  getObjectKey,
  getS3Bucket,
  getS3Client,
  isMockMode,
} from "../../../lib/s3";

export { getObjectKey } from "../../../lib/s3";

export async function PUT(request: Request) {
  if (isMockMode()) {
    const payload = await request.arrayBuffer();
    const posthogSessionId =
      request.headers.get("x-posthog-session-id") ?? null;
    const ct =
      request.headers.get("content-type") ??
      "application/octet-stream";

    return NextResponse.json({
      ok: true,
      key: getObjectKey(ct),
      target: "mock",
      size: payload.byteLength,
      contentType: ct,
      posthogSessionId,
    });
  }

  const client = getS3Client();
  const contentType = request.headers.get("content-type") || "video/webm";
  const posthogSessionId = request.headers.get("x-posthog-session-id");
  const key = getObjectKey(contentType);
  const body = Buffer.from(await request.arrayBuffer());

  if (body.byteLength === 0) {
    return NextResponse.json(
      { ok: false, error: "Empty recording body. Upload rejected." },
      { status: 400 }
    );
  }

  const EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];
  const isEbml =
    body.byteLength >= 4 &&
    body[0] === EBML_MAGIC[0] &&
    body[1] === EBML_MAGIC[1] &&
    body[2] === EBML_MAGIC[2] &&
    body[3] === EBML_MAGIC[3];

  const isFtyp =
    body.byteLength >= 8 &&
    body[4] === 0x66 &&
    body[5] === 0x74 &&
    body[6] === 0x79 &&
    body[7] === 0x70;

  if (!isEbml && !isFtyp) {
    return NextResponse.json(
      { ok: false, error: "Invalid recording: not WebM or MP4." },
      { status: 400 }
    );
  }

  await client.send(
    new PutObjectCommand({
      Bucket: getS3Bucket(),
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