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
- [x] Create local-only `.env.local` with test-safe local values.
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

## 4. Add local and hosted automation

- [x] Add a GitHub Actions workflow to run `npm run --silent ci:check`.
- [x] Modify `git_hooks/pre-push` to run `npm run --silent ci:check`.
- [x] Install Vercel and configure it to deploy the Next.js 16 app on push.
- [x] Set up the new Vercel project and link it to the repo.
- [x] Configure Vercel environment variables for the app, recorder route, and S3 integration.
- [x] Keep development on mock uploads and preview/production on S3 uploads.
- [x] Pass Vercel build checks from `git_hooks/pre-push` when the project is linked.
- [x] Build the linked project locally with `vercel build`.
- [x] Create a ready Vercel preview deployment that includes the home page and recorder route.
- [ ] VS Code IDE Start Debugging and Run Without Debugging launch the dev server.

## 5. Remaining external verification

- [ ] Verify the GitHub-hosted CI job passes after a real git push.
- [ ] The linked Vercel project dedicated private S3 bucket
- [ ] Anonymous HTTP fetches to the preview deployment currently return `401`
- [ ] Deployment readiness was verified via `vercel inspect` and the generated route build output.