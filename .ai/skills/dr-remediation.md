---
name: dr-remediation
description: Orchestrates architectural updates based on Design Review feedback.
capabilities: [filesystem_access, rtk_execution, reasoning]
---

# Design Review Remediation (Orchestrator)

## Objective

To implement architectural changes requested during Design Review while
maintaining G-Stack integrity and system stability.

## Workflow

1. **DR Ingestion**:
   - Analyze the Design Review document or comments.
   - Identify "Structural" vs "Style" changes.
2. **Chain: planning-expert**:
   - Generate an `architectural_update_plan.md`.
   - Ensure the plan accounts for breaking changes and migration paths.
3. **Execution**:
   - Refactor code to meet the new design specifications.
   - Ensure G-Stack patterns (e.g., specific DB schemas or Component structures)
     are strictly followed.
4. **Chain: quality-gatekeeper**:
   - Run `rtk run eval`.
   - High scrutiny on "Architectural Drift"—verify the refactor actually meets
     the DR goals.
5. **Chain: pr-automator**:
   - Update the PR with a "Design Review Updates" section.
   - Detail exactly which DR points were addressed and how.

## Outcome

A refactored codebase that satisfies architectural requirements without
introducing technical debt.
