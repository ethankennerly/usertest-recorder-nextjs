# Record from Vercel

## Steps to Reproduce

- Configure Vercel logs for verbose recorder logs
- Load production on Vercel
- https://usertest-recorder-nextjs.vercel.app/
- Allow camera and microphone permissions
- Observe "Choose a game"
- Click game button
- Unity loads game
- Click other buttons in the game
- Click X button to exit game
- Observe "Choose a game"
- Click game button
- Unity loads game
- Click other buttons in the game
- Click X button to exit game
- Observe "Choose a game"
- Click game button
- Unity loads game
- Click other buttons in the game
- Force quit the browser app
- Check S3 bucket for camera recording upload `npm run s3:sync`
- Check PostHog session replay
- Check Vercel logs for verbose recorder logs

## Expected Result

- No error message is shown in the browser
- New camera recording uploads to S3 and is visible in the bucket
- PostHog session replay shows screen and clicks

## Actual Result

- For MacBook Air, browser message said "Failed to upload" "status 413"
- For iPhone, browser showed no message
- No new camera recording is found in the S3 bucket

## Verbose Recorder Logs

- MacBook Air Chrome log: Start Time: 2026-04-12T14:21 UTC
- iPhone Chrome log: Start Time: 2026-04-12T14:30 UTC
- temp/recording-not-found-on-s3/usertest-recorder-nextjs-log-export-2026-04-12T14-34-37.csv

## Action Items

- [ ] Analyze logs
- [ ] Research pro solutions
- [ ] Add additional logs to narrow down issue