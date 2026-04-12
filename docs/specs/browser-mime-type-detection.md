# Tech Spec: Browser MIME Type Detection

- [x] Proceed from top to bottom

## Observe Mobile Camera Recording

- [x] Observe iOS Chrome cannot record with `video/webm` MIME type
- [x] Observe iOS Safari cannot record with `video/webm` MIME type

## Observe Steps of Mobile Camera Recording

- [x] iPhone Chrome failed to upload a video
- [x] The server did not log any warning
- [x] Only if verbose logging is enabled
- [ ] Log client steps to the server log
- [x] log each step in each branch of code
- [x] Log from start recording to upload confirmed
- [x] The log messages should isolate the cause of not uploading
- [x] The log messages should reproduce steps to test
- [x] The log messages should fully inform an undiscovered test case

## MediaRecorder MIME Type Test Cases

- [ ] iOS Safari (14.5+): Expect `video/mp4` or `video/mp4;codecs=avc1`
- [ ] iOS Chrome/Edge: Expect `video/mp4` (WebKit engine requirement)
- [ ] Android Chrome: Expect `video/webm` or `video/webm;codecs=vp9,opus`
- [x] Desktop Chrome: Expect `video/webm` (or `video/mp4` in v121+)
- [ ] Desktop Firefox: Expect `video/webm` or `video/webm;codecs=vp8,opus`
- [ ] Desktop Safari: Expect `video/mp4` or `video/mp4;codecs=avc1`
- [ ] Audio-Only (iOS): Expect `audio/mp4`

## MIME Type Detection Implementation

- [ ] Audio-Only (Android/PC): Expect `audio/webm;codecs=opus`
- [x] Create prioritized `const mimeTypes` array (WebM first for Chrome, MP4 for Safari).
- [x] Use `MediaRecorder.isTypeSupported()` to iterate and find the first match.
- [x] Include specific codecs like `video/webm;codecs=vp9,opus` for optimization.
- [x] Fallback to `video/mp4` specifically for iOS/WebKit compatibility.
- [x] Implement a null-check fallback to browser default if no array types match.
- [x] Verify `recorder.mimeType` post-instantiation to log the actual format used.
- [x] Add a try/catch block around `new MediaRecorder()` for incompatible configurations.
- [x] Integrate camera recording to use the detected MIME type.