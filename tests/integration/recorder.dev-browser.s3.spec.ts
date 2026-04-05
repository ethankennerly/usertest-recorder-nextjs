import { readFileSync } from "node:fs";
import path from "node:path";

import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { expect, test } from "@playwright/test";

const bucket = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION || "us-east-1";
const liveS3Enabled =
  process.env.RECORDER_UPLOAD_MODE === "s3" &&
  !!bucket &&
  !bucket.includes("placeholder") &&
  !bucket.includes("replace-me");

test.skip(!liveS3Enabled, "Live S3 browser verification requires RECORDER_UPLOAD_MODE=s3 and AWS_S3_BUCKET.");

function getPrefixCauseSnippet() {
  const envLine = readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
    .split("\n")
    .find((line) => line.startsWith("AWS_S3_RECORDINGS_PREFIX="));

  const routeLines = readFileSync(
    path.join(process.cwd(), "app/api/recording-upload/route.ts"),
    "utf8"
  ).split("\n");
  const start = routeLines.findIndex((line) => line.includes("function getObjectKey()"));
  const routeSnippet = routeLines.slice(start, start + 4).join("\n");

  return [envLine ?? "AWS_S3_RECORDINGS_PREFIX=<missing>", routeSnippet].join("\n");
}

test("clicking Simulate Unity Quit uploads the browser recording to S3", async ({ page }) => {
  await page.goto("/recorder");
  await page.waitForLoadState("domcontentloaded");

  await page.waitForFunction(() => window.__recorderTest?.state === "recording");
  await page.waitForTimeout(1_200);

  await expect
    .poll(async () => page.evaluate(() => window.__recorderTest?.bytes ?? 0))
    .toBeGreaterThan(0);

  await page.getByRole("button", { name: "Simulate Unity Quit" }).click();

  await page.waitForFunction(() => window.__recorderTest?.state === "inactive");
  await expect
    .poll(async () => page.evaluate(() => window.__recorderTest?.uploadTarget))
    .toBe("s3");

  const snapshot = await page.evaluate(() => window.__recorderTest);

  expect(snapshot?.uploadCount).toBe(1);
  expect(snapshot?.blobSize ?? 0).toBeGreaterThan(0);
  expect(snapshot?.uploadKey).toBeTruthy();

  const key = snapshot?.uploadKey;
  if (!key) {
    throw new Error("Expected an S3 upload key after clicking Simulate Unity Quit.");
  }

  const expectedConsolePrefix = `recordings/${new Date().toISOString().slice(0, 10)}/`;

  expect(
    key,
    [
      "Repro steps:",
      "1. Run `npm run dev`.",
      "2. Open `/recorder` in a browser.",
      "3. Click `Simulate Unity Quit`.",
      "4. Look in the S3 console prefix `recordings/<today>/`.",
      "",
      `Observed uploadKey=${key}`,
      `Expected console-visible prefix=${expectedConsolePrefix}`,
      "The upload succeeded, but not under the prefix shown in the provided S3 console URL.",
      "",
      "Isolated cause within 5 lines of code:",
      getPrefixCauseSnippet()
    ].join("\n")
  ).toMatch(new RegExp(`^${expectedConsolePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));

  const client = new S3Client({ region });
  const head = await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );

  expect(head.ContentLength ?? 0).toBeGreaterThan(0);
});