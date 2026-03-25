---
name: agent-optimizer
description:
  Precision tool for Token-Efficiency, Context Density Management, and Noise
  Reduction. Enforces the RTK (Rust Token Killer) methodology.
cost: ~500 tokens
---

# Agent Optimizer (The Noise Filter)

> [!IMPORTANT] **RTK GOLDEN RULE**: Always prefix commands with `rtk`. If RTK
> has a dedicated filter, it uses it. If not, it passes through unchanged. This
> is the primary method for maintaining context health.

## 🎯 Efficiency Gates

### Gate 1: Context Hygiene (The "Brain" Scan)

- **Positive (Signal):** Agent only has relevant files open; minimal terminal
  backlog; search queries are targeted; strictly uses `rtk` wrappers for all CLI
  tools.
- **Negative (Noise):** Opening large directories without filters; redundant
  `cat` or `ls -R` calls; ignoring the `RTK` instruction in `CLAUDE.md`.
- **Action:** If context is polluted, use `rtk cleanup` or close non-essential
  documents/terminals.

### Gate 2: Token-Optimized Execution (RTK Audit)

- **Positive (Verified):** All commands use `rtk` (e.g., `rtk next build`,
  `rtk vitest`); output is summarized or error-only.
- **Negative (Risk):** Raw execution of high-verbosity tools (e.g.,
  `npm install` without `rtk`); massive log dumps; uncompressed diffs.
- **Action:** Intercept high-verbosity commands. Re-run with the appropriate
  `rtk` filter to save 60-90% tokens.

### Gate 3: Structural Granularity

- **Positive Outcome (Pass):** Large files are edited in chunks
  (`multi_replace_file_content` over `write_to_file`); complex tasks are
  decomposed into atomic sub-tasks (< 100 lines per commit).
- **Negative Outcome (Fail):** Overwriting entire files for minor changes;
  pursuing monolithic "mega-tasks" that exceed context limits.
- **Action:** Force a "Decomposition Spike" via `mission-architect`.

## 🛠 Outcome Actions

- **On Approval:** Apply `rtk` filters and commit atomic diffs.
- **On Bloom:** If the agent's context exceeds 80% of its working limit, trigger
  a "Checkpoint Summary" and start a fresh session.

## RTK Reference (MinimumCD standard)

| Category         | Command Wrapper      | Typical Savings |
| :--------------- | :------------------- | :-------------- |
| **Tests**        | `rtk test <cmd>`     | 90-99%          |
| **Build**        | `rtk next build`     | 87%             |
| **Git**          | `rtk git diff`       | 80%             |
| **Search/Files** | `rtk ls`, `rtk read` | 60-75%          |

## Objective

To maintain maximum agent performance and accuracy by minimizing noise and
optimizing token consumption during complex developer workflows.
