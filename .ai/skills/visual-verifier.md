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
  authenticated. Run `rtk run visual-verifier [URL]` to capture evidence.

### Gate 2: Workflow Continuity

- **Positive (Pass):** Evidence reflects the implemented code change and is
  uploaded to GitHub storage for the PR report.
- **Action:** Re-run capture on explicitly modified routes to ensure visual
  parity.

---

## Workflow

1. **Local Test**: Run the app locally using the project's detected dev script.
2. **Capture**:
   - Run `rtk run visual-verifier [URL1] [URL2] ...` from the project root.
   - **MANDATORY Resolutions**:
     - **Desktop**: 1920x1080
     - **Tablet**: 768x1024
     - **Mobile**: 375x667
3. **Execution & Proof of Work**:
   - Capture screenshots using the specified resolutions.
   - Use `rtk run github-upload <REPO_URL> <FILE_PATH>` to upload captured
     screenshots to GitHub storage and retrieve permanent Markdown URLs.
   - **MANDATORY**: If `github-upload` fails with "command not found" or "no
     such file", do NOT search the filesystem. **STOP** and report to the user
     that the Tech-Lead Stack uploader is missing.
4. **Validation**: Confirm "Smoke Test Passed" once visual parity is confirmed
   across all viewports.
