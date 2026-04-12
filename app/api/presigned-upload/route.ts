import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

import {
  getObjectKey,
  getS3Bucket,
  getS3Client,
  isMockMode,
} from "../../../lib/s3";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contentType =
    searchParams.get("contentType") || "video/webm";
  const posthogSessionId =
    searchParams.get("posthogSessionId") || undefined;
  const key = getObjectKey(contentType);

  if (isMockMode()) {
    return NextResponse.json({
      url: null,
      key,
      target: "mock",
    });
  }

  const client = getS3Client();
  const bucket = getS3Bucket();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    Metadata: posthogSessionId
      ? { "posthog-session-id": posthogSessionId }
      : undefined,
  });

  const url = await getSignedUrl(client, command, {
    expiresIn: 300,
  });

  return NextResponse.json({ url, key, target: "s3" });
}
