import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { expect, test } from "@playwright/test";

const bucket = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION || "us-east-1";
const liveS3Enabled =
  process.env.RECORDER_UPLOAD_MODE === "s3" &&
  !!bucket &&
  !bucket.includes("placeholder") &&
  !bucket.includes("replace-me");

test.skip(!liveS3Enabled, "Live S3 verification requires RECORDER_UPLOAD_MODE=s3 and AWS_S3_BUCKET.");

test("uploads the recorder blob to S3 and keeps it private", async ({ page }) => {
  await page.goto("/recorder");
  await page.waitForLoadState("domcontentloaded");

  await page.waitForFunction(() => window.__recorderTest?.state === "recording");
  await page.waitForTimeout(1_200);

  await expect
    .poll(async () => page.evaluate(() => window.__recorderTest?.bytes ?? 0))
    .toBeGreaterThan(0);

  await page.evaluate(async () => {
    await window.__simulateUnityQuit?.();
  });

  await page.waitForFunction(() => window.__recorderTest?.state === "inactive");
  await expect
    .poll(async () => page.evaluate(() => window.__recorderTest?.uploadTarget))
    .toBe("s3");

  const snapshot = await page.evaluate(() => window.__recorderTest);

  expect(snapshot?.uploadKey).toBeTruthy();
  expect(snapshot?.blobSize ?? 0).toBeGreaterThan(0);

  const key = snapshot?.uploadKey;
  if (!key) {
    throw new Error("Expected recorder upload key to be available for S3 verification.");
  }

  const client = new S3Client({ region });
  const head = await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );

  expect(head.ContentLength ?? 0).toBeGreaterThan(0);

  const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  const response = await fetch(publicUrl);

  expect(response.ok).toBe(false);
  expect([403, 404]).toContain(response.status);
});