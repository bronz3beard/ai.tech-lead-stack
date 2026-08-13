---
name: visual-verifier
description: >
  Performs smoke testing, captures media evidence, and compares renders against
  the Figma design source for any web environment.
cost: ~450 tokens
modes: [read-only, write, mcp]
surface: public
---

# Visual Verifier

## Runtime modes

Produces a verifiable visual blueprint in read-only chat, and executes +
verifies the verification phase in an IDE/MCP agent.

**Persistence & Quality Mindset**: There is no reward for completion. The reward
comes from persistence on resolving the issue to an extremely high standard and
also by results and consistent iteration on a task.

> [!IMPORTANT] **Diagnosis before Advice**: Every verification begins with
> **Tech-Stack Discovery**. Identify the project's dev command, port, and
> authentication requirements before capturing evidence.
>
> **Methodology Alignment**: This skill strictly adheres to the four core
> pillars: **G-Stack Ethos**, **MinimumCD**, **Agent Skills**, and **Modern Web
> Guidance**.

## 🎯 Verification Gates

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is
    strictly prohibited.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which
    may be prefixed as `mcp_tech-lead-stack_get_skills` or
    `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

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
  authenticated. Attempt `rtk run visual-verifier [URL]` first; if that tool is
  unavailable, use the **Antigravity Fallback** (Step 3 in workflow below).

### Gate 2: Workflow Continuity

- **Positive (Pass):** Evidence reflects the implemented code change and is
  uploaded to GitHub storage for the PR report.
- **Action:** Re-run capture on explicitly modified routes to ensure visual
  parity.

### Gate 3: Design Fidelity Comparison (when a design source exists)

Capturing evidence proves the app renders; it does NOT prove the render matches
the design. When a Figma node/URL exists for the captured screen, this skill
must compare, not just capture.

- **Action:** Fetch the corresponding Figma frame via the Figma MCP
  `get_figma_data` tool, then compare it against the captured Desktop render.
  _(Note: The Figma fetch and recorded measurements are a PLAN-TIME requirement
  owned by `design-system-review` Gate 4; `visual-verifier` compares the
  rendered result against those already-recorded numbers)._
- **Compare:** container/card width, column widths + gaps, element placement,
  vertical rhythm, and responsive reflow of sub-elements (helper text, lists,
  labels).
- **Positive (Pass):** Captured render matches the frame on all the above; note
  "Design Fidelity: MATCH" in the evidence report.
- **Negative (Fail):** Any mismatch — record it as a DEVIATION with the frame's
  target vs the built value. A DEVIATION means the change is NOT visually
  verified; report it and hand back for fix.
- **Escalation:** For a full itemised Layout Deviation Report and the blocking
  2-iteration guard, defer to `design-system-review` (Gate 4: Layout Fidelity).
  This skill performs the capture + first-pass comparison;
  `design-system-review` owns the authoritative blocking layout gate.

> [!CAUTION] Prose layout words ("side by side", "wider") are consequences of
> building to the frame, not the spec. Verify against the frame, not the words.

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
     `.ai/evidence/<feature-branch>/`.
4. **Publish & Verify**:
   - Handled via `publish-evidence` and `verify-evidence`.
   - **Path A (Public Repo)**: Pushes screenshots to
     `pr/evidence-<project-name>` using Git Data API (no worktree checkouts),
     constructs permanent raw URLs pinned to a commit SHA, and verifies them
     anonymously.
   - **Path B (Private Repo / No Push)**: Skips publishing and leaves images in
     `.ai/evidence/<feature-branch>/` for local drag-and-drop.
5. **Validation**:
   - **Path A**: Confirm "Smoke Test Passed" once visual parity is confirmed
     across all viewports and raw URLs verify successfully anonymously.
   - **Path B**: Provide handoff block for local evidence attachment.
   - **Important**: Evidence images never leave the target repository.
     `upload-evidence.mjs` is strictly forbidden from this flow.
