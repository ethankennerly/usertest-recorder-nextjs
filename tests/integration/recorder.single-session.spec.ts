import { expect, test } from "@playwright/test";

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
  let uploadData: Buffer | null = null;

  await page.route("**/api/recording-upload", async (route) => {
    const request = route.request();
    uploadData = request.postDataBuffer();

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        key: "mock/session.webm",
        target: "mock"
      })
    });
  });

  // Simulate the race condition that corrupts real-camera recordings:
  // Call startRecording a second time while the first is still running.
  // This is what happens when React re-mounts the component (Strict Mode,
  // HMR, or fast refresh) while getUserMedia is slow (real hardware).
  // Both MediaRecorders push chunks to the shared ref, producing a
  // concatenated WebM with two EBML headers.
  await page.goto("/recorder");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => window.__recorderTest?.state === "recording");

  // Start a second recording on the same component (simulates re-mount race)
  await page.evaluate(async () => {
    await window.__simulateRemount?.();
  });
  await page.waitForTimeout(1_500);

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
      "Repro steps:",
      "1. Open `/recorder` in dev mode.",
      "2. Camera initialization takes >200ms (real hardware).",
      "3. Page reloads or React re-mounts the component.",
      "4. Two MediaRecorders push chunks to the same shared ref.",
      "5. Click `Simulate Unity Quit` — the blob contains two WebM streams.",
      "",
      `Observed EBML headers: ${ebmlCount} (expected 1)`,
      `Observed upload size: ${uploadData!.length} bytes`,
      "",
      "Isolated cause within 10 lines of code in recorder-harness.tsx:",
      "  useEffect(() => {",
      "    void startRecording();",
      "    return () => {",
      "      // Cleanup only stops tracks but does not abort getUserMedia",
      "      // or clear chunksRef. A second startRecording() call shares",
      "      // the same chunksRef, producing two concatenated WebMs.",
      "      mediaStreamRef.current?.getTracks().forEach(t => t.stop());",
      "    };",
      "  }, [startRecording]);"
    ].join("\n")
  ).toBe(1);
});
