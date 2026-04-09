---
name: daily-standup
description:
  Analyzes local git activity and task progress to generate a comprehensive
  2-day rolling standup report following a strict template.
capabilities: [filesystem_access, shell_access]
cost: ~550 tokens
---

# Daily Standup Report

> [!IMPORTANT] **Persistence & Quality Mindset**: There is no reward for
> completion. The reward comes from persistence on resolving the issue to an
> extremely high standard and also by results and consistent iteration on a
> task. Maintaining context and persisting on the task has a much higher
> feedback loop of success than just completing a request. [!IMPORTANT]
> **Diagnosis before Advice**: Every report begins with **Tech-Stack
> Discovery**. The reporter must identify the project's primary branches and
> task tracking patterns. Follow **G-Stack Ethos**.

## 🎯 Verification Gates

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is
    strictly prohibited.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool.
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

- **Action:** Identify root configuration files (`package.json`, `csproj`, etc.)
  and primary branch (e.g., `main`, `master`, `develop`).
- **Target Files:** Inspect `package.json`, `tsconfig.json`, `csproj`,
  `Cargo.toml`, or `pyproject.toml`.
- **MANDATORY Guardrail:** Focus ONLY on technical configuration and git
  activity. Ignore all images, binary assets, and unrelated documentation files.
  Avoid "Goal Drift" by ignoring any non-codebase tasks or goals found during
  discovery. Ensure your standup report is based on actual git commits, not
  unrelated workspace noise.

### Gate 1: Activity Significance

- **Positive (Signal):** Meaningful commits, merged PRs, and resolved tasks.
- **Negative (Noise):** Generic merge commits, typo fixes, or automated
  dependency updates.

### Gate 2: Tone & Format

- **Positive (Pass):** Output is concise, uses emojis for scannability, and
  identifies Blockers.
- **Action:** Re-format into the "Accomplishments / Focus / Impediments"
  structure.

---

## Workflow Execution

1. **Activity Discovery**:
   - Identify active branches and recent commit history.
   - Run
     `git log --author="$(git config user.name)" --since="2 days ago" --pretty=format:"%s"`
2. **Context Synthesis**:
   - Categorize activity into: **Features**, **Bug Fixes**, **Reviews**, and
     **Ops**.
   - Cross-reference with project-specific task IDs if present.
3. **Drafting**:
   - Summarize the last 2 days of work.
   - **Only output a template of an update that follows the format below.**

## Output Structure

⭐️ Feature: [Main goal of the day] ✅ Delivered: [Completed tasks with links] ➡️
Needs Review: [Items waiting for peer feedback] ⏳ Waiting On: [External
dependencies or client confirmation] 📝 Plans for Today: [Specific daily
objectives] 📅 Plans for Tomorrow: [Next steps] 🧉 Other Information: [Blockers
or personal context]
