# Prevent Repeatedly Load Game

## Steps To Reproduce

- Open Choose a game page
- Click on a game to load it
- Exit the game using the (X) button
- Click on a game to load it
- Exit the game using the (X) button
- Click on a game to load it
- Exit the game using the (X) button

## Expected Result

- [x] No unexpected toasts reappear
- [x] Prevent this reloading problem
- [x] Remove the feature that would close and return to Choose a game
- [x] Instead, the (X) button will stop and upload
- [x] And will force close the web page
- [x] Not redirect or navigate back
- [x] The page is a terminal page
- [x] Do not cache the Unity game or source
- [x] Eliminate all risks of leaks
- [x] Eliminate unload state mismanagement
- [x] Prevent whatever was causing the bug

## Actual Result

- [x] iPhone Chrome repeatedly dropped down toast from top of screen
- [x] Toast: "Camera permission is allowed"
- [x] Toast distracted user
- [x] After first game exit, dialog requesting camera and microphone appeared again
- [x] iPhone Chrome on second click of game button shows "Loading games..." grey screen and then shows "Choose a game" again
- [x] iPhone Chrome on third click of game button shows "Loading... 63%" then crashes: "Can't open this page"

## Diagnosis Process

- [x] Logs pasted from the open terminal
- [x] iPhone repeated steps and errors. No change to bugs
- [x] Diagnose
- [x] Strictly follow: [.github/copilot-instructions.md](../../.github/copilot-instructions.md)
- [x] Added verbose logs to page.tsx, unity-player.tsx, unity-exit.ts
- [x] Captured 3-cycle console logs in temp/game-reload-diag/console.log
- [x] Desktop Chromium: all 3 cycles complete without error
- [x] exitUnity: unloaded ok each cycle
- [x] No "Loading games..." re-shown in desktop Chromium
- [x] Hypothesis "memory leak" disproved: no leak log observed
- [x] iPhone Chrome logs captured in temp/game-reload-diag/iphone-session.log
- [x] iPhone logs show full page reload after first exit: gen reset to 1, config re-fetched
- [x] No pagehide, beforeunload, or error logged before reload
- [x] Added webglcontextlost and visibilitychange logs for next iPhone test

## Analysis

- "Loading games..." is a full page reload, not React state loss
- iPhone log shows startRecording gen 1 restarting after first exit
- Config re-fetched confirms entire app re-mounted
- No error or crash log before reload
- iOS may be killing the page due to WebGL memory pressure
- Hypothesis: webglcontextlost triggers iOS page reload

## Missing QA Steps

- [ ] Reproduce on iPhone Chrome with webglcontextlost log
- [ ] Read logs to confirm or disprove webglcontextlost
- [ ] If disproved, add more logs to narrow down

## Fix

- [x] Extract acquireStream to reuse live MediaStream
- [x] onRecorderStop stops tracks only on unmount, not restart
- [x] setupTrackEndHandlers extracted to recorder-media.ts
- [x] createRecorder extracted to recorder-media.ts
- [x] Integration test: recorder.stream-reuse.spec.ts
- [x] lib/unity-exit.ts: exitUnity awaits unload before onBack
- [x] unity-player.tsx: back button calls exitUnity
- [x] Integration test: game-reload.spec.ts verifies 3 cycles

