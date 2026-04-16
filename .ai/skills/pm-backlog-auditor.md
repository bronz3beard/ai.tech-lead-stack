---
name: pm-backlog-auditor
description:
  Validate project backlog for logical consistency and feasibility. Detects
  circular dependencies and missing technical prerequisites.
cost: ~650 tokens
---

# PM Backlog Auditor (The Logic Gate)

> [!IMPORTANT] **G-Stack Methodology**: Every backlog audit begins with
> **Tech-Stack Discovery**. The agent must map backlog items to the current
> codebase state to verify feasibility. Follow **MinimumCD** by ensuring tasks
> are ordered in small, sequential logic blocks.

## 🎯 Verification Gates (Feasibility & Flow)

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Action**: Audit the root `task.md` or provided backlog against the project
  structure.
- **Goal**: Check if the "System Primitives" (DB, Auth, core APIs) exist for the
  listed tasks.

### Gate 1: Pre-requisite Logic

- **Positive (Signal):** Tasks are ordered logically (e.g., Schema -> API ->
  UI).
- **Negative (Noise):** UI tasks listed before their data-source is defined.
- **Action**: Flag order violations as "Blocking Dependency" risks.

### Gate 2: Scope Creep Detection

- **Positive (Pass):** Every task has a clear boundary and maps to a single
  "Value Unit."
- **Negative (FAIL):** Tasks that attempt to solve multiple unrelated problems
  simultaneously.

## 📋 Outcome Actions

- **Deliver**: A "Backlog Integrity Report" with a revised, logically-optimal
  task order.
- **Ethos**: Logical Rigor. A backlog that ignores technical prerequisites is a
  roadmap to failure.
