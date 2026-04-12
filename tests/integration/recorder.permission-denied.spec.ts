import { expect, test } from "@playwright/test";

test("shows camera and microphone permission errors when getUserMedia is denied", async ({ page }) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const error = new DOMException(
        "Permission denied",
        "NotAllowedError",
      );
      throw error;
    };
    Object.defineProperty(window, "__originalGetUserMedia", {
      value: original,
      configurable: true,
    });
  });

  await page.goto("/recorder");
  await page.waitForSelector("[data-testid='camera-permission']");
  await expect(page.locator("[data-testid='camera-permission']")).toHaveText(
    "Camera is NOT recording.",
  );
  await expect(page.locator("[data-testid='microphone-permission']")).toHaveText(
    "Microphone is NOT recording.",
  );
  await expect(page.locator("[data-testid='recorder-state']")).toContainText(
    "error",
  );
});
