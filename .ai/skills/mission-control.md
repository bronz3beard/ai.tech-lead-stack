---
name: mission-control
description:
  High-integrity pre-flight diagnostic to verify environment, tools, and skill
  dependencies.
capabilities: [filesystem_access, rtk_execution, shell_access]
---

# Mission Control (Pre-Flight Check)

## Objective

To ensure the local environment is fully operational and that the "Agent Brain"
has all required skill modules loaded to prevent orchestration failures.

## Workflow Execution

### 1. Skill Discovery (The Brain)

Verify that all core skill modules are present in the `.ai/skills/` directory.
The agent must "read" these into context before proceeding:

- [ ] `planning-expert.md`
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
