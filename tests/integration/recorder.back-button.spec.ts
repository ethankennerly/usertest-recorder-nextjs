import { expect, test } from "@playwright/test";
import {
  getObjectKey,
  mockPresignedUpload,
} from "../helpers/mock-upload";

const MOCK_UNITY_LOADER = `
  window.createUnityInstance = function(canvas, config, onProgress) {
    if (onProgress) onProgress(1);
    return Promise.resolve({
      Module: { canvas: canvas },
      Quit: function() { return Promise.resolve(); },
      SendMessage: function() {},
    });
  };
`;

test(
  "back button stops recording and uploads",
  async ({ page }) => {
    const uploads: string[] = [];

    await mockPresignedUpload(page);

    await page.route("**/api/recording-upload", async (route) => {
      uploads.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          key: getObjectKey(),
          target: "mock",
        }),
      });
    });

    await page.route("**/*.loader.js", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: MOCK_UNITY_LOADER,
      });
    });

    await page.goto("/");
    await page.waitForFunction(
      () => window.__recorderTest?.state === "recording",
      null,
      { timeout: 10_000 },
    );
    await page.waitForTimeout(1_200);

    await expect
      .poll(
        async () =>
          page.evaluate(() => window.__recorderTest?.bytes ?? 0),
      )
      .toBeGreaterThan(0);

    await page.locator("[data-testid='game-button']").first().click();
    await page.waitForSelector("[data-testid='unity-player']", {
      timeout: 5_000,
    });

    await page.locator("[data-testid='back-button']").click();

    await page.waitForSelector("[data-testid='game-button']", {
      timeout: 5_000,
    });

    await page.waitForFunction(
      () =>
        (window.__recorderTest?.uploadCount ?? 0) > 0,
      null,
      { timeout: 10_000 },
    );

    const snapshot = await page.evaluate(
      () => window.__recorderTest,
    );
    expect(snapshot?.uploadCount).toBeGreaterThanOrEqual(1);
  },
);
