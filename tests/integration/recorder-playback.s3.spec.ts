// End-to-end S3 playback test:
// Record → Upload to S3 → Download from S3 → Save to disk → Validate with ffprobe.
//
// This automates the manual step:
//   Open browser → Record → Download from S3 → Play → Verify video replays.
//
// Run: npx playwright test --config=playwright.s3.config.ts recorder.s3-playback.spec.ts

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { expect, test } from "@playwright/test";

const execFileAsync = promisify(execFile);

const bucket = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION || "us-east-1";
const liveS3Enabled =
  process.env.RECORDER_UPLOAD_MODE === "s3" &&
  !!bucket &&
  !bucket.includes("placeholder") &&
  !bucket.includes("replace-me");

const EBML_HEADER = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

function countEbmlHeaders(data: Buffer): number {
  let count = 0;
  let pos = 0;
  while (pos <= data.length - 4) {
    if (
      data[pos] === 0x1a &&
      data[pos + 1] === 0x45 &&
      data[pos + 2] === 0xdf &&
      data[pos + 3] === 0xa3
    ) {
      count++;
    }
    pos++;
  }
  return count;
}

test.skip(!liveS3Enabled, "S3 playback test requires RECORDER_UPLOAD_MODE=s3 and AWS_S3_BUCKET.");

test("record → upload to S3 → download → verify playable WebM", async ({ page }) => {
  // Navigate and wait for recording to start
  await page.goto("/recorder");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => window.__recorderTest?.state === "recording",
    null,
    { timeout: 10_000 }
  );

  // Record for 3 seconds to get meaningful video
  await page.waitForTimeout(3_000);

  await expect
    .poll(async () => page.evaluate(() => window.__recorderTest?.bytes ?? 0))
    .toBeGreaterThan(0);

  // Stop recording and wait for upload
  await page.evaluate(async () => {
    await window.__simulateUnityQuit?.();
  });

  await page.waitForFunction(
    () => window.__recorderTest?.state === "inactive",
    null,
    { timeout: 10_000 }
  );

  // Verify it uploaded to S3
  await expect
    .poll(async () => page.evaluate(() => window.__recorderTest?.uploadTarget))
    .toBe("s3");

  const snapshot = await page.evaluate(() => window.__recorderTest);
  const key = snapshot?.uploadKey;
  expect(key, "Expected S3 key from upload").toBeTruthy();
  expect(snapshot?.blobSize ?? 0, "Expected non-zero blob size").toBeGreaterThan(0);

  // Download the file from S3
  const client = new S3Client({ region });
  const getResult = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key! })
  );

  const bodyStream = getResult.Body;
  expect(bodyStream, "Expected S3 object body").toBeTruthy();

  const chunks: Uint8Array[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const chunk of bodyStream as any) {
    chunks.push(chunk as Uint8Array);
  }
  const fileData = Buffer.concat(chunks);

  // Save to disk for inspection
  const outDir = path.join(process.cwd(), "temp", "s3-playback");
  await mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, "downloaded.webm");
  await writeFile(filePath, fileData);

  console.log(`Downloaded ${fileData.length} bytes from s3://${bucket}/${key} → ${filePath}`);

  // --- Validation: the file actually plays ---

  // 1. Exactly one EBML header (no concatenated recordings)
  const ebmlCount = countEbmlHeaders(fileData);
  expect(
    ebmlCount,
    `File has ${ebmlCount} EBML headers — multiple concatenated WebM sessions. ` +
    `Root cause: React Strict Mode double-mount + async getUserMedia race.`
  ).toBe(1);

  // 2. Duration > 0
  const { stdout: durationOut } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-show_entries", "format=duration",
    "-of", "json",
    filePath
  ]);
  const duration = parseFloat(
    (JSON.parse(durationOut) as { format?: { duration?: string } }).format?.duration ?? "0"
  );
  expect(duration, "WebM has no seekable duration — video will not play").toBeGreaterThan(0);

  // 3. More than one video frame
  const { stdout: frameCountOut } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-count_frames",
    "-select_streams", "v:0",
    "-show_entries", "stream=nb_read_frames",
    "-of", "csv=p=0",
    filePath
  ]);
  const frameCount = parseInt(frameCountOut.trim(), 10);
  expect(frameCount, "Recording has only one frame — video will not play").toBeGreaterThan(1);

  // 4. Contains both video and audio codecs
  const { stdout: codecOut } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-show_entries", "stream=codec_name,codec_type",
    "-of", "json",
    filePath
  ]);
  const streams = (JSON.parse(codecOut) as {
    streams?: Array<{ codec_name?: string; codec_type?: string }>;
  }).streams ?? [];
  const codecNames = streams.map((s) => s.codec_name);
  expect(codecNames, "Missing video stream").toContain("vp9");
  expect(codecNames, "Missing audio stream").toContain("opus");

  // 5. Audio must not be silent — mean volume above -50 dB
  const { stderr: volStderr } = await execFileAsync("ffmpeg", [
    "-i", filePath, "-af", "volumedetect", "-f", "null", "/dev/null"
  ]);
  const meanMatch = volStderr.match(/mean_volume:\s*([-\d.]+)/);
  const meanVolume = meanMatch ? parseFloat(meanMatch[1]) : -91;
  expect(
    meanVolume,
    `Audio is silent (mean_volume: ${meanVolume} dB). ` +
    "Check macOS System Settings → Privacy & Security → Microphone → enable browser."
  ).toBeGreaterThan(-50);

  console.log(`Validated: duration=${duration}s, frames=${frameCount}, codecs=${codecNames.join(",")}, ebml=${ebmlCount}, audio=${meanVolume}dB`);
});
