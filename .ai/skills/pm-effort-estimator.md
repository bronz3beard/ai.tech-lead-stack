---
name: pm-effort-estimator
description:
  Estimate development effort based on codebase history and complexity. Uses
  historical churn to provide data-driven velocity predictions.
cost: ~650 tokens
---

# PM Effort Estimator (The Historical Oracle)

> [!IMPORTANT] **G-Stack Methodology**: Every estimation begins with
> **Tech-Stack Discovery**. The agent must identify the "Churn Level" of target
> files before predicting delivery timelines. Follow **MinimumCD** by breaking
> large estimates into small, verifiable effort batches.

## 🎯 Verification Gates (Velocity Prediction)

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool.
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

- **Action:** Identify the target module's complexity (Total Lines, Churn
  Frequency).
- **Tool Mapping**: Run
  `git log --pretty=format: --name-only | sort | uniq -c | sort -rg | head -20`
  to find hot files.

### Gate 1: Dependency & Blast Radius

- **Positive (Signal):** The change is localized to a well-tested, low-churn
  area.
- **Negative (Noise):** The change touches "God Objects" or fragile legacy
  modules with low test coverage.
- **Action:** If Negative, increase the "Complexity Risk Score" by 40%.

### Gate 2: Historical Pattern Matching

- **Positive (Pass):** Similar features in the past were completed within a
  predictable pattern.
- **Negative (Fail):** The target area has high "Structural Debt" (e.g., deeply
  nested components).

## 📊 Estimation Process

### 1. The Complexity Scan (The Brain)

- Audit the target files for logical density and integration points.

### 2. The Churn Check (The Vitals)

- Check git history to see if this area of the code is "Fragile" (frequent bug
  fixes).

## 📋 Outcome Actions

- **Deliver**: A T-Shirt size estimate (S, M, L, XL) with a "Technical
  Reasoning" summary.
- **Ethos**: No gut feelings. Every estimate must be backed by a "Why" derived
  from the code's current state.
