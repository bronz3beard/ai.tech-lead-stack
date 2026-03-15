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
- **Action:** If the target element is hidden/loading, inject explicit wait
  states (`await page.waitForSelector`) and retry capture.

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
   - Screenshot 1: Desktop (1920x1080) of the modified feature.
   - Screenshot 2: Mobile (iPhone 14 emulation) of the modified feature.
3. **Proof of Work**:
   - **ClickUp**: Use `scripts/upload-evidence.py` to attach media to the
     relevant task.
   - **GitHub**: Provide the public image URLs for the `pr-automator` to use.
4. **Validation**: Confirm "Smoke Test Passed" once visual parity is confirmed
   across both viewports.
