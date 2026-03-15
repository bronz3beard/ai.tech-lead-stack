---
name: code-review-checklist
description:
  High-density code review auditor. Enforces functionality, security,
  performance, and G-Stack standards via pattern-based verification.
---

# Code Review Checklist (The Auditor)

## 🎯 Verification Gates

### Gate 1: Strategic Alignment & Logic

- **Positive (Signal):** Code directly resolves the task described in the PR;
  edge cases (null, empty, error) are handled via Guard Clauses.
- **Negative (Noise):** "Happy path" only logic; logical fallacies (off-by-one,
  improper recursion); missing error boundaries.
- **Action:** If Negative, trigger `planning-expert` to re-verify the
  implementation plan.

### Gate 2: Security & Data Integrity

- **Positive (Verified):** Parameterized queries; input validation at the entry
  point; environment variables for secrets.
- **Negative (Risk):** String interpolation in SQL/Commands; hardcoded API keys;
  raw user input rendered to DOM (XSS risk).
- **Action:** Immediately run `security-audit` and block PR approval.

### Gate 3: Structural Quality (SOLID & Clean)

- **Positive Outcome (Pass):** Adheres to `clean-code.md` gates (SRP, DRY,
  KISS); intent-revealing names; small, focused functions.
- **Negative Outcome (Fail):** "God Functions"; deep nesting (>2 levels);
  duplication that adds maintenance burden.
- **Action:** Request "Refactoring for Maintainability" based on SOLID
  principles.

### Gate 4: Performance & Optimization

- **Positive (Verified):** Optimized loops; indexed DB queries; efficient memory
  usage.
- **Negative (Risk):** N+1 query problems; unnecessary re-renders; memory leaks
  in event listeners.
- **Action:** Flag for performance profiling if logic handles large datasets.

### Gate 5: Test & Documentation

- **Positive Outcome (Pass):** New code has 100% coverage for logic paths;
  `CHANGELOG.md` is updated via `changelog-generator.md`.
- **Negative Outcome (Fail):** Tests missing for edge cases; "Magic" logic
  without "Why" comments; outdated README.
- **Action:** Block PR until tests pass and documentation is synchronized.

## 🔍 Critical Patterns to Detect

### 1. The "Ghost Dependency" Scan

- **Detect:** Imports of libraries not defined in `package.json` or
  `requirements.txt`.
- **Action:** Add missing dependencies or remove the import.

### 2. The "Semantic Review" Pattern

- **Action:** Don't just check if the code _runs_; check if the naming reflects
  the _Product Strategy_ (referencing `product-strategist.md`).

## 🛠 Execution Workflow (RTK Integration)

| Step          | Tool / Action                                         |
| :------------ | :---------------------------------------------------- |
| **1. Ingest** | Read PR Diff and `agents.md` context.                 |
| **2. Audit**  | Run `rtk run gatekeeper` and `rtk run security-scan`. |
| **3. Verify** | Run `python3 scripts/verify-stack.sh`.                |
| **4. Report** | Use the "Comment Template" below for feedback.        |

## 📝 Review Comment Template

```markdown
### 🔍 Code Review: [Feature/Fix Name]

#### ❌ Blockers

- **[Gate Name]**: [Specific file:line] - [Description of Positive/Negative
  failure].
- **Suggested Fix**: [Code snippet or refactor instruction].

#### ⚠️ Suggestions

- [Improvement for readability or future-proofing].

#### ✅ Passes

- [List of verified gates].
```
