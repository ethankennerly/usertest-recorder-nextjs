import { devices, expect, test } from "@playwright/test";

/** Mock Unity loader that defines window.createUnityInstance so
 *  react-unity-webgl initializes without console.error warnings. */
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

// Use Chromium with iPhone 13 viewport/user-agent (not WebKit — not installed).
// This catches layout/responsive issues; real Safari testing is manual.
const iPhone = devices["iPhone 13"];

test.use({
  viewport: iPhone.viewport,
  userAgent: iPhone.userAgent,
  isMobile: true,
  hasTouch: true,
});

test("game grid renders without horizontal overflow on mobile", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector("[data-testid='game-button']", {
    timeout: 10_000,
  });

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);
});

test("fullscreen container fills mobile viewport during gameplay", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector("[data-testid='game-button']", {
    timeout: 10_000,
  });

  await page.route("**/*.loader.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: MOCK_UNITY_LOADER,
    });
  });

  await page.locator("[data-testid='game-button']").first().click();
  await page.waitForSelector("[data-testid='unity-player']", {
    timeout: 5_000,
  });

  const hasClass = await page.evaluate(() =>
    document.body.classList.contains("game-playing")
  );
  expect(hasClass).toBe(true);

  const container = await page.$eval(".unity-fullscreen", (el) => {
    const s = getComputedStyle(el);
    return { position: s.position, width: s.width, height: s.height };
  });
  expect(container.position).toBe("fixed");

  // Container should fill the viewport (390px for iPhone 13)
  expect(parseInt(container.width)).toBeGreaterThanOrEqual(390);
  expect(parseInt(container.height)).toBeGreaterThan(0);

  // No vertical scrollbar
  const scrollbar = await page.evaluate(
    () =>
      document.documentElement.scrollHeight >
      document.documentElement.clientHeight
  );
  expect(scrollbar).toBe(false);
});

test("page load produces no 404 responses on mobile", async ({ page }) => {
  const responses404: string[] = [];
  page.on("response", (res) => {
    if (res.status() === 404) {
      responses404.push(res.url());
    }
  });

  await page.goto("/");
  await page.waitForSelector("[data-testid='game-button']", {
    timeout: 10_000,
  });

  // Wait for async PostHog requests to settle
  await page.waitForLoadState("networkidle");

  expect(responses404).toEqual([]);
});
