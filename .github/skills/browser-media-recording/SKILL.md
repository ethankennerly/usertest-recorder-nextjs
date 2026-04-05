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
  conditions only manifest with real latency. Inject delay via `page.addInitScript`
  to simulate real hardware timing.
- **Do NOT skip the duration fix.** Every browser (Chrome, Firefox, Edge) has this bug.
  It has been open for 10+ years and is unlikely to be fixed.
- **Do NOT confuse "no ffprobe errors" with "playable."** A file with 0 duration and
  100 frames will show zero errors but only display one frame in most players.
- **Do NOT ignore EBML header count.** A WebM file with 2+ EBML headers contains
  concatenated recordings. Players only read the first segment. Always validate
  that uploaded files contain exactly 1 EBML header (`0x1A 0x45 0xDF 0xA3`).

## Known Issue: React useEffect double-mount + async getUserMedia race

When `reactStrictMode: true` (React 18+), `useEffect` runs twice in dev mode:
mount → cleanup → remount. If `startRecording` awaits `getUserMedia`, the
cleanup runs while `getUserMedia` is still in-flight. The remount calls
`startRecording` again. Both `getUserMedia` calls resolve, creating two
MediaRecorders that push chunks to the same shared ref. The result is a
single blob containing two concatenated WebM streams.

**Fix**: Use a generation counter ref. Increment before `getUserMedia`. After
it resolves, check if the generation is still current. If stale, stop the
stream and return.

```typescript
const startGenerationRef = useRef(0);

const startRecording = useCallback(async () => {
  const generation = ++startGenerationRef.current;
  // ... cleanup previous recorder ...
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  if (generation !== startGenerationRef.current) {
    stream.getTracks().forEach(t => t.stop());
    return; // stale — a newer startRecording has taken over
  }
  // ... proceed with MediaRecorder setup ...
}, []);
```

## Known Issue: Silent audio on macOS (getUserMedia succeeds but mic is blocked)

On macOS, `getUserMedia({audio: true})` can succeed and return a live audio track
even when the browser-OS permission handshake is in a stale state. The audio track
delivers only 8-byte Opus DTX silence packets (-91 dB). The recording appears to
work — opus codec is present, duration is valid — but playback is mute.

This was observed after Chrome mic permission was set to "Allow" but the OS-level
permission got into a bad state. Toggling Chrome permission from "Allow" → "Ask"
and re-granting it fixed the issue. The exact trigger is unknown.

**Runtime detection**: Use `AudioContext` + `AnalyserNode` to monitor RMS levels
during recording. Warn the user immediately if audio is silent (< -60 dB) or
too quiet for speech (< -40 dB).

**Post-hoc detection**: Use `ffmpeg -af volumedetect` to measure `mean_volume`.
Threshold:
- `-91 dB`: digital silence — mic is blocked or in stale permission state
- `-50 to -30 dB`: real ambient room noise — mic is working
- `~-21 dB`: Chromium fake device synthetic beep

**Automated test**: Assert `mean_volume > -50 dB`. This catches digital silence
while allowing quiet recordings from real microphones.

```typescript
const { stderr } = await execFileAsync("ffmpeg", [
  "-i", filePath, "-af", "volumedetect", "-f", "null", "/dev/null"
]);
const meanMatch = stderr.match(/mean_volume:\s*([-\d.]+)/);
const meanVolume = meanMatch ? parseFloat(meanMatch[1]) : -91;
expect(meanVolume).toBeGreaterThan(-50);
```

**Important**: Playwright tests with `--use-fake-device-for-media-stream` always
produce a beep tone at ~-21 dB. They CANNOT detect real microphone issues.
The fake device masks macOS permission problems.
