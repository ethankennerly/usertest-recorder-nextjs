import { expect, test } from "@playwright/test";
import { getObjectKey } from "../../app/api/recording-upload/route";

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

test("uploaded recording contains exactly one WebM session", async ({ page }) => {
  // Inject 500ms latency into getUserMedia to simulate real camera hardware.
  // With fake devices getUserMedia resolves instantly, hiding the race.
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return original(constraints);
    };
  });

  let uploadData: Buffer | null = null;

  await page.route("**/api/recording-upload", async (route) => {
    const request = route.request();
    uploadData = request.postDataBuffer();

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        key: getObjectKey(),
        target: "mock"
      })
    });
  });

  // Navigate triggers useEffect → startRecording() → getUserMedia (delayed).
  // React Strict Mode in dev will unmount and remount, calling startRecording
  // again while the first getUserMedia is still in-flight.
  // The generation counter in startRecording must discard the stale call.
  await page.goto("/recorder");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => window.__recorderTest?.state === "recording",
    null,
    { timeout: 10_000 }
  );

  // Also call simulateRemount to force an extra concurrent startRecording
  // even if Strict Mode didn't trigger (e.g., production build).
  // With the 500ms getUserMedia delay, this races with the ongoing call.
  await page.evaluate(() => {
    void window.__simulateRemount?.();
  });

  // Wait for recording data to accumulate
  await page.waitForTimeout(2_000);

  const uploadRequestPromise = page.waitForRequest("**/api/recording-upload");
  await page.evaluate(async () => {
    await window.__simulateUnityQuit?.();
  });
  await uploadRequestPromise;

  await page.waitForFunction(() => window.__recorderTest?.state === "inactive");

  expect(uploadData, "Expected upload payload to be captured").not.toBeNull();

  const header = uploadData!.slice(0, 4);
  expect(header).toEqual(EBML_HEADER);

  const ebmlCount = countEbmlHeaders(uploadData!);
  expect(
    ebmlCount,
    [
      "BUG: Multiple WebM sessions concatenated in one file.",
      "",
      "Root cause: React Strict Mode double-mount + async getUserMedia race.",
      "Mount 1 calls startRecording() → getUserMedia (takes 200-500ms on real camera).",
      "Cleanup runs → remount calls startRecording() again → ref is still null.",
      "Both getUserMedia calls resolve → two MediaRecorders share chunksRef.",
      "",
      "Fix: generation counter in startRecording. After getUserMedia resolves,",
      "check if the generation is still current. If not, stop stream and bail.",
      "",
      `Observed EBML headers: ${ebmlCount} (expected 1)`,
      `Observed upload size: ${uploadData!.length} bytes`
    ].join("\n")
  ).toBe(1);
});
