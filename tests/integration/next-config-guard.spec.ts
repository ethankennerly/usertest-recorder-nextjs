import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve } from "path";

const configPath = resolve(__dirname, "../../next.config.ts");
const configSource = readFileSync(configPath, "utf-8");

test("next.config.ts contains reactStrictMode", () => {
  expect(configSource).toContain("reactStrictMode: true");
});

test("next.config.ts contains allowedDevOrigins", () => {
  expect(configSource).toContain("allowedDevOrigins");
  expect(configSource).toContain('"localhost"');
  expect(configSource).toContain('"127.0.0.1"');
});

test("next.config.ts contains turbopack root", () => {
  expect(configSource).toMatch(/turbopack:\s*\{[^}]*root:/);
});

test("next.config.ts contains COOP/COEP headers scoped to root", () => {
  expect(configSource).toContain("Cross-Origin-Opener-Policy");
  expect(configSource).toContain("Cross-Origin-Embedder-Policy");
  // Must NOT be global /(.*), only "/"
  expect(configSource).not.toMatch(/source:\s*["']\/\(\.\*\)["']/);
});

test("next.config.ts contains PostHog ingest rewrites", () => {
  expect(configSource).toContain("/ingest/static/:path*");
  expect(configSource).toContain("us-assets.i.posthog.com");
  expect(configSource).toContain("/ingest/:path*");
  expect(configSource).toContain("us.i.posthog.com");
});
