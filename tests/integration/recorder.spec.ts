import { expect, test, type Page } from "@playwright/test";

async function openRecorderPage(page: Page) {
  await page.goto("/recorder");
  await page.waitForLoadState("domcontentloaded");
  await expect(page).toHaveURL(/\/recorder$/);
}

test("auto-starts recording on page load", async ({ page }) => {
  await openRecorderPage(page);

  await page.waitForFunction(() => window.__recorderTest?.state === "recording");

  const snapshot = await page.evaluate(() => window.__recorderTest);

  expect(snapshot?.state).toBe("recording");
  expect(snapshot?.stopCount).toBe(0);

  await page.evaluate(async () => {
    await window.__simulateUnityQuit?.();
  });

  await page.waitForFunction(() => window.__recorderTest?.state === "inactive");
});

test("stops recording on Unity quit and uploads once", async ({ page }) => {
  const uploads: Array<{ method: string; contentType: string | undefined }> = [];

  await page.route("**/api/mock-upload", async (route) => {
    const request = route.request();

    uploads.push({
      method: request.method(),
      contentType: request.headers()["content-type"]
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true })
    });
  });

  await openRecorderPage(page);
  await page.waitForFunction(() => window.__recorderTest?.state === "recording");
  await page.waitForTimeout(1_200);

  await expect
    .poll(async () => page.evaluate(() => window.__recorderTest?.bytes ?? 0))
    .toBeGreaterThan(0);

  await page.evaluate(async () => {
    await window.__simulateUnityQuit?.();
  });

  await page.waitForFunction(() => window.__recorderTest?.state === "inactive");
  await expect.poll(() => uploads.length).toBe(1);

  const snapshot = await page.evaluate(() => window.__recorderTest);

  expect(snapshot?.state).toBe("inactive");
  expect(snapshot?.bytes ?? 0).toBeGreaterThan(0);
  expect(snapshot?.stopCount).toBe(1);
  expect(snapshot?.hasFinalBlob).toBe(true);
  expect(snapshot?.blobSize ?? 0).toBeGreaterThan(0);
  expect(snapshot?.uploadCount).toBe(1);
  expect(uploads[0]?.method).toBe("PUT");
  expect(uploads[0]?.contentType ?? "").toContain("video/webm");
});
