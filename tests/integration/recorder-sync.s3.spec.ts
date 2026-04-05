// Sync all recordings from S3 to temp/recordings/.
//
// Automates: aws s3 sync s3://$AWS_S3_BUCKET/$AWS_S3_RECORDINGS_PREFIX/ temp/recordings/
//
// Run: npx playwright test --config=playwright.s3.config.ts recorder-sync.s3.spec.ts

import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client
} from "@aws-sdk/client-s3";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const bucket = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION || "us-east-1";
const prefix = process.env.AWS_S3_RECORDINGS_PREFIX || "recordings";
const liveS3Enabled =
  !!bucket &&
  !bucket.includes("placeholder") &&
  !bucket.includes("replace-me");

test.skip(
  !liveS3Enabled,
  "S3 sync requires a real AWS_S3_BUCKET."
);

test("sync all S3 recordings to temp/recordings/", async () => {
  const client = new S3Client({ region });
  const outDir = path.join(process.cwd(), "temp", "recordings");

  let continuationToken: string | undefined;
  let totalFiles = 0;
  let totalBytes = 0;
  let skipped = 0;

  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${prefix}/`,
        ContinuationToken: continuationToken
      })
    );

    for (const obj of list.Contents ?? []) {
      if (!obj.Key || obj.Key.endsWith("/")) continue;

      const relativePath = obj.Key.slice(prefix.length + 1);
      const filePath = path.join(outDir, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });

      // Skip files that already exist locally with the same size.
      try {
        const localStat = await stat(filePath);
        if (obj.Size !== undefined && localStat.size === obj.Size) {
          skipped++;
          continue;
        }
      } catch {
        // File doesn't exist locally — download it.
      }

      const get = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: obj.Key })
      );

      const chunks: Uint8Array[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const chunk of get.Body as any) {
        chunks.push(chunk as Uint8Array);
      }
      const data = Buffer.concat(chunks);
      await writeFile(filePath, data);
      totalFiles++;
      totalBytes += data.length;

      console.log(`  ${obj.Key} → ${filePath} (${data.length} bytes)`);
    }

    continuationToken = list.NextContinuationToken;
  } while (continuationToken);

  console.log(
    `Synced ${totalFiles} new files (${(totalBytes / 1024 / 1024).toFixed(1)} MB), skipped ${skipped} existing, from s3://${bucket}/${prefix}/ → ${outDir}/`
  );
  expect(
    totalFiles + skipped,
    "Expected at least one recording in S3"
  ).toBeGreaterThan(0);
});
