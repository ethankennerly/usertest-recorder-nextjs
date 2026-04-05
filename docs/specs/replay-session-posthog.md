# PostHog session replay checklist

## Install

- [x] Install the PostHog JavaScript SDK: `npm install posthog-js`.

## Environment variables

- [x] Rename `POSTHOG_API_KEY` to `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` in `.env`,
  `.env.local`, and `.env.local.example`.
- [x] Add `NEXT_PUBLIC_POSTHOG_HOST=/ingest` to `.env`, `.env.local`, and
  `.env.local.example`.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to
  Vercel project environment variables.

## Initialize

- [x] Create `instrumentation-client.ts` at the project root.
- [x] In `instrumentation-client.ts`, import `posthog` from `posthog-js`.
- [x] Call `posthog.init(token, { api_host: host, defaults: "2026-01-30" })` only
  when the token env var is set.
- [ ] Open browser devtools → Network → filter `posthog`. Expect requests to
  `/ingest/...` within seconds of page load on the recorder page.
- [ ] PostHog dashboard → Session Replay → expect a recording after 10+ seconds of
  interaction on the recorder page.

## Reverse proxy

- [x] Add Next.js rewrites in `next.config.ts`: `/ingest/static/:path*` →
  PostHog assets CDN, `/ingest/:path*` → `https://us.i.posthog.com/:path*`.
  (Previously marked done but code was missing — restored and verified with
  zero-404 Playwright test.)
- [x] Add equivalent edge rewrites in `vercel.json` so Vercel routes
  PostHog traffic first-party without hitting the Next.js server.
- [ ] Verify in devtools: PostHog requests use `/ingest/...` (same origin, not
  `us.i.posthog.com`).

## Integration test: PostHog session ID in upload

- [x] In `recorder-harness.tsx`, import `posthog` from `posthog-js`.
- [x] Add `posthogSessionId: string | null` to `RecorderSnapshot` and
  `types/global.d.ts`.
- [x] In `uploadBlob`, read `posthog.get_session_id()` and send it as the
  `X-PostHog-Session-Id` request header.
- [x] Store the session ID in the snapshot so tests can assert it.
- [x] After a successful upload, call `posthog.capture("camera_recording_uploaded",
  { s3_key: key })` so analysts can navigate from PostHog to the S3 recording.
- [x] In the upload API route, read the `x-posthog-session-id` header and pass it
  as S3 object metadata (`posthog-session-id`).
- [x] Playwright test: intercept upload request and assert `x-posthog-session-id`
  header is non-empty.
- [x] Playwright test: after upload, assert `snapshot.posthogSessionId` is set.

## Unity WebGL canvas capture

- [ ] Confirm the Unity WebGL loader config sets `preserveDrawingBuffer: true` in
  `webglContextAttributes`.
- [ ] After integrating PostHog, open a session in PostHog dashboard and verify the
  Unity canvas renders in the replay (not blank or black).
- [ ] If the canvas is blank, enable canvas recording in `posthog.init`:
  `session_recording: { recordCanvas: true, canvasFps: 4, canvasQuality: "low" }`.

## Privacy and consent

- [ ] Review PostHog privacy controls at posthog.com/docs/session-replay/privacy.
- [ ] Add `class="ph-no-capture"` to any DOM elements that should be masked in
  replays.
- [ ] If user consent is required before tracking, call
  `posthog.opt_in_capturing()` only after consent.

## Pre-push verification

- [ ] `npm run ci:check` passes with PostHog integration tests included.
- [ ] `git_hooks/pre-push` exercises PostHog tests alongside existing recorder
  tests.
- [ ] Vercel build succeeds with `instrumentation-client.ts` and `posthog-js`.
