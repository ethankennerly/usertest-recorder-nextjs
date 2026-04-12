import { expect, test } from "@playwright/test";

test(
  "verbose recorder logs reach /api/recorder-log",
  async ({ page }) => {
    const serverLogs: string[] = [];

    await page.route("**/api/recorder-log", async (route) => {
      const body = route.request().postDataJSON() as {
        message?: string;
      };
      if (body?.message) {
        serverLogs.push(body.message);
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/recorder");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForFunction(
      () => window.__recorderTest?.state === "recording",
    );
    await page.waitForTimeout(500);

    expect(
      serverLogs.length,
      [
        "Expected recorder verbose logs to POST to",
        "/api/recorder-log so mobile browser logs",
        "appear in the server terminal.",
        `Got ${serverLogs.length} log(s).`,
        "Logs: " + JSON.stringify(serverLogs),
      ].join("\n"),
    ).toBeGreaterThan(0);

    const hasPreferredMime = serverLogs.some(
      (l) => l.includes("preferredMimeType"),
    );
    expect(
      hasPreferredMime,
      [
        "Expected a log containing 'preferredMimeType'",
        "to confirm MIME detection ran in the browser.",
        "Logs: " + JSON.stringify(serverLogs),
      ].join("\n"),
    ).toBe(true);

    const hasStartRecording = serverLogs.some(
      (l) => l.includes("startRecording"),
    );
    expect(
      hasStartRecording,
      [
        "Expected a log containing 'startRecording'.",
        "Logs: " + JSON.stringify(serverLogs),
      ].join("\n"),
    ).toBe(true);
  },
);
