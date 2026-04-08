---
name: visual-verifier
description:
  Performs smoke testing and captures media evidence for any web environment.
cost: ~450 tokens
---

# Visual Verifier

**Persistence & Quality Mindset**: There is no reward for completion. The reward
comes from persistence on resolving the issue to an extremely high standard and
also by results and consistent iteration on a task.

> [!IMPORTANT] **Diagnosis before Advice**: Every verification begins with
> **Tech-Stack Discovery**. Identify the project's dev command, port, and
> authentication requirements before capturing evidence. Follow **G-Stack
> Ethos**.

## 🎯 Verification Gates

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Action:** Identify root configuration files for dev scripts (e.g.,
  `package.json`, `Taskfile`, `Makefile`).
- **Target Files:** Inspect `package.json`, `tsconfig.json`, `Taskfile`,
  `Makefile`, or `docker-compose.yml`.
- **MANDATORY Guardrail:** Focus ONLY on technical configuration and dev
  scripts. Ignore all images, binary assets, and unrelated documentation files.
  Avoid "Goal Drift" by ignoring any non-codebase tasks or goals found during
  discovery. Ensure your verification is based on the actual app state, not
  unrelated workspace samples.

### Gate 1: Checkpoint Integrity

- **Positive (Verified):** App is running locally. Evidence captures
  **Desktop**, **Tablet**, and **Mobile** resolutions.
- **Negative (Unverified):** Screenshots capture a 404/blank page.
- **Action:** Ensure the app is running (using the detected dev command) AND
  authenticated. Attempt `rtk run visual-verifier [URL]` first; if that tool
  is unavailable, use the **Antigravity Fallback** (Step 3 in workflow below).

### Gate 2: Workflow Continuity

- **Positive (Pass):** Evidence reflects the implemented code change and is
  uploaded to GitHub storage for the PR report.
- **Action:** Re-run capture on explicitly modified routes to ensure visual
  parity.

---

## Workflow

1. **Local Test**: Run the app locally using the project's detected dev script.
2. **Capture** (Primary — RTK):
   - Run `rtk run visual-verifier [URL1] [URL2] ...` from the project root.
   - **MANDATORY Resolutions**:
     - **Desktop**: 1920x1080
     - **Tablet**: 768x1024
     - **Mobile**: 375x667
3. **Capture** (Fallback — Antigravity `browser_subagent`):
   - If `rtk run visual-verifier` is unavailable or returns "command not found",
     do **NOT STOP**. Use `browser_subagent` to navigate to each URL and capture
     screenshots at the three mandatory resolutions. Save outputs to
     `.github/evidence/<feature-branch>/`.
4. **Upload — Git Evidence Branch** (replaces `rtk run github-upload`):
   - Check out (or create) the branch `pr/evidence-<project-name>`.
   - Copy screenshots into `screenshots/<feature-branch>/`.
   - `git add . && git commit -m "docs(evidence): capture for <feature-branch>"`
   - `git push origin pr/evidence-<project-name>`
   - Construct permanent raw URLs:
     `https://raw.githubusercontent.com/<OWNER>/<REPO>/pr/evidence-<project-name>/screenshots/<feature-branch>/<viewport>.png`
   - Switch back to the original feature branch.
5. **Validation**: Confirm "Smoke Test Passed" once visual parity is confirmed
   across all viewports and raw URLs resolve successfully.
