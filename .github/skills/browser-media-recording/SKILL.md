---
name: browser-media-recording
description: "Use when: recording video/audio from browser, MediaRecorder API, WebM playback issues, fixing WebM duration, seekable WebM, camera recording, getUserMedia recording. Expertise in browser MediaRecorder limitations and workarounds."
---

# Browser Media Recording

## Known Issue: MediaRecorder produces unplayable WebM

Chrome/Firefox `MediaRecorder` API outputs WebM files **without duration metadata**.
These files:
- Show duration as 0 or N/A
- Display only one frame in most players
- Cannot be seeked
- Are not technically corrupt — they just lack the EBML Duration element

This is a **confirmed Chromium bug** (open since 2015):
- https://bugs.chromium.org/p/chromium/issues/detail?id=642012
- https://bugs.chromium.org/p/chromium/issues/detail?id=561606

## Solution: Fix duration client-side before upload

Use `@fix-webm-duration/fix` (9KB, MIT, 300+ stars):

```typescript
import { fixWebmDuration } from "@fix-webm-duration/fix";

// Track start time when recording begins
const startTime = Date.now();
recorder.start(250);

// In onstop, compute duration and fix the blob
recorder.onstop = async () => {
  const duration = Date.now() - startTime;
  const rawBlob = new Blob(chunks, { type: "video/webm" });
  const fixedBlob = await fixWebmDuration(rawBlob, duration, { logger: false });
  // Upload fixedBlob, not rawBlob
};
```

## Three reference projects

1. **fix-webm-duration** (github.com/yusitnikov/fix-webm-duration)
   - Parses EBML structure, injects Duration element into Segment/Info
   - 9KB, zero heavy dependencies
   - Used by: `@fix-webm-duration/fix`

2. **RecordRTC** (github.com/muaz-khan/RecordRTC)
   - `getSeekableBlob()` global function fixes seekability post-recording
   - Internally rewrites EBML Cues and Duration
   - 380KB, full recording abstraction layer

3. **ts-ebml** (github.com/legokichi/ts-ebml)
   - Full EBML encoder/decoder, `ts-ebml -s` CLI to make WebM seekable
   - Can also fix via: `ffmpeg -i input.webm -c copy output.webm` (server-side)
   - 2.4MB, heavy but complete

## Validation: how to test that a WebM is playable

```typescript
// Use ffprobe with -v quiet to suppress benign WebM warnings
const { stdout } = await execFileAsync("ffprobe", [
  "-v", "quiet",
  "-count_frames",
  "-select_streams", "v:0",
  "-show_entries", "stream=nb_read_frames",
  "-of", "csv=p=0",
  filePath
]);
const frameCount = parseInt(stdout.trim(), 10);
expect(frameCount).toBeGreaterThan(1);

// Check duration exists
const { stdout: jsonOut } = await execFileAsync("ffprobe", [
  "-v", "quiet",
  "-show_entries", "format=duration",
  "-of", "json",
  filePath
]);
const duration = parseFloat(JSON.parse(jsonOut).format?.duration ?? "0");
expect(duration).toBeGreaterThan(0);
```

## Common mistakes to avoid

- **Do NOT rely on `ffprobe -v error` stderr being empty.** WebM from MediaRecorder
  always produces benign "Unknown-sized element" messages. Use `-v quiet` and check
  structured output instead.
- **Do NOT assume fake-device Playwright recordings reproduce real-camera bugs.**
  Fake devices complete getUserMedia instantly; real cameras take 200-500ms. Race
  conditions only manifest with real latency.
- **Do NOT skip the duration fix.** Every browser (Chrome, Firefox, Edge) has this bug.
  It has been open for 10+ years and is unlikely to be fixed.
- **Do NOT confuse "no ffprobe errors" with "playable."** A file with 0 duration and
  100 frames will show zero errors but only display one frame in most players.
