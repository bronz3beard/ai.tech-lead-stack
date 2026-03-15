---
name: technical-debt-auditor
description:
  High-density structural and technical debt scanner. Produces quantified,
  prioritized remediation plans based on G-Stack and MinimumCD standards.
---

# Technical Debt Auditor (Health Scanner)

## 🎯 Verification Gates

### Gate 1: Marker & Dead Code (The Rot Scan)

- **Positive (Signal):** All `TODO/FIXME` markers are dated and assigned; zero
  unused exports; no commented-out code blocks.
- **Negative (Noise):** Undated/anonymous markers; "Ghost exports";
  commented-out logic > 2 lines.
- **Action:** If Negative, generate a "Cleanup Task" for immediate execution
  using `rtk run cleanup`.

### Gate 2: Complexity & Abstraction (The SOLID Scan)

- **Positive (Verified):** Files < 300 lines; functions < 20 lines; nesting
  depth <= 2.
- **Negative (Risk):** "God Classes" (>10 public methods); cyclomatic
  complexity > 10; violation of `clean-code.md` gates.
- **Action:** Trigger the `solid-auditor` gate and flag for refactoring in the
  Remediation Plan.

### Gate 3: Dependency & Config Integrity

- **Positive Outcome (Pass):** Dependencies are within one major version of
  current; `.env.example` matches actual usage.
- **Negative Outcome (Fail):** Stale/vulnerable packages; hardcoded secrets;
  pinned-to-old-major versions without justification.
- **Action:** Run `rtk run security-scan` and list specific update paths.

### Gate 4: Test & Coverage Gaps

- **Positive Outcome (Pass):** 1:1 mapping between source and test files;
  assertion density > 1 per 10 lines of logic.
- **Negative Outcome (Fail):** Untested critical paths; skipped tests; logic
  changes without corresponding `*.test.js`.
- **Action:** Block PR creation via `quality-gatekeeper` until coverage gaps are
  addressed.

## 🔍 Critical Patterns to Detect

### 1. The "Interest" Calculation (Severity)

- **Critical (8pts):** Vulnerabilities, broken tests, or upgrade-blockers.
- **High (4pts):** God objects, zero test coverage on core features.
- **Medium (2pts):** Old TODOs, moderate duplication.
- **Low (1pt):** Commented code, minor linting drift.

### 2. The ROI Remediation Logic

- **Action:** Prioritize fixes that are **High Severity + Trivial/Small
  Effort**. This is your "Quick Win" sprint.

## 🛠 Execution Layer (RTK Tool Mapping)

| Audit Phase       | RTK Command                                     |
| :---------------- | :---------------------------------------------- |
| **Tooling Check** | `rtk list` (Verify linters/formatters)          |
| **Logic Eval**    | `rtk run eval` (Check MinimumCD score)          |
| **Security Scan** | `rtk run security-scan` (Dependency debt)       |
| **Stack Verify**  | `python3 scripts/verify-stack.sh` (Config debt) |

## 📦 Report Template (Mandatory Structure)

1. **Executive Summary**: Quantified findings (Critical/High/Med/Low).
2. **Debt Heatmap**: Table of files sorted by "Debt Score."
3. **Remediation Plan**: Immediate (ROI prioritized) vs. Long-term.
4. **Metrics Summary**: Density markers (TODOs per 1K lines, Test Ratio).
