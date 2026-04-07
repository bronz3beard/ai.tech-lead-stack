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

- **Action:** Identify root configuration files (`package.json`, `csproj`,
  etc.).
- **Goal:** Ensure the fix is natively compatible with the project's
  architectural patterns.

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
