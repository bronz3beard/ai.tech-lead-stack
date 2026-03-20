---
name: visual-verifier
description:
  Performs smoke testing and uploads media evidence to ClickUp/GitHub.
---

# Visual Verifier

## 🎯 Verification Gates

### Gate 1: Checkpoint Integrity

- **Positive (Verified):** App is running locally. Output captures both Desktop
  (1920x1080) and Mobile (iPhone 14) resolutions perfectly.
- **Negative (Unverified):** Screenshots capture a 404/blank page, or the UI is
  completely cropped/broken.
- **Action:** Ensure the app is running (e.g., `npm run dev`) AND authenticated.
  Run `./.ai/rtk-run run visual-verifier http://localhost:3000/path` to capture
  evidence. If the target element is hidden/loading, the script will wait, but
  ensure the server is reachable and you are logged in.

### Gate 2: Workflow Continuity

- **Positive (Pass):** Evidence accurately reflects the implemented code change
  and is uploaded cleanly to ClickUp/GitHub.
- **Negative (Fail):** Upload script fails or the captured feature is completely
  unrelated to the git diff.
- **Action:** Re-run capture on the explicitly modified routes, halting the
  `pr-automator` chain until visual proof passes.

## Workflow

1. **Local Test**: Run the app locally (e.g., `npm run dev`).
2. **Capture**:
   - Run `rtk run visual-verifier [URL1] [URL2] ...` from any project directory.
   - The tool will automatically resolve the script from the Tech-Lead Stack.
   - Captures Desktop (1920x1080) and Mobile (iPhone 14) full-page screenshots
     for each URL.
3. **Proof of Work**:
   - Screenshots are saved to `.github/evidence/`.
   - **ClickUp**: Use `rtk run upload [TASK_URL] [FILE_PATH]` if manual upload
     is needed.
4. **Validation**: Confirm "Smoke Test Passed" once visual parity is confirmed
   across both viewports.
