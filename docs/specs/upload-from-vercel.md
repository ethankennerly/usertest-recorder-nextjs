# Upload from Vercel or Dev

## Steps to Reproduce

- Configure Vercel logs for verbose recorder logs
- Load production on Vercel
- https://usertest-recorder-nextjs.vercel.app/
- Load development on localhost
- http://localhost:3000
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
- Force quit the browser app
- Check S3 bucket for camera recording upload `npm run s3:sync`
- Check PostHog session replay
- Check Vercel logs for verbose recorder logs

## Expected Result

- No error message is shown in the browser
- New camera recording uploads to S3 and is visible in the bucket
- PostHog session replay shows screen and clicks

## Actual Result

- Log message "blob empty, skipping upload"

## Verbose Recorder Logs

- temp/upload-server-error/*.*

## Analysis

- Vercel production: presigned-upload 500
- CredentialsProviderError: no AWS env vars
- AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY missing
- Dev HTTPS MacBook Air: buildFinalBlob: 0 bytes
- Fast Refresh re-ran lifecycle effect
- Cleanup called rec.stop() (async onstop queued)
- Effect body called start() clearing chunksRef
- Stale onstop read empty chunksRef

## Action Items

- [x] Analyze logs
- [x] Research pro solutions
- [x] Add additional logs to narrow down issue
- [ ] Add AWS env vars to Vercel project settings
- [x] Guard stale onstop with gen check
- [x] Nullify handlers in lifecycle cleanup
- [x] Log chunk count in buildFinalBlob
- [x] Add try-catch to presigned-upload route
- [x] Verify pre-push passes