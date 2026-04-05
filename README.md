# User Test Recorder with NextJS and Unity

A NextJS server records screen, camera, and microphone of a Unity web game.

## Overview

- S3 bucket: Authorize NextJS to download a Unity web game
- S3 bucket: Authorize browser to upload video
- NextJS env: Authorize Posthog 
- NextJS env: Authorize S3
- NextJS env: Configure Unity web game to show
- NextJS server: Fetch presigned URL from S3
- NextJS server: Send browser link to download
- NextJS server: Send browser presigned URL to upload video
- NextJS server: Configure Posthog to record screen
- Browser: Request permission to record camera and audio
- Browser: Load Unity web game with progress bar
- Browser: Prompt to click to start
- Browser: Display Unity web game
- Browser: Upload video to S3
