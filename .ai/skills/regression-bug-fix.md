---
name: regression-bug-fix
description:
  Unified Remediation Engine for resolving Design Review (DR), QA, and
  Regression feedback.
cost: ~1350 tokens
---

# Regression & Feedback Fix (The Remedy Engine)

> [!IMPORTANT] **Diagnosis before Advice**: Every fix begins with **Tech-Stack
> Discovery**. Deep research into the original requirement is the ONLY way to
> prevent regression of the fix. Follow **G-Stack Ethos**.

## 🎯 Unified Remediation Loop

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is
    strictly prohibited.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool.
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

- **Action:** Identify root configuration files (`package.json`, `csproj`,
  etc.).
- **Target Files:** Inspect `package.json`, `tsconfig.json`, `csproj`, `go.mod`,
  or `Cargo.toml`.
- **MANDATORY Guardrail:** Focus ONLY on technical configuration. Ignore all
  images, binary assets, and unrelated documentation files. Avoid "Goal Drift"
  by ignoring any non-codebase tasks or goals found during discovery. Ensure
  your remediation is based on the actual bug context, not unrelated workspace
  samples.

### Step 1: Impact Analysis

- **Action:** Map feedback (QA/DR) to existing code.
- **Verification:** Identify if the issue is a "New Bug" or a "Missed
  Requirement."
- **Outcome:** Minimal `remediation_plan.md`.

### Step 2: Implementation (Methodology Alignment)

- **Action:** Apply fixes using standard **RTK tokens**.
- **Constraint:** Adhere to detected ecosystem patterns (e.g., proper error
  handling for the framework).

### Step 3: Regression Test (Chain: code-review-checklist)

- **Action:** Run `code-review-checklist` to ensure the fix hasn't introduced
  new issues.
- **Outcome:** Capture verification evidence for the PR.

## 🛠 Outcome Actions

- **Deliver:** Success notification once the feedback is resolved and verified.
- **Chain:** Switch back to `mission-architect` if the fix requires structural
  re-architecture.
