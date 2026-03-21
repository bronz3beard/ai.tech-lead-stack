---
name: feature-design-assistant
description:
  High-density discovery and architectural design engine. Use to translate vague
  ideas into G-Stack compliant technical specifications.
cost: ~700 tokens
---

# Feature Design Assistant (The Discovery Engine)

> [!IMPORTANT] **Persistence & Quality Mindset**: There is no reward for
> completion. The reward comes from persistence on resolving the issue to an
> extremely high standard and also by results and consistent iteration on a
> task. Maintaining context and persisting on the task has a much higher
> feedback loop of success than just completing a request.

## 🎯 Verification Gates

### Gate 1: Context Discovery & Impact

- **Positive (Signal):** Discovery identifies existing components to reuse; tech
  stack alignment (Postgres, Tailwind, etc.) is confirmed.
- **Negative (Noise):** Design suggests "Siloed" logic (ignoring existing
  modules); redundant utility libraries proposed.
- **Action:** If Negative, force a `codebase-scan` and list exactly which
  files/modules must be integrated.

### Gate 2: Requirement Integrity (The Batch 4)

Instead of hardcoded JSON widgets, use **Batch Logic** to extract these 4
critical data points from the user:

1. **Core Goal:** (Functionality vs. Refactor).
2. **Success Metric:** (What specific behavior change defines "Done").
3. **Scope/Timeline:** (Small 1-2d vs. Large 1-2w).
4. **Architectural Layers:** (UI, API, Data, or Logic).

### Gate 3: MinimumCD & Risk Audit

- **Positive Outcome (Pass):** Design includes a "Failing Test" strategy;
  migration paths are defined for data changes.
- **Negative Outcome (Fail):** "Big Bang" implementation plan (>2 days without a
  commit); lack of rollback/error strategy.
- **Action:** Reject the design and request a "Decomposition Plan" that fits
  4-hour work blocks.

## 🛠 Strategic Design Process

### Phase 1: Contextual Exploration

- **Action:** Scan the codebase for patterns.
- **Pattern Match:** If the user wants a "Table," find the existing Table
  component. If they want an "API," find the existing Auth middleware.

### Phase 2: Approach Exploration (The Fork)

Present 2-3 options using this High-Density format:

- **Option A (The G-Stack Way):** Maximize reuse, maintain SRP/DRY.
  (Recommended).
- **Option B (The Fast Way):** Minimal changes, potentially higher technical
  debt.
- **Option C (The Scalable Way):** Future-proof, higher initial complexity.

### Phase 3: Architectural Presentation

Present the design in 300-word "Sprints":

1. **The Data Model**: Schema changes and migrations.
2. **The Logic**: Service layers and business rules.
3. **The Interface**: API contracts and UI components.
4. **The Proof**: Specific test cases that will verify the feature.

## 🔍 Critical Patterns to Detect

- **YAGNI Scan:** If the design includes "Future-use" abstractions, strip them.
- **SOLID Audit:** Does the design follow the gates in `clean-code.md`?

## 📦 Deliverables Validation

All designs MUST result in a `docs/designs/YYYY-MM-DD-<feature>.md` file
including:

- **Implementation Tasks:** Atomic, prioritized, and time-estimated.
- **Filing/Testing Strategy:** Specific files to be created/modified.
