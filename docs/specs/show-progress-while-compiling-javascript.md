# Show Progress While Compiling JavaScript

## Steps to Reproduce

- Open Choose a game web page
- Click on a game to load it
- Observe Loading... 0%
- Observe Loading... 90%
- Observe Loading... 90%
- Wait up to one minute

## Expected Result

- Unity is compiling JavaScript
- Unity clamps progress that it reports at 90% while compiling
- [ ] Keep the "Loading... 90%" unmodified
- [ ] At 90% reveal a second progress message "Loading... 90%"
- [ ] Second line format starting with "Building... 0%"
- [ ] To fake progress increment building progress by 1% per second until reaching 90%
- [ ] At 90% increment 0.1% per second until 99.9%

## Actual Result

- "Loading... 90%" displays for up to 30 seconds
- User assumed game or page was frozen
- User closed browser before game displayed