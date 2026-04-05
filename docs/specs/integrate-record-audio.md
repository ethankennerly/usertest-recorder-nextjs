# Audio recording checklist

## 1. Runtime audio level meter

References: ITU-T P.56 (active speech level), Web Audio API `AnalyserNode`.

- Conversational speech at a laptop mic: roughly -20 to -30 dBFS.
- Quiet room ambient noise floor: roughly -45 to -55 dBFS.
- Dead/blocked mic (digital silence): below -70 dBFS.

The previous text-based warnings ("Audio is very quiet") produced false positives: the warning appeared during normal room silence between sentences. The threshold (-40 dB) was inside the ambient noise floor, so the warning triggered whenever the user stopped speaking.

### Meter behavior

- [x] After `getUserMedia` resolves, create `AudioContext` + `AnalyserNode` on the mic stream.
- [x] Poll RMS level every 500ms via `getFloatTimeDomainData`.
- [x] Convert RMS to dB: `20 * Math.log10(rms)`.
- [x] Classify audio level: silent (< `NEXT_PUBLIC_AUDIO_SILENT_DB`, default -50), quiet (< `NEXT_PUBLIC_AUDIO_QUIET_DB`, default -26), or ok.
- [x] Expose `audioLevel` (rounded dB), `audioWarning` (`"silent"` | `"quiet"` | `null`), and `meterVisible` on `RecorderSnapshot`.
- [x] Horizontal meter bar: red fill when silent or quiet, green fill when audible.
- [x] Emoji icon at left: 🔇 when warning, 🎙️ when ok.
- [x] Dashed line at the quiet threshold on the meter track so the user can see the target level.
- [x] Meter auto-shows after `NEXT_PUBLIC_AUDIO_METER_SHOW_AFTER_S` seconds (default 3) of consecutive quiet/silent polls.
- [x] Meter fades out (CSS opacity transition) when audio returns to ok, so the user can focus on content.
- [x] Meter only renders while `snapshot.state === "recording"`.
- [x] `data-testid="audio-meter"` and `data-warning` attribute for test hooks.
- [x] `role="meter"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` for accessibility.
- [x] Stop the audio monitor (`clearInterval`, `AudioContext.close`) on recorder stop and useEffect cleanup.

### Env vars for tuning

- [x] `NEXT_PUBLIC_AUDIO_SILENT_DB` — dB threshold for "dead mic" (default: `-50`).
- [x] `NEXT_PUBLIC_AUDIO_QUIET_DB` — dB threshold for "too quiet to distinguish speech" (default: `-26`).
- [x] `NEXT_PUBLIC_AUDIO_METER_SHOW_AFTER_S` — seconds of consecutive quiet before meter appears (default: `3`).

## 2. Unit tests for audio level classification

No unit test framework is installed. Only Playwright integration tests exist. The audio level classification logic (RMS → dB → warning) is inlined in `startAudioMonitor` inside `recorder-harness.tsx`.

- [ ] Extract the pure function: `classifyAudioLevel(dB: number, silentDb: number, quietDb: number): AudioWarning` from `recorder-harness.tsx`.
- [ ] Extract the pure function: `rmsToDB(rms: number): number` from `recorder-harness.tsx`.
- [ ] Install `vitest` as a dev dependency.
- [ ] Add an `npm run test:unit` script that runs `vitest run`.
- [ ] Add `test:unit` to `ci:check` in `package.json` so `pre-push` exercises unit tests.
- [ ] Unit test: `rmsToDB(0)` returns `-Infinity`.
- [ ] Unit test: `rmsToDB(1)` returns `0`.
- [ ] Unit test: `rmsToDB(0.001)` returns `-60`.
- [ ] Unit test: `classifyAudioLevel(-Infinity, -50, -26)` returns `"silent"`.
- [ ] Unit test: `classifyAudioLevel(-91, -50, -26)` returns `"silent"`.
- [ ] Unit test: `classifyAudioLevel(-50, -50, -26)` returns `"quiet"` (boundary: exactly -50 is quiet, not silent).
- [ ] Unit test: `classifyAudioLevel(-30, -50, -26)` returns `"quiet"`.
- [ ] Unit test: `classifyAudioLevel(-26, -50, -26)` returns `null` (boundary: exactly -26 is ok, not quiet).
- [ ] Unit test: `classifyAudioLevel(-10, -50, -26)` returns `null`.
- [ ] True-negative: `classifyAudioLevel(-51, -50, -26)` returns `"silent"`, not `"quiet"`.
- [ ] True-negative: `classifyAudioLevel(-25, -50, -26)` returns `null`, not `"quiet"`.

## 3. Integration test: audio meter shows on silent input

The Playwright fake device generates a synthetic beep (~-21 dB, well above -26 dB threshold). To test the silent/quiet meter, inject a mock that replaces `getUserMedia` with a stream whose audio track produces zeros.

- [ ] Integration test: with fake device (default), meter is NOT visible (`audio-meter--visible` absent). True-negative for false alarms.
- [ ] Integration test: inject silent audio via `addInitScript` overriding `getUserMedia` to return an `AudioContext.createMediaStreamDestination()` stream (digital silence). Wait > `METER_SHOW_AFTER_QUIET_S` seconds. Assert meter becomes visible with `data-warning="silent"`.
- [ ] Integration test: `snapshot.audioWarning` equals `"silent"` when mic is muted.
- [ ] Integration test: `snapshot.audioWarning` is `null` when mic is working (fake device).
- [ ] Integration test: `snapshot.meterVisible` is `false` when audio is ok (no quiet streak).

## 4. Audit existing audio assertions for accuracy

`recorder.playback.spec.ts` asserts `mean_volume > -50 dB` via ffmpeg. This always passes with fake device (~-21 dB) and **cannot detect real-world silent mic bugs**. It is a true positive for fake device audio, but a false negative for real mic silence — it never exercises the failure path.

The error message still references "macOS microphone permission not granted" which was disproven. The actual cause was a stale browser-OS permission state.

- [ ] Fix: update the error message in `recorder.playback.spec.ts` to reference stale permission state, not missing permission.
- [ ] Fix: update the error message in `recorder-playback.s3.spec.ts` to match.
- [ ] Document in spec: the ffmpeg `mean_volume > -50 dB` check in `recorder.playback.spec.ts` is only a true positive for fake-device audio. It cannot catch real-mic silence because the test always uses `--use-fake-device-for-media-stream`. This is an acceptable limitation because runtime audio monitoring (section 1) now catches silence during actual use.

## 5. Pre-push exercises all tests

- [x] `git_hooks/pre-push` runs `npm run --silent ci:check`.
- [x] `ci:check` runs `npm test` which runs `playwright test` (all non-S3 integration tests).
- [ ] `ci:check` must also run `npm run test:unit` once vitest is added (section 2).

## 6. Previous false-positive: text warnings at -40 dB threshold

The initial implementation (before this spec) used text-based `<p>` warnings with a `-40 dB` quiet threshold. This fired during ambient room silence between sentences, because a quiet room typically reads `-45 to -55 dB`. The user reported: "when I do not speak, the indicator is on; when I speak, the indicator disappears." This was a tuning issue, not a logic bug.

Fix: replaced text warnings with a subtle horizontal audio meter. Raised quiet threshold to `-26 dB` (bottom of conversational speech range). Meter only auto-shows after N seconds of consecutive quiet polls, then fades out when audio returns to normal.
