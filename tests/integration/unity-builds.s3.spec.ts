import { expect, test } from "@playwright/test";

/**
 * Validates that Unity build files referenced in the manifest config
 * are actually accessible from S3 with CORS headers.
 *
 * This test catches:
 * - Wrong file paths (e.g., Build/Build.loader.js vs game.loader.js)
 * - Missing CORS headers (browser blocks cross-origin requests)
 * - 403/404 from S3 (private bucket or missing files)
 */

type GameEntry = {
  folder: string;
  buildPrefix: string;
  name: string;
  icon?: string;
  assetSuffix?: string;
};

type BuildsConfig = {
  pageTitle: string;
  pageDescription: string;
  baseUrl: string;
  games: GameEntry[];
};

const CONFIG_URL =
  process.env.NEXT_PUBLIC_UNITY_BUILDS_CONFIG_URL ?? "/unity-builds-config.json";

test("Unity build loader.js is accessible from S3 with CORS", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  const config: BuildsConfig = await page.evaluate(async (url: string) => {
    const res = await fetch(url);
    return res.json();
  }, CONFIG_URL);

  expect(config.games.length).toBeGreaterThanOrEqual(1);

  const game = config.games[0];
  const loaderUrl = `${config.baseUrl}/${game.folder}/${game.buildPrefix}.loader.js`;

  // Fetch loader.js from the browser (cross-origin, like react-unity-webgl does)
  const result = await page.evaluate(async (url: string) => {
    try {
      const res = await fetch(url);
      return {
        ok: res.ok,
        status: res.status,
        contentType: res.headers.get("content-type"),
        corsOrigin: res.headers.get("access-control-allow-origin"),
        bodyLength: (await res.text()).length,
      };
    } catch (e: unknown) {
      return { ok: false, status: 0, error: String(e), bodyLength: 0 };
    }
  }, loaderUrl);

  expect(
    result.ok,
    [
      `Unity loader.js fetch failed: ${loaderUrl}`,
      `Status: ${result.status}`,
      `If 403: S3 bucket may be private or path is wrong.`,
      `If CORS error: run aws s3api put-bucket-cors.`,
      `Actual files: aws s3 ls s3://ethankennerly/${game.folder}/`,
    ].join("\n")
  ).toBe(true);

  expect(
    result.bodyLength,
    "loader.js response body is empty"
  ).toBeGreaterThan(0);
});

test("Unity brotli files accessible directly from S3", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  const config: BuildsConfig = await page.evaluate(async (url: string) => {
    const res = await fetch(url);
    return res.json();
  }, CONFIG_URL);

  const brGame = config.games.find(
    (g: GameEntry) => g.assetSuffix === ".br",
  );
  if (!brGame) {
    test.skip(true, "no brotli game in manifest");
    return;
  }

  const base = config.baseUrl;
  const loaderUrl =
    `${base}/${brGame.folder}/${brGame.buildPrefix}.loader.js`;
  const response = await page.request.get(loaderUrl);

  expect(response.status()).toBe(200);
  expect(
    response.headers()["content-type"],
  ).toContain("application/javascript");
  expect((await response.text()).length).toBeGreaterThan(0);
});

test("all four Unity build files exist and return 200", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  const config: BuildsConfig = await page.evaluate(async (url: string) => {
    const res = await fetch(url);
    return res.json();
  }, CONFIG_URL);

  for (const game of config.games) {
    const base = `${config.baseUrl}/${game.folder}`;
    const suffix = game.assetSuffix ?? "";
    const files = [
      `${game.buildPrefix}.loader.js`,
      `${game.buildPrefix}.data${suffix}`,
      `${game.buildPrefix}.framework.js${suffix}`,
      `${game.buildPrefix}.wasm${suffix}`,
    ];

    for (const file of files) {
      const url = `${base}/${file}`;
      const status = await page.evaluate(async (u: string) => {
        try {
          const res = await fetch(u, { method: "HEAD" });
          return res.status;
        } catch {
          return 0;
        }
      }, url);

      expect(
        status,
        [
          `Unity build file not accessible: ${file}`,
          `Full URL: ${url}`,
          `Check: aws s3 ls s3://ethankennerly/${game.folder}/`,
        ].join("\n")
      ).toBe(200);
    }
  }
});

test("Unity game loads past 0% in a real browser", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector("[data-testid='game-button']");

  // Click first game
  await page.locator("[data-testid='game-button']").first().click();
  await page.waitForSelector("[data-testid='unity-player']");

  // Wait for loading to move past 0% (up to 30s for large builds)
  const loaded = await page.waitForFunction(
    () => {
      const pill = document.querySelector(".status-pill");
      if (!pill) return true; // pill removed = fully loaded
      const text = pill.textContent ?? "";
      const match = text.match(/(\d+)%/);
      if (!match) return false;
      return parseInt(match[1], 10) > 0;
    },
    null,
    { timeout: 30_000 }
  ).then(() => true)
    .catch(() => false);

  expect(
    loaded,
    [
      "Unity game stuck at Loading... 0%",
      "Likely causes:",
      "- Build files not found at the S3 path (check buildPrefix in manifest)",
      "- CORS not configured on S3 bucket",
      "- Wrong baseUrl in manifest",
    ].join("\n")
  ).toBe(true);
});
