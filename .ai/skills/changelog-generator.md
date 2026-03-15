---
name: changelog-generator
description:
  High-density semantic changelog processor. Transforms Git history into
  user-facing release notes with strict noise filtering.
---

# Changelog Generator (Semantic Processor)

## 🎯 Verification Gates

### Gate 1: Commit Noise Filtering (Positive/Negative Scan)

- **Positive (Elevate):** Commits starting with `feat:`, `fix:`, `perf:`, or
  containing user-impact keywords (e.g., "Interface," "Speed," "Dashboard").
- **Negative (Discard):** Commits starting with `chore:`, `refactor:`, `test:`,
  `docs:`, or messages like "wip," "checkpoint," "cleanup."
- **Action:** Explicitly strip all Negative Outcome commits from the final
  output.

### Gate 2: Technical Translation

- **Positive Outcome (Pass):** Technical terms are mapped to benefits (e.g.,
  "Implemented WebSocket" → "Real-time updates").
- **Negative Outcome (Fail):** Output contains internal jargon, database table
  names, or developer-only context.
- **Action:** If Negative, force a re-translation focused on the "Value
  Proposition" from `product-strategist.md`.

### Gate 3: Formatting & Structure

- **Positive Outcome (Pass):** Adheres to "Keep a Changelog" standards; uses
  Emojis for quick scannability; groups by Category.
- **Negative Outcome (Fail):** Single list of bullets; lacks version headers;
  inconsistent formatting.
- **Action:** Re-format using the standardized Markdown template provided below.

## 🔍 Critical Patterns to Detect

### 1. Breaking Changes

- **Pattern:** Commits containing `BREAKING CHANGE:` or `!`.
- **Action:** Move to the top under a 🚨 **Breaking Changes** header with
  remediation instructions.

### 2. Contributor Attribution

- **Action:** (Optional) Map commit hashes to GitHub profiles if the `gh` CLI is
  available.

## 🛠 Execution Workflow (Pattern Mapping)

### Step 1: Git Ingestion

- Run `git log --oneline --since="7 days ago"` (or specific range).
- Group by semantic commit type (Conventional Commits).

### Step 2: Semantic Categorization

| Category            | Keywords / Triggers                          |
| :------------------ | :------------------------------------------- |
| **✨ Features**     | `feat`, `new`, `added`                       |
| **🔧 Improvements** | `perf`, `refactor` (if user-impactful), `ui` |
| **🐛 Fixes**        | `fix`, `resolved`, `patched`                 |

## 📦 Deliverable Template

```markdown
# [Version/Date]

## ✨ New Features

- **[Feature Name]**: [Customer-benefit description].

## 🔧 Improvements

- [Internal improvement translated to user value].

## 🐛 Fixes

- [Plain English description of the resolved issue].
```
