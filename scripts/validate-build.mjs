import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const requiredPaths = [
  path.join(process.cwd(), ".next", "BUILD_ID"),
  path.join(process.cwd(), ".next", "server", "app", "recorder", "page.js")
];

await Promise.all(
  requiredPaths.map(async (filePath) => {
    await access(filePath, constants.F_OK);
  })
);

console.log("Build output includes the recorder route.");
