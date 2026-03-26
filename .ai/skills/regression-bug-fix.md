---
name: regression-bug-fix
description:
  Unified Remediation Engine for resolving Design Review (DR), QA, and
  Regression feedback.
cost: ~1300 tokens
---

# Regression & Feedback Fix (The Remedy Engine)

> [!IMPORTANT] **Persistence & Quality Mindset**: Deep research into the
> original requirement is the ONLY way to prevent regression of the fix.
>
> [!IMPORTANT] **Telemetry Tracking**: To maintain high-integrity metrics, you
> MUST provide accurate `projectName`, `model`, and `agent` when calling
> `get_skills` to retrieve this skill. Accurate telemetry is CRITICAL for
> performance and reliability tracking.

## 🎯 Unified Remediation Loop

### Step 1: Impact Analysis

- **Action:** Map feedback (QA/DR) to existing code.
- **Verification:** Identify if the issue is a "New Bug" or a "Missed
  Requirement."
- **Outcome:** Minimal `remediation_plan.md`.

### Step 2: Implementation (G-Stack Alignment)

- **Action:** Apply fixes using standard G-Stack tokens.
- **Constraint:** Use `rtk` to minimize context noise.

### Step 3: Regression Test (Chain: code-review-checklist)

- **Action:** Run `code-review-checklist` to ensure the fix hasn't introduced
  new issues.
- **Outcome:** Capture verification evidence for the PR.

## 🛠 Outcome Actions

- **Deliver:** Success notification once the feedback is resolved and verified.
- **Chain:** Switch back to `mission-architect` if the fix requires structural
  re-architecture.
