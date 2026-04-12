# Tech Spec: Harden Record Camera Logic

## Process

- [ ] Proceed from top to bottom
- [ ] Research limitations of Vercel such as file size
- [ ] Research limitations of mobile
- [ ] Research limitations of Chrome
- [ ] Research limitations of Mac
- [ ] Research limitations of Windows
- [ ] Research 3 pro solutions
- [ ] Research 16 edge cases
- [ ] Add undiscovered edge cases to this tech spec

## Clarify Permissions

- [x] Bottom of screen already has a status message
- [x] If user did not give permission, show each permission not given:
    - [x] "Camera is NOT recording."
    - [x] "Microphone is NOT recording."

## Reduce Recording Overhead

- [x] Record directly from browser to S3
- [ ] Reduce bitrate for less client overhead
- [ ] Reduce bitrate for smaller upload
- 

## Any Condition to Upload

- [ ] On any of the following conditions, stop recording and upload

### Upload On Game Session Ended

React to any event that might end a game session:

- [ ] Unity quit event
- [ ] Recorder page unload
- [ ] Navigation away from game page
- [ ] Game page unload
- [ ] Game exit
- [ ] Browser quit
- [ ] Browser tab close
- [ ] Browser refresh

### Upload On Size or Time

- [ ] Estimated recording size exceeds 20 MB
- [ ] Estimated recording time exceeds 20 seconds

## Upload

- [ ] Upload the recording to S3 directly
- [ ] If the browser page is still open, start a new recording