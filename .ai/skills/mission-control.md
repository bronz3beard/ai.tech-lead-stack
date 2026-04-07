---
name: mission-control
description:
  High-integrity pre-flight diagnostic to verify environment, tools, and skill
  dependencies.
capabilities: [filesystem_access, rtk_execution, shell_access]
cost: ~615 tokens
---

# Mission Control (Pre-Flight Check)

> [!IMPORTANT] **Persistence & Quality Mindset**: There is no reward for
> completion. The reward comes from persistence on resolving the issue to an
> extremely high standard and also by results and consistent iteration on a
> task. Maintaining context and persisting on the task has a much higher
> feedback loop of success than just completing a request.

## 🎯 Verification Gates

### Gate 1: Environment Readiness

- **Positive (GO):** Found valid `.env`, authenticated GitHub CLI (`gh`), and
  accessible browser profile path.
- **Negative (ABORT):** Missing `.env` variables or `gh auth status` fails.
- **Action:** Immediately halt processes and print the exact bash command the
  user needs to run to fix it.

### Gate 2: Agent Skill Integrity

- **Positive (GO):** All mandatory `.ai/skills/*.md` files are readable and
  `rtk list` successfully maps to scripts.
- **Negative (ABORT):** Core skills missing, or `rtk.tools` configuration in
  `package.json` is broken/missing.
- **Action:** Halt the mission-control scan and instruct the user to run the
  `install.sh --link .` reset.

## Objective

To ensure the local environment is fully operational and that the "Agent Brain"
has all required skill modules loaded to prevent orchestration failures.

## Workflow Execution

### 1. Skill Discovery (The Brain)

Verify that all core skill modules are present in the `.ai/skills/` directory.
The agent must "read" these into context before proceeding:

- [ ] `planning-expert.md`
- [ ] `accessibility-auditor.md`
- [ ] `quality-gatekeeper.md`
- [ ] `pr-automator.md`
- [ ] `visual-verifier.md`
- [ ] `qa-remediation.md` (Orchestrator)

### 2. Environment Integrity (The ID)

- **.env Verification**: Check for `.env` in the toolbox root.
- **Path Validation**: Verify `CHROME_PROFILE_PATH` exists on the local
  filesystem.
- **Auth Status**: Run `gh auth status` to ensure a valid GitHub session.

### 3. Execution Layer (The Hands)

- **RTK Check**: Run `rtk list` and verify the mapping for:
  - `eval` -> `scripts/autoeval-check.js`
  - `create-pr` -> `scripts/gh-pr-create.sh`
  - `upload` -> `scripts/upload-evidence.py`
  - `cleanup` -> `scripts/cleanup.sh`

### 4. Dependency Audit (The Vitals)

- **Python**: Check if `playwright` and `dotenv` are importable.
- **Playwright**: Check if the Chromium binary is installed
  (`npx playwright install --dry-run`).

## Outcome

- **GO**: "All systems operational. Skills mapped. Tools verified. Mission is a
  GO."
- **ABORT**: "Pre-flight failure detected in [Section Name]. Please run
  `lead-init` or address the following: [List of missing items]."
