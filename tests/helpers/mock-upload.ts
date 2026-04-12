import type { Page } from "@playwright/test";
import { getObjectKey } from "../../lib/s3";

export { getObjectKey } from "../../lib/s3";

export function mockPresignedUpload(page: Page) {
  return page.route(
    "**/api/presigned-upload*",
    async (route) => {
      const url = new URL(route.request().url());
      const ct =
        url.searchParams.get("contentType") || "video/webm";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: null,
          key: getObjectKey(ct),
          target: "mock",
        }),
      });
    },
  );
}
