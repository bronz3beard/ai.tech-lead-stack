---
name: qa-remediation
description:
  High-integrity orchestration for resolving QA feedback using G-Stack and
  MinimumCD principles.
capabilities: [web_browsing, filesystem_access, rtk_execution]
cost: ~730 tokens
---

# QA Remediation (Orchestrator)

> [!IMPORTANT] **Persistence & Quality Mindset**: There is no reward for
> completion. The reward comes from persistence on resolving the issue to an
> extremely high standard and also by results and consistent iteration on a
> task. Maintaining context and persisting on the task has a much higher
> feedback loop of success than just completing a request.

## Objective

To resolve QA feedback through a rigorous, automated pipeline that ensures the
fix is G-Stack compliant and verified via Continuous Integration (MinimumCD).

## 🎯 Verification Gates

### Gate 1: Ingestion & Impact Analysis

- **Positive Outcome (Signal):** Feedback is mapped to specific lines of code;
  Regression Test Strategy is defined.
- **Negative Outcome (Noise):** Vague remediation (e.g., "trying a different CSS
  class"); missing automated test plan.
- **Action:** If Negative, halt and run `planning-expert` with `--strict` flag.

### Gate 2: Implementation Integrity

- **Positive Outcome (Clean):** Fix is atomic; uses G-Stack components; passes
  `./.ai/rtk-run run eval`.
- **Negative Outcome (Dirty):** Fix introduces "ghost dependencies"; breaks
  existing snapshots; uses `!important` or inline styles.
- **Action:** Reject commit. Refactor using G-Stack design tokens.

### Gate 3: Visual Proof

- **Positive Outcome (Verified):** Screenshots match the Figma/Task specs in
  both Desktop and Mobile views.
- **Negative Outcome (Unverified):** Evidence is missing or resolution is
  incorrect.
- **Action:** Re-run `scripts/upload-evidence.py` and block PR creation.

## Core Principles

- **G-Stack Consistency**: All fixes must use the established tech stack
  (Postgres, Tailwind, etc.) to prevent architectural drift.
- **MinimumCD**: No fix is complete without an automated test. Small, atomic
  commits are mandatory.
- **Agentic Proof**: Visual evidence must be provided for UI/UX remediation.

## Workflow Execution

1. **Analysis & Ingestion**:
   - Access the QA task via URL or provided text.
   - Cross-reference the feedback with current code patterns to ensure alignment
     with existing G-Stack logic.
2. **Chain: planning-expert**:
   - Generate a `remediation_plan.md`.
   - **Crucial**: The plan MUST include a "Regression Test Strategy" to ensure
     the fix doesn't break existing features.
3. **Execution (The Fix)**:
   - Implement the fix in the smallest possible diff.
   - Use `rtk` to execute local dev servers and verify the fix
     manually/automatically.
4. **Chain: quality-gatekeeper**:
   - Run `./.ai/rtk-run run eval`.
   - Ensure the remediation meets the "Extreme Prejudice" review standard—no
     console logs, no bypasses.
5. **Chain: visual-verifier**:
   - Capture Desktop and Mobile proof.
   - Run `./.ai/rtk-run run upload` to post the evidence directly to the QA
     ticket.
6. **Chain: pr-automator**:
   - Update the PR description to include a "QA Remediation" section, linking
     the evidence and the test results.

## Outcome

A "Green" build that has been visually verified, architecturally reviewed, and
documented for the team.
