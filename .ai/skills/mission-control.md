---
name: mission-control
description:
  High-integrity pre-flight diagnostic to verify environment, tools, and skill
  dependencies.
capabilities: [filesystem_access, rtk_execution, shell_access]
cost: ~650 tokens
---

# Mission Control (Pre-Flight Check)

> [!IMPORTANT] **Persistence & Methodology**: The reward comes from persistence
> on resolving the issue to an extremely high standard. Every mission begins
> with verifying the **G-Stack Environment**.

## 🎯 Verification Gates

### Gate 1: Environment Readiness

- **Positive (GO):** Found valid `.env`, authenticated tool CLIs (e.g., `gh`),
  and essential project configuration files.
- **Negative (ABORT):** Missing `.env` variables or auth failures.
- **Action:** Immediately halt processes and print the exact bash command the
  user needs to run to fix it.

### Gate 2: Tech-Stack Discovery (Ecosystem Detection)

- **Action:** Detect the primary project language and build system
  (`package.json`, `csproj`, `go.mod`, etc.).
- **Validation:** Ensure the detected stack is supported by the available RTK
  tools.

### Gate 3: Agent Skill Integrity

- **Positive (GO):** All mandatory `.ai/skills/*.md` files are readable and
  `rtk run list` successfully maps to scripts.
- **Negative (ABORT):** Core skills missing, or `rtk.tools` configuration is
  broken.

---

## Workflow Execution

### 1. Skill Discovery (The Brain)

Verify that all core skill modules are present in the `.ai/skills/` directory.

### 2. Environment Integrity (The ID)

- **Environment Verification**: Check for `.env` or required secrets.
- **Auth Status**: Run `gh auth status` or equivalent for the project's VCS.

### 3. Execution Layer (The Hands)

- **RTK Check**: Run `rtk run list` and verify the mapping for core scripts.

### 4. Dependency Audit (The Vitals)

- **Runtime**: Verify the primary runtime version (Node, Python, .NET, etc.).
- **Tools**: Check if required CLI tools (Playwright, Git, etc.) are installed.

## Outcome

- **GO**: "All systems operational. Ecosystem detected. Mission is a GO."
- **ABORT**: "Pre-flight failure detected. Please run lead-init or address
  missing items."
