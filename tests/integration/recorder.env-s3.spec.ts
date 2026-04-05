import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("AWS_S3_BUCKET in .env.local is a real bucket name", () => {
  const env = readFileSync(".env.local", "utf8");
  const bucket = env.match(/^AWS_S3_BUCKET="?([^"\n]+)/m)?.[1];
  expect(bucket, ".env.local must set AWS_S3_BUCKET").toBeTruthy();
  expect(bucket).not.toContain("replace-me");
  expect(bucket).not.toContain("local-only-example");
});
