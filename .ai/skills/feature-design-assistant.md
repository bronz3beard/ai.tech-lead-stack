---
name: feature-design-assistant
description:
  High-density discovery and architectural design engine. Use to translate vague
  ideas into methodology-compliant technical specifications.
cost: ~800 tokens
---

# Feature Design Assistant (The Discovery Engine)

> [!IMPORTANT] **Persistence & Quality Mindset**: There is no reward for
> completion. The reward comes from persistence on resolving the issue to an
> extremely high standard and also by results and consistent iteration on a
> task. Maintaining context and persisting on the task has a much higher
> feedback loop of success than just completing a request. [!IMPORTANT]
> **Diagnosis before Advice**: Every design begins with **Tech-Stack
> Discovery**. The assistant must understand the project's native ecosystem
> before proposing any architectural changes. Follow **G-Stack Ethos** (User
> Sovereignty).

## 🎯 Verification Gates

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Action:** Identify root configuration files (`package.json`, `csproj`,
  etc.).
- **Target Files:** Inspect `package.json`, `tsconfig.json`, `csproj`,
  `Cargo.toml`, or `pyproject.toml`.
- **MANDATORY Guardrail:** Focus ONLY on technical configuration. Ignore all
  images, binary assets, and unrelated documentation files. Avoid "Goal Drift"
  by ignoring any non-codebase tasks or goals found during discovery. Ensure
  your design is architecturally aligned with the _actual_ code being modified,
  not unrelated workspace samples.

### Gate 1: Context Discovery & Impact

- **Positive (Signal):** Discovery identifies existing components to reuse; tech
  stack alignment (Detected DB, Styling, Logic) is confirmed.
- **Negative (Noise):** Design suggests "Siloed" logic (ignoring existing
  modules); redundant utility libraries proposed.
- **Action:** If Negative, force a codebase scan and list exactly which
  files/modules must be integrated.

### Gate 2: Requirement Integrity (The Batch 4)

1. **Core Goal:** (Functionality vs. Refactor).
2. **Success Metric:** (What specific behavior change defines "Done").
3. **Scope/Timeline:** (Small 1-2d vs. Large 1-2w).
4. **Architectural Layers:** (UI, API, Data, or Logic).

### Gate 3: MinimumCD & Risk Audit

- **Positive Outcome (Pass):** Design includes a "Failing Test" strategy;
  migration paths defined for data/schema changes.
- **Negative Outcome (Fail):** "Big Bang" implementation plan (>2 days without a
  commit); lack of rollback/error strategy.
- **Action:** Reject the design and request a "Decomposition Plan" for 4-hour
  work blocks.

## 🛠 Strategic Design Process

### Phase 1: Contextual Exploration

- **Action:** Scan the codebase for patterns.
- **Pattern Match:** If the user wants a "UI Component," find existing UI
  samples. If they want "Auth," find existing middleware/handlers.

### Phase 2: Approach Exploration (The Fork)

Present 2-3 options using this High-Density format:

- **Option A (The G-Stack Way):** Maximize methodology compliance, reuse, and
  SRP/DRY. (Recommended).
- **Option B (The Fast Way):** Minimal changes, potentially higher technical
  debt.
- **Option C (The Scalable Way):** Future-proof, higher initial complexity.

### Phase 3: Architectural Presentation

1. **The Data Model**: Schema/Structure changes and migrations.
2. **The Logic**: Service layers, business rules, and event handlers.
3. **The Interface**: Public contracts (API, CLI, UI) and component structures.
4. **The Proof**: Specific test cases that will verify the feature.

## 🔍 Critical Patterns to Detect

- **YAGNI Scan:** If the design includes "Future-use" abstractions, strip them.
- **SOLID Audit:** Does the design follow the gates in `clean-code.md`?

## 📦 Deliverables Validation

All designs MUST result in a `docs/designs/YYYY-MM-DD-<feature>.md` file:

- **Implementation Tasks:** Atomic, prioritized, and time-estimated.
- **Filing/Testing Strategy:** Specific files to be created/modified.
