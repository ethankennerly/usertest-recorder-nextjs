# Tech Spec: Browser MIME Type Detection

- [ ] Proceed from top to bottom

## Observe Mobile Camera Recording

- [x] Observe iOS Chrome cannot record with `video/webm` MIME type
- [x] Observe iOS Safari cannot record with `video/webm` MIME type

## MediaRecorder MIME Type Test Cases

- [ ] iOS Safari (14.5+): Expect `video/mp4` or `video/mp4;codecs=avc1`
- [ ] iOS Chrome/Edge: Expect `video/mp4` (WebKit engine requirement)
- [ ] Android Chrome: Expect `video/webm` or `video/webm;codecs=vp9,opus`
- [ ] Desktop Chrome: Expect `video/webm` (or `video/mp4` in v121+)
- [ ] Desktop Firefox: Expect `video/webm` or `video/webm;codecs=vp8,opus`
- [ ] Desktop Safari: Expect `video/mp4` or `video/mp4;codecs=avc1`
- [ ] Audio-Only (iOS): Expect `audio/mp4`

## MIME Type Detection Implementation

- [ ] Audio-Only (Android/PC): Expect `audio/webm;codecs=opus`
- [ ] Create prioritized `const mimeTypes` array (WebM first for Chrome, MP4 for Safari).
- [ ] Use `MediaRecorder.isTypeSupported()` to iterate and find the first match.
- [ ] Include specific codecs like `video/webm;codecs=vp9,opus` for optimization.
- [ ] Fallback to `video/mp4` specifically for iOS/WebKit compatibility.
- [ ] Implement a null-check fallback to browser default if no array types match.
- [ ] Verify `recorder.mimeType` post-instantiation to log the actual format used.
- [ ] Add a try/catch block around `new MediaRecorder()` for incompatible configurations.
- [ ] Integrate camera recording to use the detected MIME type.