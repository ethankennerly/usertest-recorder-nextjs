// Reproduce-bug script: launches a real headed Chromium (with fake device
// for determinism), records for 5 seconds, intercepts the upload blob,
// saves it, and validates it with ffprobe.
//
// Usage: npx playwright test temp/reproduce-bug.spec.ts --config=playwright.config.ts --headed

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { expect, test } from "@playwright/test";

const execFileAsync = promisify(execFile);

test("real browser recording produces a playable WebM", async ({ page }) => {
  let uploadData: Buffer | null = null;

  await page.route("**/api/recording-upload", async (route) => {
    const request = route.request();
    uploadData = request.postDataBuffer();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, key: "mock/repro.webm", target: "mock" })
    });
  });

  await page.goto("/recorder");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => window.__recorderTest?.state === "recording", null, { timeout: 10_000 });

  // Record for 5 seconds — enough for a multi-cluster WebM
  await page.waitForTimeout(5_000);

  const uploadPromise = page.waitForRequest("**/api/recording-upload");
  await page.evaluate(async () => {
    await window.__simulateUnityQuit?.();
  });
  await uploadPromise;
  await page.waitForFunction(() => window.__recorderTest?.state === "inactive");

  expect(uploadData).not.toBeNull();

  const outDir = path.join(process.cwd(), "temp", "reproduce-bug");
  await mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, "recording.webm");
  await writeFile(filePath, uploadData!);

  console.log(`Saved ${uploadData!.length} bytes to ${filePath}`);

  // Validate with ffprobe: count video frames and check duration > 0
  const { stdout: frameCountOut } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-count_frames",
    "-select_streams", "v:0",
    "-show_entries", "stream=nb_read_frames",
    "-of", "csv=p=0",
    filePath
  ]);
  const frameCount = parseInt(frameCountOut.trim(), 10);

  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-show_entries", "format=duration:stream=codec_name,codec_type",
    "-of", "json",
    filePath
  ]);

  const probeResult = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{ codec_name?: string; codec_type?: string }>;
  };

  const duration = parseFloat(probeResult.format?.duration ?? "0");

  // The recording must have more than one video frame
  expect(frameCount, "Recording has only one frame — video will not play").toBeGreaterThan(1);

  // The recording must have a valid duration (not N/A, not 0)
  expect(duration, "WebM has no seekable duration — video will not play").toBeGreaterThan(0);

  // Must contain both video and audio streams
  const codecNames = (probeResult.streams ?? []).map((s) => s.codec_name);
  expect(codecNames, "Missing video stream").toContain("vp9");
  expect(codecNames, "Missing audio stream").toContain("opus");
});
