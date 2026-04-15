# Tech Spec: Download Brotli

- [x] Download Brotli compressed Unity web game from S3 bucket

## Files

- [x] Unity Brotli build exports four files per game
- [x] `{prefix}.loader.js` — not brotli compressed
- [x] `{prefix}.data.br` — brotli compressed
- [x] `{prefix}.framework.js.br` — brotli compressed
- [x] `{prefix}.wasm.br` — brotli compressed

## Unity Export

- [x] Compression Format set to Brotli
- [x] Decompression Fallback disabled
- [x] Brotli template uses `.br` file extensions

## Upload Script

- [x] `scripts/upload-unity-brotli.mjs`
- [x] Accepts path to local build directory and `--prefix` S3 key
- [x] `.br` files uploaded with `ContentEncoding: "br"`
- [x] `.loader.js` uploaded with no `ContentEncoding`
- [x] `npm run unity:upload -- ./build-dir --prefix <s3-prefix>`

## S3 Configuration

- [x] S3 bucket allows `s3:GetObject` on Unity build key prefix
- [x] S3 bucket CORS allows `GET` and `HEAD` from any origin
- [x] S3 HEAD on `.br` files returns `Content-Encoding: br`
- [x] S3 HEAD on `.loader.js` returns no `Content-Encoding`
- [x] Browser auto-decompresses `Content-Encoding: br` responses
- [x] No server proxy needed — direct S3 fetch avoids Vercel cost

## Client

- [x] `unity-builds-config.json` brotli game uses same `baseUrl` as GZIP
- [x] `loaderUrl` is always `{base}/{prefix}.loader.js` (no `.br`)
- [x] `assetSuffix` is `.br` for Brotli, empty for GZIP
- [x] Client directly fetches brotli from S3


