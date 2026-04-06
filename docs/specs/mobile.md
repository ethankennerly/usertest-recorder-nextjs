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
- [ ] Verify `getUserMedia` actually works on `/` with COOP/COEP present on mobile Safari. **BLOCKED**: Accessing dev server via `http://10.0.0.41:3000` is NOT a secure context. `navigator.mediaDevices` is `undefined` on insecure origins (only `localhost` is exempt). COOP/COEP is NOT the cause. Fix: use HTTPS for mobile dev testing.

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

## getUserMedia requires secure context (HTTPS)

`getUserMedia` requires a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts). `http://10.0.0.41:3000` (network IP over HTTP) is NOT secure — only `localhost` is exempt. On insecure origins, `navigator.mediaDevices` is `undefined`, so the camera prompt never appears.

**iOS Chrome is WebKit** — Apple requires all iOS browsers to use the WebKit engine. Camera access works on iOS Chrome, iOS Safari, and all iOS browsers, but ONLY over HTTPS. This is not a browser limitation — it is a secure context requirement.

**`next dev --experimental-https` alone won't work for LAN IP access** — the auto-generated self-signed cert covers only `localhost`. Accessing `https://10.0.0.41:3000` with that cert gives `ERR_SSL_PROTOCOL_ERROR`. Fix: use `mkcert` to generate a cert that includes LAN IPs as Subject Alternative Names.

**Mobile devices also need the mkcert root CA installed** to trust the self-signed cert. Export with `mkcert -CAROOT` and install the `rootCA.pem` on the device.

- [x] Add `dev:https` script using `mkcert` + `--experimental-https` for mobile LAN testing.
- [x] Display `snapshot.error` on `/` page so users see "Camera requires HTTPS" instead of silent failure.
- [x] Verbose logging: when `NEXT_PUBLIC_RECORDER_VERBOSE=true`, log `isSecureContext`, `protocol`, `hostname`, and `navigator.mediaDevices` presence.
- [x] Regression guard: test that `dev:https` script uses both `mkcert` and `--experimental-https`.
- [ ] Install mkcert root CA on iOS test device (Settings > General > Profile). Document procedure.
- [ ] Verify camera prompt appears on iOS Safari via `https://10.0.0.41:3000`.
- [ ] Verify camera prompt appears on iOS Chrome via `https://10.0.0.41:3000`.

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
- [x] Rewriting `next.config.ts` dropped `reactStrictMode: true` and `allowedDevOrigins: ["127.0.0.1", "localhost"]`. Without `allowedDevOrigins`, the Next.js dev server rejects requests from mobile devices on the local network. Playwright emulation tests passed because they use `localhost`, not the network IP. Fix: restored both options. Added a test that asserts `next.config.ts` contains `allowedDevOrigins`.
- [x] `dev:https` script was set to `next dev --experimental-https`, which auto-generates a cert for `localhost` only. Accessing `https://10.0.0.41:3000` from mobile fails with `ERR_SSL_PROTOCOL_ERROR` because the cert doesn't include the LAN IP. Error message said "Camera not available in this browser" without explaining the HTTPS requirement. Fix: replaced with `mkcert`-based script that includes all LAN IPs in the cert SAN. Updated error message to say "Camera requires HTTPS" when on insecure origin. Added verbose logging of `isSecureContext`, `protocol`, and `hostname`.

## next.config.ts regression guard

Every option below must be present in `next.config.ts`. If any is missing, the CI test `next-config-guard` fails.

- [x] `reactStrictMode: true`
- [x] `allowedDevOrigins` includes `"localhost"` and `"127.0.0.1"`
- [x] `turbopack.root` is set (silences lockfile warning)
- [x] `headers()` returns COOP/COEP scoped to `"/"`
- [x] `rewrites()` returns PostHog `/ingest/*` proxy rules

## Manual mobile verification checklist

- [ ] Open Vercel preview URL on iPhone Safari.
- [ ] `/` loads game grid without getting stuck on "Loading games..."
- [ ] `/recorder` prompts for camera permission.
- [ ] Open Vercel preview URL on Android Chrome.
- [ ] `/` loads game grid without getting stuck on "Loading games..."
- [ ] `/recorder` prompts for camera permission.
