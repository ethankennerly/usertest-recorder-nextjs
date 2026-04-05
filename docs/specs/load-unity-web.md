# Load Unity WebGL builds from S3

## Manifest config

- [ ] Define `unity-builds-config.json` schema with `pageTitle`, `pageDescription`, `games` array.
- [ ] Each game in `games` has: `folder` (S3 relative path), `name` (button label), `icon` path.
- [ ] All user-visible page text comes from the manifest: title, description, and button labels.
- [ ] Include an example entry for `save-life-uitk` at `user-testing/unity/builds/save-life-uitk/`.
- [ ] Host the manifest JSON in the `ethankennerly` S3 bucket in `us-east-2`.

## Environment variables

- [ ] Add `NEXT_PUBLIC_UNITY_BUILDS_CONFIG_URL` to `.env.local` and `.env.local.example`.
- [ ] Set the value to the full S3 URL of the manifest JSON file.
- [ ] The manifest URL is the only new env var needed; game list and page text derive from it.

## Game selection page

- [ ] Replace the root page (`app/page.tsx`) with a manifest-driven game selection page.
- [ ] Fetch `unity-builds-config.json` from the manifest URL on page load with a loading state.
- [ ] Render the page title from the manifest `pageTitle` field.
- [ ] Render the description paragraph from the manifest `pageDescription` field.
- [ ] Render a grid of square game buttons, one per entry in the manifest `games` array.
- [ ] Each button shows the game icon image and the game `name` from the manifest.
- [ ] Style the page like a game selection screen: square cards in a clean grid layout.

## Camera and session recording

- [ ] Start camera recording automatically when the root page loads, before any game is selected.
- [ ] Start PostHog session recording from the root page to capture game selection and gameplay.
- [ ] Reuse `getUserMedia`, `MediaRecorder`, S3 upload, and PostHog session ID from the recorder.
- [ ] Extract shared recording logic from `recorder-harness.tsx` into `lib/use-recorder.ts`.

## Unity WebGL loading

- [ ] Install `react-unity-webgl` package.
- [ ] On game button click, load the Unity WebGL build using `useUnityContext` with S3 URLs.
- [ ] Build URL for loader: `{folder}/Build/Build.loader.js` from the manifest `folder` field.
- [ ] Build URLs for data, framework, and wasm from the same manifest `folder` field.
- [ ] Set `webglContextAttributes: { preserveDrawingBuffer: true }` for PostHog canvas capture.
- [ ] Show a loading progress indicator while Unity build files download from S3.
- [ ] Display the Unity canvas in a dedicated game view after the user selects a game.

## Unity quit handling

- [ ] Create a Unity JSLib bridge that calls `window.__onUnityGameQuit()` when the game finishes.
- [ ] On `__onUnityGameQuit` signal, stop the camera recording and trigger the final S3 upload.
- [ ] On `beforeunload`, stop recording and attempt upload as a fallback for tab close.

## S3 CORS for Unity builds bucket

- [ ] Configure CORS on the `ethankennerly` S3 bucket to allow cross-origin requests.
- [ ] Allow `GET` and `HEAD` methods with `*` origin for dev; restrict to prod domain at launch.
- [ ] Set `Access-Control-Allow-Headers: *` and `MaxAgeSeconds: 3600` in the CORS rule.

## Content-Encoding metadata for Unity files

- [ ] Set `Content-Encoding: gzip` on `.data` and `.wasm` S3 objects if Unity used gzip.
- [ ] Set `Content-Encoding: br` on `.data` and `.wasm` S3 objects if Unity used Brotli.
- [ ] Without correct `Content-Encoding` metadata, browsers cannot decompress Unity assets.

## COOP and COEP headers

- [ ] Add `Cross-Origin-Opener-Policy: same-origin` in `next.config.ts` for Unity WASM support.
- [ ] Add `Cross-Origin-Embedder-Policy: require-corp` in `next.config.ts` for Unity WASM support.
- [ ] Verify PostHog ingest requests still work after adding COEP headers.

## Integration tests

- [ ] Test: manifest fetches successfully and contains at least one game with `folder`, `name`, `icon`.
- [ ] Test: game selection page renders the same number of buttons as games in the manifest.
- [ ] Test: clicking a game button triggers Unity WebGL load (intercept build requests in Playwright).
- [ ] Test: camera recording starts automatically on the root page before any game is selected.
- [ ] Test: `window.__onUnityGameQuit()` stops recording and triggers the S3 upload.
- [ ] Add the new tests to `ci:check` and `git_hooks/pre-push`.

## PostHog canvas capture

- [ ] Confirm `preserveDrawingBuffer: true` is set in the Unity `webglContextAttributes` config.
- [ ] If the Unity canvas is blank in replay, enable `session_recording: { recordCanvas: true }`.
- [ ] Set `canvasFps: 4` and `canvasQuality: "low"` in `session_recording` to limit overhead.
- [ ] Verify PostHog replay shows the game selection page and Unity canvas in one session.
