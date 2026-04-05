# Load Unity WebGL builds from S3

## Manifest config

- [x] Define `unity-builds-config.json` schema with `pageTitle`, `pageDescription`, `games` array.
- [x] Each game in `games` has: `folder`, `buildPrefix`, `name`, `icon`.
- [x] All user-visible page text comes from the manifest: title, description, and button labels.
- [x] Include an example entry for `save-life-uitk` at `user-testing/unity/builds/save-life-uitk/`.
- [ ] Host the manifest JSON in the `ethankennerly` S3 bucket in `us-east-2`.

## Environment variables

- [x] Add `NEXT_PUBLIC_UNITY_BUILDS_CONFIG_URL` to `.env.local` and `.env.local.example`.
- [x] Set the value to the full S3 URL of the manifest JSON file.

## Game selection page

- [x] Replace the root page (`app/page.tsx`) with a manifest-driven game selection page.
- [x] Fetch `unity-builds-config.json` from the manifest URL on page load with a loading state.
- [x] Render the page title, description, and game buttons from the manifest.
- [x] Style the page like a game selection screen: square cards in a clean grid layout.

## Camera and session recording

- [x] Start camera recording automatically when the root page loads, before any game is selected.
- [x] Reuse `getUserMedia`, `MediaRecorder`, S3 upload, and PostHog session ID via `lib/use-recorder.ts`.

## Unity WebGL loading

- [x] Install `react-unity-webgl` package.
- [x] On game button click, load the Unity WebGL build using `useUnityContext` with S3 URLs.
- [x] Build URLs using `{baseUrl}/{folder}/{buildPrefix}.loader.js` (and `.data`, `.framework.js`, `.wasm`).
- [x] Set `webglContextAttributes: { preserveDrawingBuffer: true }` for PostHog canvas capture.
- [x] Show a loading progress indicator while Unity build files download from S3.
- [x] Fix `unity-player.tsx` to accept `buildPrefix` prop and use it in build file URLs.

## Fullscreen game layout

Reference: [PostHogSessionReplay template](https://github.com/ethankennerly/unity-minimal-template/tree/main/Assets/WebGLTemplates/PostHogSessionReplay) and [live build](https://ethankennerly.s3.us-east-2.amazonaws.com/save-life-uitk/index.html).

The template uses:
- `html, body { height: 100%; margin: 0; background-color: #000; }`
- `#unity-container { width: 100%; height: 100%; display: flex; flex-direction: column; }`
- `#unity-canvas { width: 100% !important; height: 100% !important; flex-grow: 1; }`
- Unity camera fits height: portrait crops left/right, landscape shows wider field.

- [x] Remove `aspectRatio: "16/9"` from the Unity canvas style.
- [x] Canvas fills `width: 100%; height: 100%` of a fullscreen container.
- [x] Container uses `position: fixed; inset: 0; display: flex; flex-direction: column; background: #000`.
- [x] Add `body.game-playing { overflow: hidden }` during gameplay.
- [x] Hide game title, page description, and page chrome during gameplay.
- [x] Show a back/exit button overlaid on the game canvas to return to game selection.
- [x] Restore normal page layout (title, description, game grid) when exiting the game.
- [x] Test: no scroll bars visible during gameplay.
- [x] Test: back button exits fullscreen game and returns to game selection.

### Hallucinations caught

- [x] Turbopack cache corruption after editing `next.config.ts` — `rm -rf .next` required. Tests hung for 2+ minutes waiting for server. Checklist: always clear `.next` after config changes if server errors mention "React Client Manifest".
- [x] Playwright `devices['iPhone 13']` defaults to WebKit browser — caused "Executable doesn't exist" error. Fix: use `viewport`/`userAgent`/`isMobile`/`hasTouch` from device descriptor with Chromium.

## Unity quit handling

- [x] Create a Unity JSLib bridge that calls `window.__onUnityGameQuit()` when the game finishes.
- [x] On `__onUnityGameQuit` signal, stop the camera recording and trigger the final S3 upload.
- [ ] On `beforeunload`, stop recording and attempt upload as a fallback for tab close.

## S3 CORS for Unity builds bucket

- [ ] Configure CORS on the `ethankennerly` S3 bucket to allow cross-origin requests.
- [ ] Allow `GET` and `HEAD` methods with `*` origin for dev; restrict to prod domain at launch.

## Content-Encoding metadata for Unity files

- [ ] Set `Content-Encoding: gzip` or `br` on `.data` and `.wasm` S3 objects to match Unity compression.

## COOP and COEP headers

Scoped to Unity routes only — global COOP/COEP breaks `getUserMedia` on iOS Safari. See `mobile.md`.

- [x] Apply COOP `same-origin` and COEP `credentialless` only to `/` route (where Unity loads).
- [x] Do not apply COOP/COEP to `/recorder` or other routes.

## Integration tests

- [x] Test: manifest fetches successfully and contains at least one game with `folder`, `name`, `icon`.
- [x] Test: game selection page renders buttons matching manifest.
- [x] Test: clicking a game button triggers Unity WebGL load.
- [x] Test: camera recording starts automatically on the root page.
- [x] Test: `window.__onUnityGameQuit()` stops recording and triggers S3 upload.
- [x] Add the new tests to `ci:check` and `git_hooks/pre-push`.

## PostHog canvas capture

- [x] Confirm `preserveDrawingBuffer: true` is set in the Unity `webglContextAttributes` config.
- [ ] If the Unity canvas is blank in replay, enable `session_recording: { recordCanvas: true }`.
- [ ] Verify PostHog replay shows the game selection page and Unity canvas in one session.
