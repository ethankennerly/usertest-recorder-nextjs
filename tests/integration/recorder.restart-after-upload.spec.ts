import { expect, test } from "@playwright/test";
import { mockPresignedUpload } from "../helpers/mock-upload";

test(
  "restarts recording after upload completes",
  async ({ page }) => {
    let uploadCount = 0;

    await mockPresignedUpload(page);

    await page.route(
      "**/api/recording-upload",
      async (route) => {
        uploadCount++;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            key: `recordings/test-${uploadCount}.webm`,
            target: "mock",
          }),
        });
      },
    );

    await page.goto("/recorder");
    await page.waitForFunction(
      () =>
        window.__recorderTest?.state === "recording",
    );
    await page.waitForTimeout(1_200);

    await page.evaluate(async () => {
      await window.__simulateUnityQuit?.();
    });

    await page.waitForFunction(
      () =>
        (window.__recorderTest?.uploadCount ?? 0) >= 1,
      null,
      { timeout: 10_000 },
    );

    await page.waitForFunction(
      () =>
        window.__recorderTest?.state === "recording",
      null,
      { timeout: 10_000 },
    );

    const snapshot = await page.evaluate(
      () => window.__recorderTest,
    );
    expect(
      snapshot?.state,
      [
        "After upload, recorder must restart",
        "if the browser page is still open.",
      ].join(" "),
    ).toBe("recording");
    expect(snapshot?.uploadCount).toBe(1);
  },
);
