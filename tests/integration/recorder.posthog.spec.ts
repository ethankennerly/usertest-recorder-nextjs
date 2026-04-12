import { expect, test } from "@playwright/test";
import { getObjectKey } from "../../app/api/recording-upload/route";

async function recordAndUpload(page: import("@playwright/test").Page) {
  await page.goto("/recorder");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => window.__recorderTest?.state === "recording");
  await page.waitForTimeout(1_200);

  const uploadRequestPromise = page.waitForRequest("**/api/recording-upload");
  await page.evaluate(async () => {
    await window.__simulateUnityQuit?.();
  });
  await uploadRequestPromise;

  await page.waitForFunction(
    () =>
      window.__recorderTest?.state === "inactive" &&
      (window.__recorderTest?.uploadCount ?? 0) > 0,
  );
}

test(
  "upload request includes X-PostHog-Session-Id header",
  async ({ page }) => {
    let sessionIdHeader: string | null = null;

    await page.route("**/api/recording-upload", async (route) => {
      sessionIdHeader =
        route.request().headers()["x-posthog-session-id"] ?? null;
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

    await recordAndUpload(page);

    expect(
      sessionIdHeader,
      [
        "Expected the recorder upload to include X-PostHog-Session-Id header.",
        "PostHog must be initialized via instrumentation-client.ts with a",
        "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN before the upload fires.",
      ].join("\n")
    ).toBeTruthy();
  }
);

test("snapshot includes posthogSessionId after upload", async ({ page }) => {
  await page.route("**/api/recording-upload", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, key: getObjectKey(), target: "mock" }),
    });
  });

  await recordAndUpload(page);

  const snapshot = await page.evaluate(() => window.__recorderTest);

  expect(
    snapshot?.posthogSessionId,
    [
      "Expected snapshot.posthogSessionId to be set after upload.",
      "posthog.get_session_id() must return a non-empty string at upload time.",
    ].join("\n")
  ).toBeTruthy();
});
