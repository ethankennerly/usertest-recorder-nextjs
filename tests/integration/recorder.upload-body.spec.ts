import { expect, test } from "@playwright/test";
import {
  getObjectKey,
  mockPresignedUpload,
} from "../helpers/mock-upload";

const EBML_HEADER = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const FTYP_MAGIC = Buffer.from([0x66, 0x74, 0x79, 0x70]);

test("recorder upload body is valid WebM payload", async ({ page }) => {
  let uploadData: Buffer | null = null;
  let uploadContentType: string | null = null;

  await mockPresignedUpload(page);

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
  expect(uploadContentType, "Expected the browser upload request to declare video content type").toMatch(/^video\/(webm|mp4)/);

  const header = uploadData!.slice(0, 4);
  const ftypSlice = uploadData!.slice(4, 8);
  const isEbml = header.equals(EBML_HEADER);
  const isFtyp = ftypSlice.equals(FTYP_MAGIC);
  expect(
    isEbml || isFtyp,
    [
      "Repro steps:",
      "1. Start the dev recorder page.",
      "2. Let recording run and click Simulate Unity Quit.",
      "3. Intercept the upload request body before it reaches the API route.",
      "",
      `Observed content-type=${uploadContentType}`,
      `Observed header=${header.toString("hex")}`,
      "Expected WebM EBML header (1a45dfa3) or MP4 ftyp at bytes 4-7.",
    ].join("\n")
  ).toBe(true);
});
