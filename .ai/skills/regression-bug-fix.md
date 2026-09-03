---
name: regression-bug-fix
description: >
  Unified Remediation Engine for resolving Design Review (DR), QA, and
  Regression feedback.
cost: ~1350 tokens
modes: [read-only, mcp]
surface: public
category: Build & Fix
how:
  'Maps feedback to code impact, generates a localized remediation plan, and
  verifies the fix against regressions.'
useCase:
  'Fixing "Login button misaligned" or "API returning 500" after a QA pass.'
phase: build
kind: skill
domain: eng
ownership:
  drive: human-ai
  approve: human
targets: [local, api, subscription]
minModelClass: small
consumes: [plan]
emits: [diff]
requires: [code-review-checklist]
suggests: [code-review-checklist, pr-automator, mission-architect]
---

# Regression & Feedback Fix (The Remedy Engine)

## Runtime modes

Produces a verifiable regression blueprint in read-only chat, and executes +
verifies the fix phase in an IDE/MCP agent.

> [!IMPORTANT] **Diagnosis before Advice**: Every fix begins with **Tech-Stack
> Discovery**. Deep research into the original requirement is the ONLY way to
> prevent regression of the fix.
>
> **Methodology Alignment**: This skill strictly adheres to the four core
> pillars: **G-Stack Ethos**, **MinimumCD**, **Agent Skills**, and **Modern Web
> Guidance**.

## 🎯 Unified Remediation Loop

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is
    strictly prohibited.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which
    may be prefixed as `mcp_tech-lead-stack_get_skills` or
    `tech-lead-stack_get_skills` depending on client prefixing).
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
