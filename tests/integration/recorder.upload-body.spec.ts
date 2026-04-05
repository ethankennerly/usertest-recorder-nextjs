import { expect, test } from "@playwright/test";
import { getObjectKey } from "../../app/api/recording-upload/route";

const EBML_HEADER = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

test("recorder upload body is valid WebM payload", async ({ page }) => {
  let uploadData: Buffer | null = null;
  let uploadContentType: string | null = null;

  await page.route("**/api/recording-upload", async (route) => {
    const request = route.request();
    uploadData = request.postDataBuffer();
    uploadContentType = request.headers()["content-type"] ?? null;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, key: getObjectKey(), target: "mock" })
    });
  });

  await page.goto("/recorder");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => window.__recorderTest?.state === "recording");
  await page.waitForTimeout(1_200);

  const uploadRequestPromise = page.waitForRequest("**/api/recording-upload");
  await page.evaluate(async () => {
    await window.__simulateUnityQuit?.();
  });
  await uploadRequestPromise;

  await page.waitForFunction(() => window.__recorderTest?.state === "inactive");

  expect(uploadData, "Expected the recorder to send a binary upload payload").not.toBeNull();
  expect(uploadContentType, "Expected the browser upload request to declare video content type").toContain("video/webm");

  const header = uploadData!.slice(0, 4);
  expect(
    header,
    [
      "Repro steps:",
      "1. Start the dev recorder page.",
      "2. Let recording run and click Simulate Unity Quit.",
      "3. Intercept the upload request body before it reaches the API route.",
      "",
      `Observed content-type=${uploadContentType}`,
      `Observed header=${header.toString("hex")}`,
      "Expected the uploaded payload to begin with the WebM EBML header.",
      "",
      "Isolated cause within 10 lines of code:",
      "uploadBlob(blob) -> fetch(UPLOAD_PATH, { body: blob })",
      "app/api/recording-upload/route.ts -> request.arrayBuffer()",
      "Buffer.from(await request.arrayBuffer())"
    ].join("\n")
  ).toEqual(EBML_HEADER);
});
