import { expect, test, type Page } from "@playwright/test";
import { getObjectKey } from "../../app/api/recording-upload/route";

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

async function openGameSelectionPage(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
}

test("manifest fetches and contains at least one game", async ({ page }) => {
  await openGameSelectionPage(page);

  const config = await page.evaluate(async () => {
    const url =
      document
        .querySelector("meta[name='unity-config-url']")
        ?.getAttribute("content") ?? "/unity-builds-config.json";
    const res = await fetch(url);
    return res.json();
  });

  expect(config).toHaveProperty("pageTitle");
  expect(config).toHaveProperty("pageDescription");
  expect(config.games).toBeInstanceOf(Array);
  expect(config.games.length).toBeGreaterThanOrEqual(1);

  const game = config.games[0];
  expect(game).toHaveProperty("folder");
  expect(game).toHaveProperty("name");
});

test("game selection page renders buttons matching manifest", async ({
  page,
}) => {
  await openGameSelectionPage(page);

  // Wait for game buttons to appear
  await page.waitForSelector("[data-testid='game-button']");

  const buttonCount = await page
    .locator("[data-testid='game-button']")
    .count();
  expect(buttonCount).toBeGreaterThanOrEqual(1);

  // Title and description from manifest should be visible
  const title = page.locator("h1");
  await expect(title).toBeVisible();
  await expect(title).not.toBeEmpty();

  const description = page.locator("[data-testid='page-description']");
  await expect(description).toBeVisible();
  await expect(description).not.toBeEmpty();
});

test("camera recording starts automatically on root page", async ({
  page,
}) => {
  await openGameSelectionPage(page);

  await page.waitForFunction(
    () => window.__recorderTest?.state === "recording",
    null,
    { timeout: 10_000 }
  );

  const snapshot = await page.evaluate(() => window.__recorderTest);
  expect(snapshot?.state).toBe("recording");
});

test("clicking a game button triggers Unity WebGL load", async ({ page }) => {
  const unityRequests: string[] = [];

  // Intercept Unity build file requests and provide a mock createUnityInstance
  // so react-unity-webgl doesn't log "Error initializing Unity instance".
  await page.route("**/*.loader.js", async (route) => {
    unityRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: MOCK_UNITY_LOADER,
    });
  });

  await openGameSelectionPage(page);
  await page.waitForSelector("[data-testid='game-button']");

  await page.locator("[data-testid='game-button']").first().click();

  // Wait for the Unity player area to appear
  await page.waitForSelector("[data-testid='unity-player']", {
    timeout: 5_000,
  });

  const playerVisible = await page
    .locator("[data-testid='unity-player']")
    .isVisible();
  expect(playerVisible).toBe(true);
});

test("Unity quit stops recording and triggers upload", async ({ page }) => {
  const uploads: string[] = [];

  await page.route("**/api/recording-upload", async (route) => {
    uploads.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, key: getObjectKey(), target: "mock" }),
    });
  });

  await page.route("**/*.loader.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: MOCK_UNITY_LOADER,
    });
  });

  await openGameSelectionPage(page);
  await page.waitForFunction(
    () => window.__recorderTest?.state === "recording",
    null,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(1_200);

  // Ensure data is actually recorded before stopping
  await expect
    .poll(async () => page.evaluate(() => window.__recorderTest?.bytes ?? 0))
    .toBeGreaterThan(0);

  // Simulate Unity quit
  await page.evaluate(async () => {
    if (typeof window.__simulateUnityQuit === "function") {
      await window.__simulateUnityQuit();
    } else if (typeof window.__onUnityGameQuit === "function") {
      window.__onUnityGameQuit();
    }
  });

  await page.waitForFunction(
    () => window.__recorderTest?.state === "inactive",
    null,
    { timeout: 10_000 }
  );
  await expect
    .poll(async () =>
      page.evaluate(() => window.__recorderTest?.uploadCount ?? 0)
    )
    .toBeGreaterThanOrEqual(1);

  const snapshot = await page.evaluate(() => window.__recorderTest);
  expect(snapshot?.state).toBe("inactive");
  expect(snapshot?.uploadCount).toBeGreaterThanOrEqual(1);
});
