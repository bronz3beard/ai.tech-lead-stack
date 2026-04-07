---
name: agent-optimizer
internal: true
description:
  Precision tool for Token-Efficiency, Context Density Management, and Noise
  Reduction. Enforces the RTK (Rust Token Killer) methodology.
cost: ~550 tokens
---

# Agent Optimizer (The Noise Filter)

> [!IMPORTANT] **RTK GOLDEN RULE**: Always prefix commands with `rtk run`. This
> is the primary method for maintaining context health. Follow **G-Stack
> Methodology**: Diagnosis before advice.

## 🎯 Efficiency Gates

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Action:** Identify root configuration files to define the "Context
  Boundary."
- **Target Files:** Inspect `package.json`, `tsconfig.json`, `csproj`,
  `Cargo.toml`, or `pyproject.toml`.
- **MANDATORY Guardrail:** Focus ONLY on technical configuration. Ignore all
  images, binary assets, and unrelated documentation files. Avoid "Goal Drift"
  by ignoring any non-codebase tasks or goals found in the workspace. Ensure
  your optimization is bound to the actual technical context.

### Gate 1: Context Hygiene (The "Brain" Scan)

- **Positive (Signal):** Agent only has relevant files open; minimal terminal
  backlog; strictly uses `rtk run` wrappers for all CLI tools.
- **Negative (Noise):** Opening large directories without filters; redundant
  `cat` or `ls -R` calls.
- **Action:** If context is polluted, use `rtk run cleanup` or close
  non-essential artifacts.

### Gate 2: Token-Optimized Execution (RTK Audit)

- **Positive (Verified):** All commands use `rtk run` (e.g., `rtk run test`,
  `rtk run build`); output is summarized or error-only.
- **Negative (Risk):** Raw execution of high-verbosity tools; massive log dumps;
  uncompressed diffs.
- **Action:** Intercept high-verbosity commands. Re-run with `rtk run` filters
  to save 60-90% tokens.

### Gate 3: Structural Granularity

- **Positive Outcome (Pass):** Large files are edited in chunks; complex tasks
  are decomposed into atomic sub-tasks.
- **Negative Outcome (Fail):** Overwriting entire files for minor changes.
- **Action:** Force a "Decomposition Spike" via `mission-architect`.

---

## 🛠 Outcome Actions

- **Efficiency:** Use `rtk run` for all potentially verbose operations.
- **Sustainability:** If context exceeds 80% limit, trigger a "Checkpoint
  Summary" and start a fresh session.

## RTK Reference (MinimumCD standard)

| Category         | Command Wrapper          | Typical Savings |
| :--------------- | :----------------------- | :-------------- |
| **Tests**        | `rtk run test <cmd>`     | 90-99%          |
| **Build**        | `rtk run build`          | 80-90%          |
| **Git**          | `rtk run git [args]`     | 80%             |
| **Search/Files** | `rtk run search [query]` | 60-75%          |
