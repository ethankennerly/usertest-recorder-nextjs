import { expect, test } from "@playwright/test";
import { mockPresignedUpload } from "../helpers/mock-upload";

test(
  "restart reuses stream without new getUserMedia",
  async ({ page }) => {
    await mockPresignedUpload(page);

    await page.addInitScript(() => {
      const w = window as unknown as
        Record<string, unknown>;
      w.__getUserMediaCallCount = 0;
      const orig =
        navigator.mediaDevices.getUserMedia
          .bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia =
        async (...args) => {
          (w.__getUserMediaCallCount as number)++;
          return orig(...args);
        };
    });

    await page.goto("/recorder");
    await page.waitForFunction(
      () =>
        window.__recorderTest?.state === "recording",
    );
    await page.waitForTimeout(1_200);

    const callsBefore = await page.evaluate(() =>
      (window as unknown as Record<string, number>)
        .__getUserMediaCallCount ?? 0,
    );

    await page.evaluate(async () => {
      await window.__simulateUnityQuit?.();
    });

    await page.waitForFunction(
      () =>
        (window.__recorderTest?.uploadCount ?? 0)
          >= 1,
      null,
      { timeout: 10_000 },
    );

    await page.waitForFunction(
      () =>
        window.__recorderTest?.state === "recording",
      null,
      { timeout: 10_000 },
    );

    const callsAfter = await page.evaluate(() =>
      (window as unknown as Record<string, number>)
        .__getUserMediaCallCount ?? 0,
    );
    expect(
      callsAfter,
      [
        "Restart must reuse the existing stream",
        "to avoid iPhone permission toasts.",
        `getUserMedia was called ${callsAfter}`,
        `times total (${callsBefore} before stop).`,
      ].join(" "),
    ).toBe(callsBefore);
  },
);
