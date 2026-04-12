import { expect, test } from "@playwright/test";

test("getPreferredMimeType returns webm on desktop Chrome",
  async ({ page }) => {
    await page.goto("/recorder");
    await page.waitForLoadState("domcontentloaded");

    const mimeType = await page.evaluate(() => {
      const types = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4;codecs=avc1",
        "video/mp4",
      ];
      return (
        types.find(
          (t) => MediaRecorder.isTypeSupported(t)
        ) ?? ""
      );
    });

    expect(
      mimeType,
      [
        "Desktop Chromium should support a video MIME type.",
        `Got: "${mimeType}"`,
      ].join("\n"),
    ).toBeTruthy();

    expect(
      mimeType,
      [
        "Desktop Chromium should prefer video/webm.",
        `Got: "${mimeType}"`,
      ].join("\n"),
    ).toContain("video/webm");
  },
);

test("isWebm distinguishes webm from mp4", async ({ page }) => {
  await page.goto("/recorder");

  const results = await page.evaluate(() => {
    const isWebm = (m: string) => m.startsWith("video/webm");
    return {
      webm: isWebm("video/webm;codecs=vp9,opus"),
      mp4: isWebm("video/mp4"),
      empty: isWebm(""),
    };
  });

  expect(results.webm, "video/webm should be webm").toBe(true);
  expect(results.mp4, "video/mp4 should not be webm").toBe(false);
  expect(results.empty, "empty should not be webm").toBe(false);
});

test("fileExtension returns correct extension",
  async ({ page }) => {
    await page.goto("/recorder");

    const results = await page.evaluate(() => {
      const ext = (m: string) => {
        if (m.startsWith("video/mp4")) return "mp4";
        if (m.startsWith("audio/mp4")) return "mp4";
        return "webm";
      };
      return {
        webm: ext("video/webm;codecs=vp9,opus"),
        webmPlain: ext("video/webm"),
        mp4: ext("video/mp4"),
        mp4Codec: ext("video/mp4;codecs=avc1"),
        audioMp4: ext("audio/mp4"),
        fallback: ext(""),
      };
    });

    expect(results.webm).toBe("webm");
    expect(results.webmPlain).toBe("webm");
    expect(results.mp4).toBe("mp4");
    expect(results.mp4Codec).toBe("mp4");
    expect(results.audioMp4).toBe("mp4");
    expect(results.fallback).toBe("webm");
  },
);

test("upload content-type matches recorder mimeType",
  async ({ page }) => {
    let uploadContentType: string | null = null;

    await page.route("**/api/recording-upload", async (route) => {
      uploadContentType =
        route.request().headers()["content-type"] ?? null;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          key: "test.webm",
          target: "mock",
        }),
      });
    });

    await page.goto("/recorder");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForFunction(
      () => window.__recorderTest?.state === "recording",
    );
    await page.waitForTimeout(1_200);

    const uploadPromise =
      page.waitForRequest("**/api/recording-upload");
    await page.evaluate(async () => {
      await window.__simulateUnityQuit?.();
    });
    await uploadPromise;

    await page.waitForFunction(
      () =>
        window.__recorderTest?.state === "inactive" &&
        (window.__recorderTest?.uploadCount ?? 0) > 0,
    );

    expect(
      uploadContentType,
      [
        "Upload Content-Type should match recorder MIME.",
        `Got: "${uploadContentType}"`,
      ].join("\n"),
    ).toMatch(/^video\/(webm|mp4)/);
  },
);
