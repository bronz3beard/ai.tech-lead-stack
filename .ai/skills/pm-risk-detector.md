---
name: pm-risk-detector
description:
  Identify technical risks and bottlenecks that could impact upcoming deadlines.
  Focuses on "Architectural Drift" and "God Object" detection.
cost: ~650 tokens
---

# PM Risk Detector (The Warning Signal)

> [!IMPORTANT] **G-Stack Methodology**: Every risk audit begins with
> **Tech-Stack Discovery**. The agent must identify the "Critical Path" modules
> before flagging bottlenecks. Follow **MinimumCD** by detecting early friction
> in small changes.

## 🎯 Verification Gates (Milestone Health)

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Action**: Map the core feature set to the file structure.
- **Goal**: Identify the "High Traffic" areas of the codebase.

### Gate 1: Structural Debt Audit

- **Positive (Signal):** Large files (>500 lines) with mixed responsibilities
  that touch multiple features.
- **Negative (Noise):** Minor linting issues that don't impact velocity.
- **Action**: Label high-traffic, low-quality files as "Milestone Blockers."

### Gate 2: Velocity Friction

- **Positive (Pass):** Detected areas where technical debt will slow down
  feature implementation (e.g., missing types, lack of reusable components).
- **Negative (Risk):** Dependencies on third-party APIs with high failure rates
  or slow responses.

## 📋 Outcome Actions

- **Deliver**: A "Risk Heatmap" report with clear GO/ABORT signals for the
  milestone.
- **Ethos**: Diagnosis before Advice. Focus on the _structural_ cause of the
  risk, not just the symptoms.
