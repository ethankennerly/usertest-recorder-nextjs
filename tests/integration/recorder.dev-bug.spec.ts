import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

type NextDevError = {
  name: string;
  message: string;
  stack: string;
};

function extractNextDevError(html: string): NextDevError {
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(marker);

  if (start === -1) {
    return {
      name: "UnknownError",
      message: "No Next.js error payload found in the response body.",
      stack: ""
    };
  }

  const end = html.indexOf("</script>", start);
  const json = html.slice(start + marker.length, end);
  const payload = JSON.parse(json) as {
    err?: {
      name?: string;
      message?: string;
      stack?: string;
    };
  };

  return {
    name: payload.err?.name ?? "UnknownError",
    message: payload.err?.message ?? "Unknown error",
    stack: (payload.err?.stack ?? "").split("\n").slice(0, 6).join("\n")
  };
}

function getRecorderRouteSnippet() {
  return readFileSync(path.join(process.cwd(), "app/recorder/page.tsx"), "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(0, 8)
    .join("\n");
}

test("/recorder renders successfully in next dev", async ({ request }) => {
  const homeResponse = await request.get("/");
  expect(homeResponse.status()).toBe(200);

  const recorderResponse = await request.get("/recorder");
  const recorderHtml = await recorderResponse.text();
  const nextDevError = extractNextDevError(recorderHtml);
  const routeSnippet = getRecorderRouteSnippet();

  expect(
    recorderResponse.status(),
    [
      "Bug facts:",
      `- GET / returned ${homeResponse.status()}`,
      `- GET /recorder returned ${recorderResponse.status()}`,
      `- Next dev error: ${nextDevError.name}: ${nextDevError.message}`,
      "",
      "Route-specific code surface (8 non-blank lines):",
      routeSnippet,
      "",
      "Next.js stack excerpt:",
      nextDevError.stack
    ].join("\n")
  ).toBe(200);
});
