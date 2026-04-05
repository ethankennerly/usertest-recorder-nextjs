# Mobile support for iOS and Android

## Research: professional Next.js apps on mobile

Key takeaway: none of the reference apps (Vercel.com, Cal.com, Dub.co, ethankennerly/munia) apply COOP/COEP globally. All export `viewport` from `layout.tsx`. All guard browser APIs behind feature detection.

## Viewport meta tag

- [x] Export `viewport` from `app/layout.tsx` per Next.js 16 API.
- [x] Set `width: 'device-width'`, `initialScale: 1`, `viewportFit: 'cover'`.
- [x] Verify `<meta name="viewport">` appears in page `<head>` (confirmed via live browser test).

## Scope COOP/COEP headers to Unity routes only

- [x] Restore `next.config.ts` with headers scoped to `/` only (not global `/(.*)`).
- [x] Apply COOP `same-origin` only to the route that loads Unity WebGL.
- [x] Apply COEP `credentialless` only to the route that loads Unity WebGL.
- [x] Verify `/recorder` does NOT return COOP or COEP headers (confirmed via curl).

## Guard browser APIs

- [x] Check `navigator.mediaDevices` exists before calling `getUserMedia`.
- [x] Show a clear message if camera access is unavailable; do not block page render.
- [ ] Do not silently swallow config fetch errors on `/`; log or display them.
- [ ] Test: open `/` with camera denied; game grid still appears.

## Responsive game selection

- [x] Ensure `.game-grid` uses responsive widths for small screens (already `auto-fill, minmax(10rem, 1fr)`).
- [x] Ensure `.game-card` touch targets are at least 48px by 48px (160px square cards).
- [x] Test: game grid renders at 390px width with no horizontal overflow (Playwright mobile test).

## Mobile fullscreen adjustments

These extend the fullscreen layout in `load-unity-web.md` with mobile-specific concerns.

- [x] Add `padding: env(safe-area-inset-*)` on the fullscreen container for iOS notch.
- [x] Set `box-sizing: border-box` on the container so safe-area padding doesn't overflow.
- [x] Portrait orientation: game fills height, sides may be cropped (Unity camera behavior).
- [x] Landscape orientation: game fills height, shows wider field of view.
- [x] Test: Unity canvas fills viewport on mobile 390px width (Playwright, confirmed `position: fixed; width: 390px; height: 664px`).
- [ ] Test: no scrolling or bouncing during gameplay on real iOS Safari.

## getUserMedia constraints for mobile

- [x] Request `video: { facingMode: 'user' }` for front camera on mobile.
- [ ] Handle `NotAllowedError` from iOS Safari gracefully.
- [ ] Handle `NotFoundError` when no camera is available.
- [ ] Handle `OverconstrainedError` by falling back to any camera.

## Automated mobile testing

How the pros test mobile in CI:
- Playwright `devices['iPhone 13']` viewport/userAgent with Chromium (not WebKit — not installed).
- Catches layout/responsive issues, not browser engine bugs.
- Real device testing (BrowserStack, Sauce Labs) is added post-MVP for Safari/Chrome engine coverage.
- Pre-push runs Playwright mobile emulation; manual device testing is a deploy checklist.

- [x] Add Playwright test with iPhone 13 emulation for `/` page load (`mobile-layout.spec.ts`).
- [x] Verify game grid renders at 390px width with no horizontal overflow.
- [x] Verify fullscreen container fills emulated mobile viewport during gameplay.
- [x] Add mobile emulation tests to `ci:check` and `git_hooks/pre-push`.

### Hallucinations caught

- [x] Spreading `devices['iPhone 13']` directly into `test.use()` selects WebKit browser, which isn't installed. Fix: only use `viewport`, `userAgent`, `isMobile`, `hasTouch` from the device descriptor — keeps Chromium as the browser.
- [x] Stale Turbopack `.next` cache after editing `next.config.ts` causes "Could not find module in React Client Manifest" — server hangs, tests time out. Fix: `rm -rf .next` before restarting.
- [x] PostHog `/ingest/*` rewrites were in `vercel.json` but missing from `next.config.ts`. The spec checklist marked this as done (`[x]`) but the code was never applied. On mobile via dev server network URL, PostHog 404s flooded the page, and on real devices the page stayed stuck on "Loading games..." forever. 17/17 Playwright tests passed because they didn't check for 404 responses. Fix: added `async rewrites()` to `next.config.ts` mirroring `vercel.json`, and added a Playwright test asserting zero 404 responses on mobile page load.

## Manual mobile verification checklist

- [ ] Open Vercel preview URL on iPhone Safari.
- [ ] `/` loads game grid without getting stuck on "Loading games..."
- [ ] `/recorder` prompts for camera permission.
- [ ] Open Vercel preview URL on Android Chrome.
- [ ] `/` loads game grid without getting stuck on "Loading games..."
- [ ] `/recorder` prompts for camera permission.
