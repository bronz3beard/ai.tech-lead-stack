---
name: visual-verifier
description:
  Performs smoke testing and uploads media evidence to ClickUp/GitHub.
---

# Visual Verifier

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
