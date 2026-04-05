# Recorder integration checklist

## 1. Bootstrap the new Next.js 16 repo

- [x] Create `package.json` with `dev`, `build`, `lint`, `test`, and `ci:check` scripts.
- [x] Add Next.js 16, React, and React DOM runtime dependencies.
- [x] Add TypeScript, ESLint, and Next.js dev dependencies.
- [x] Add Playwright and Vercel to dev dependencies.
- [x] Install the Playwright Chromium browser for local and CI runs.
- [x] Add `tsconfig.json`, `next-env.d.ts`, `eslint.config.mjs`, and `next.config.ts`.
- [x] Create root `.env` with placeholder recorder variables.
- [x] Edit public repo `.env.local.example` to show example variables.
- [x] Create local-only `.env.local` with local development values.
- [x] Create `app/layout.tsx` and a home page for the new repo.
- [x] Create the Next.js 16 recorder route at `app/recorder/page.tsx`.

## 2. Build the deterministic local recorder test harness

- [x] Add a Playwright config with fake media flags and permissions.
- [x] Launch Chromium with `--use-fake-ui-for-media-stream`.
- [x] Launch Chromium with `--use-fake-device-for-media-stream`.
- [x] Run the recorder tests in headless Chromium.
- [x] Grant camera and microphone permissions for the test origin.
- [x] Add a Playwright test for auto-start recording on page load.
- [x] Add a Playwright test for stop recording on Unity quit.
- [x] Add a mock upload route for recorder integration tests.
- [x] Load the Next.js 16 recorder route in Playwright.
- [x] Wait for page load before checking recorder state.
- [x] Enable a test-only flag for recorder integration hooks.
- [x] Expose `window.__recorderTest.state` in test mode only.
- [x] Expose `window.__recorderTest.bytes` in test mode only.
- [x] Expose `window.__simulateUnityQuit()` in test mode only.
- [x] Assert recorder state becomes `recording` after page load.
- [x] Assert recording starts without any user click.
- [x] Wait at least 1 second for media data to accumulate.
- [x] Assert recorded byte count becomes greater than zero.
- [x] Trigger `window.__simulateUnityQuit()` from the test.
- [x] Assert recorder state becomes `inactive` after Unity quit.
- [x] Assert stop logic runs exactly once after Unity quit.
- [x] Assert a finalized recording blob exists after stop.
- [x] Assert finalized blob size is greater than zero.
- [x] Mock the upload endpoint and assert one upload request is sent.
- [x] Assert the upload request uses the expected method and MIME type.

## 3. Add the real S3 upload path

- [x] Upload the recording blob to S3 in the recorder route's stop logic.
- [x] Configure a dedicated private S3 bucket for recorder uploads.
- [x] Verify end-to-end from the local dev server to an S3 upload.
- [x] Verify the uploaded video is privately available and cannot be publicly downloaded from S3.
- [x] Open browser. Click: Simulate Unity Quit. Observe S3. Expect recording.
- [x] Use browser with dev app to record and upload a video recording to S3 from the dev server.
- [x] Open browser. Record. Click: Simulate Unity Quit. Download from S3. Play the video. Expected: video plays with camera and audio.
- [x] Automated test records, stops, checks duration > 0, frame count > 1, and both codecs present.
- [x] Research three professional browser recording projects for how they produce playable WebM files.
- [x] Apply the fix from professional reference projects (`@fix-webm-duration/fix` adds duration metadata).
- [x] Record. Download. Play. Verify: video is moving shapes.
- [ ] Record. Download. Play. Verify: audio is starting and stopping sounds.
- [ ] Open browser. Record. Download. Play. Verify: camera video and audio replays.

### 3a. Diagnosed: React Strict Mode double-mount + async getUserMedia race

Root cause: `useEffect` calls `startRecording()` which awaits `getUserMedia` (200-500ms on real hardware). React Strict Mode unmounts and remounts, calling `startRecording` again while the first `getUserMedia` is still in-flight. Both resolve and create two MediaRecorders sharing `chunksRef`, producing a single file with two concatenated EBML WebM headers. Players read only the first tiny fragment (the ghost mount's ~34KB recording).

- [x] Fix: generation counter (`startGenerationRef`) in `startRecording`. After `getUserMedia` resolves, check if generation is still current. Stale calls stop their stream and bail.
- [x] Test: `recorder.single-session.spec.ts` injects 500ms delay into `getUserMedia` via `page.addInitScript` and then calls `__simulateRemount` to force a concurrent race. Asserts exactly 1 EBML header in the upload.
- [x] Test: `recorder.playback.spec.ts` checks duration > 0, frame count > 1, codecs present, AND exactly 1 EBML header.
- [x] Verbose diagnostics: set `NEXT_PUBLIC_RECORDER_VERBOSE=true` to log recorder lifecycle (mount, getUserMedia, generation checks, start, stop, chunks) to the browser console.

### 3b. Diagnosed: Silent audio in real-camera recordings

Observed: 8 of 27 S3 recordings have -91 dB mean volume (digital silence). The opus audio stream exists but contains only 8-byte DTX silence packets (vs. ~959-byte packets in audible recordings). Automated tests pass because Chromium's `--use-fake-device-for-media-stream` generates a synthetic beep at ~-21 dB, masking the real issue.

Root cause: Chrome/macOS got into a stale permission state where `getUserMedia({audio:true})` succeeded and returned a live audio track, but the actual microphone data was blocked — delivering only silence. Toggling Chrome's microphone permission from "Allow" to "Ask" and re-granting it resolved the issue. The exact trigger is unknown but appears to be a browser or OS-level permission caching bug.

Diagnosis data from S3 recordings:
- Fake device recordings: mean_volume ~-21 dB (synthetic beep — always passes)
- Real mic recordings with permission: mean_volume ~-28 to -48 dB (ambient room noise + speech)
- Real mic recordings with stale permission: mean_volume -91.0 dB (digital silence, 8-byte opus packets)

- [x] Test: `recorder.playback.spec.ts` now checks `mean_volume > -50 dB` via ffmpeg volumedetect. Catches digital silence while allowing real ambient noise.
- [x] Test: `recorder-playback.s3.spec.ts` also checks audio level after S3 round-trip.
- [x] Validated test accuracy: -91 dB file → FAIL, -41 dB file → PASS, -21 dB fake device → PASS.
- [x] Fix: runtime audio level monitoring using `AudioContext` + `AnalyserNode`. Polls RMS every 500ms. Shows warning when audio is silent (< -60 dB) or too quiet to distinguish speech from noise (< -40 dB).
- [ ] Fix: add a pre-recording mic permission check. After `getUserMedia` succeeds, sample the audio track for 500ms to verify it is producing non-zero data before starting the MediaRecorder. If silent, show a diagnostic message instead of silently recording mute audio.

## 4. Add local and hosted automation

- [ ] VS Code IDE Start Debugging and Run Without Debugging launch the dev server.
- [x] Add a GitHub Actions workflow to run `npm run --silent ci:check`.
- [x] Modify `git_hooks/pre-push` to run `npm run --silent ci:check`.
- [x] `git_hooks/pre-push` incrementally syncs recordings from S3 to `temp/recordings/` (skips existing files by size).
- [x] Install Vercel and configure it to deploy the Next.js 16 app on push.
- [x] Set up the new Vercel project and link it to the repo.
- [x] Configure Vercel environment variables for the app, recorder route, and S3 integration.
- [x] Keep deterministic Playwright tests on mock uploads while local development and dedicated S3 integration tests use S3 uploads.
- [x] Pass Vercel build checks from `git_hooks/pre-push` when the project is linked.
- [x] Build the linked project locally with `vercel build`.
- [x] Create a ready Vercel preview deployment that includes the home page and recorder route.

## 5. Remaining external verification

- [ ] Verify the GitHub-hosted CI job passes after a real git push.
- [ ] The linked Vercel project dedicated private S3 bucket
- [ ] Anonymous HTTP fetches to the preview deployment currently return `401`
- [ ] Deployment readiness was verified via `vercel inspect` and the generated route build output.