# Tech Spec: Harden Record Camera Logic

## Process

- [x] Proceed from top to bottom
- [x] Research limitations of Vercel such as file size
- [x] Research limitations of mobile
- [x] Research limitations of Chrome
- [x] Research limitations of Mac
- [x] Research limitations of Windows
- [x] Research 3 pro solutions
- [x] Research 16 edge cases
- [x] Add undiscovered edge cases to this tech spec

## Clarify Permissions

- [x] Bottom of screen already has a status message
- [x] If user did not give permission, show each permission not given:
    - [x] "Camera is NOT recording."
    - [x] "Microphone is NOT recording."

## Reduce Recording Overhead

- [x] Record directly from browser to S3
- [x] Reduce bitrate for less client overhead
- [x] Reduce bitrate for smaller upload

## Any Condition to Upload

- [x] On any of the following conditions, stop recording and upload

### Upload On Game Session Ended

React to any event that might end a game session:

- [x] Unity quit event
- [x] Recorder page unload
- [x] Navigation away from game page
- [x] Game page unload
- [x] Game exit
- [x] Browser quit
- [x] Browser tab close
- [x] Browser refresh

### Upload On Size or Time

- [x] Estimated recording size exceeds 20 MB
- [x] Estimated recording time exceeds 20 seconds

## Upload

- [x] Upload the recording to S3 directly

### After Upload Success

- [ ] If the upload is in progress, wait
- [ ] If the upload failed, then do nothing
- [ ] If the total duration of all recordings sums to 15 minutes or longer, do nothing
- [x] If the browser page is closed, then do nothing
- [x] If none of the above conditions, then start a new recording

## Edge Cases

- [x] Permission revocation or device disconnect mid-recording
- [ ] iOS Safari only supports MP4, not WebM
- [ ] Tab backgrounding throttles timeslice callbacks
- [ ] Screen lock revokes camera on mobile
- [ ] Empty blob from rapid start/stop
- [ ] S3 presigned URL expiry on long recordings
- [ ] Codec negotiation fallback chain
- [ ] Network failure retry with backoff
