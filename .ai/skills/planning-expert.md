---
name: planning-expert
description:
  Lightweight Research, Strategic Planning, and Task Decomposition. Optimized
  for rapid day-to-day tasks and minor features.
cost: ~475 tokens
---

# Planning Expert (The Precise Architect)

> [!TIP] **RTK Methodology**: Use `rtk` tokens for maximum efficiency. Focus on
> the "Minimal Viable Change" (MVC) to avoid architectural bloat.

## 🎯 Strategic Workflow

### Phase 1: Rapid Research (Optional)

- **Action:** Quickly scan the codebase using `grep_search` or `list_dir` to
  identify the target module's constraints.
- **Outcome:** Minimal `research_notes.md` (only if context is missing).

### Phase 2: Implementation Blueprint

- **Action:** generate a concise `implementation_plan.md`.
- **Constraint:** Must follow G-Stack (React 19, Next.js App Router, Tailwind).
- **Mandatory:** Include a "Rollback Strategy" even for minor changes.

### Phase 3: Atomic Decomposition

- **Action:** Break the plan into `task.md` items.
- **Standard:** Each task item must be <100 lines and link to its verification
  step.

## 🛠 Outcome Actions

- **Deliver:** `task.md` and start the first task boundary.
- **Guardrail:** If the task reveals high complexity, escalate to
  `mission-architect`.
