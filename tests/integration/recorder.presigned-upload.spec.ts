import { expect, test } from "@playwright/test";

test(
  "upload uses presigned URL, not server proxy",
  async ({ page }) => {
    let presignedFetched = false;
    let directUploadUrl: string | null = null;

    await page.route(
      "**/api/presigned-upload*",
      async (route) => {
        presignedFetched = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            url: "https://mock-s3.test/recording.webm",
            key: "recordings/test.webm",
            target: "s3",
          }),
        });
      },
    );

    await page.route(
      "https://mock-s3.test/**",
      async (route) => {
        directUploadUrl = route.request().url();
        expect(
          route.request().method(),
          "S3 presigned upload must use PUT",
        ).toBe("PUT");
        await route.fulfill({ status: 200 });
      },
    );

    await page.goto("/recorder");
    await page.waitForFunction(
      () => window.__recorderTest?.state === "recording",
    );
    await page.waitForTimeout(1_200);

    await page.evaluate(async () => {
      await window.__simulateUnityQuit?.();
    });

    await page.waitForFunction(
      () =>
        window.__recorderTest?.state === "inactive" &&
        (window.__recorderTest?.uploadCount ?? 0) > 0,
      null,
      { timeout: 10_000 },
    );

    expect(
      presignedFetched,
      [
        "Client must fetch a presigned URL before",
        "uploading. Without this, Vercel returns",
        "413 for blobs > 4.5 MB.",
      ].join("\n"),
    ).toBe(true);

    expect(
      directUploadUrl,
      [
        "Client must PUT directly to the presigned",
        "S3 URL, bypassing Vercel body size limits.",
        "Vercel serverless functions reject bodies",
        "> 4.5 MB with HTTP 413.",
      ].join("\n"),
    ).toContain("https://mock-s3.test/");

    const snapshot = await page.evaluate(
      () => window.__recorderTest,
    );
    expect(snapshot?.uploadTarget).toBe("s3");
    expect(snapshot?.uploadKey).toBe(
      "recordings/test.webm",
    );
  },
);
