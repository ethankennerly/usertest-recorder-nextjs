import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import pkg from "@next/env";

const { loadEnvConfig } = pkg;
loadEnvConfig(process.cwd());

const contentTypeRules = [
  { match: /\.wasm\.br$/, type: "application/wasm", encoding: "br" },
  { match: /\.framework\.js\.br$/, type: "application/javascript", encoding: "br" },
  { match: /\.data\.br$/, type: "application/octet-stream", encoding: "br" },
  { match: /\.js$/, type: "application/javascript", encoding: undefined },
  { match: /\.wasm$/, type: "application/wasm", encoding: undefined },
  { match: /\.data$/, type: "application/octet-stream", encoding: undefined },
];

function resolveFileMetadata(fileName) {
  for (const rule of contentTypeRules) {
    if (rule.match.test(fileName)) {
      return { contentType: rule.type, contentEncoding: rule.encoding };
    }
  }
  const isBr = fileName.endsWith(".br");
  return {
    contentType: "application/octet-stream",
    contentEncoding: isBr ? "br" : undefined,
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let dir = null;
  let prefix = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--prefix" && i + 1 < args.length) {
      prefix = args[++i];
    } else if (!dir) {
      dir = args[i];
    }
  }
  return { dir, prefix };
}

async function main() {
  const { dir, prefix } = parseArgs(process.argv);
  if (!dir) {
    console.error("Usage: node scripts/upload-unity-brotli.mjs <dir> --prefix <s3-prefix>");
    process.exit(1);
  }
  if (!prefix) {
    console.error("--prefix argument is required");
    process.exit(1);
  }

  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION || "us-east-1";
  if (!bucket) {
    console.error("AWS_S3_BUCKET env var is required");
    process.exit(1);
  }

  const client = new S3Client({ region });
  const files = await readdir(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const key = `${prefix}/${file}`;
    const { contentType, contentEncoding } = resolveFileMetadata(file);

    console.log(
      `upload: ${file} -> s3://${bucket}/${key}`,
      `Content-Type: ${contentType}`,
      contentEncoding ? `Content-Encoding: ${contentEncoding}` : ""
    );

    const body = await readFile(filePath);
    const params = {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    };
    if (contentEncoding) {
      params.ContentEncoding = contentEncoding;
    }

    await client.send(new PutObjectCommand(params));
    console.log(`ok: ${file}`);
  }

  console.log(`Done. ${files.length} files uploaded.`);
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
