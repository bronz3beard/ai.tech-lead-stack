---
name: codebase-onboarding-intelligence
description:
  Exhaustive discovery auditor for developer onboarding. Extracts tech stack,
  environment setup, and implementation patterns.
cost: ~1100 tokens
---

# Codebase Onboarding Intelligence (The Master Discovery)

> [!IMPORTANT] **Diagnosis before Advice**: Every onboarding begins with **Phase
> 0: Tech-Stack Discovery**. The auditor must identify the primary engine and
> configuration patterns before deep-diving into vitals. Follow **G-Stack
> Ethos**.

## 🎯 Verification Gates

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Action:** Identify root configuration files (`package.json`,
  `pyproject.toml`, `csproj`, etc.).
- **Goal:** Determine the core language, framework, and dependency management to
  contextualize all subsequent gates.

### Gate 1: Stack & Documentation (The Source)

- **Positive (Signal):** Detects exact versions; provides specific
  implementation links from `README` or `CONTRIBUTING` docs.
- **Action:** Scrape `.env.example`, `CONTRIBUTING.md`, and manifest files.

### Gate 2: Local Vitals & Environment (The First Build)

- **Positive (Signal):** Identifies `dev` scripts, Docker configs, and database
  migration commands.
- **Action:** Map the "Time-to-First-Hello-World" path.

### Gate 3: Git & Workflow Culture (The Rules)

- **Positive (Signal):** Identifies branch strategy (Trunk-based vs GitFlow),
  naming regex, and commit prefix conventions.

### Gate 4: Implementation Patterns (The "How-To")

- **Positive (Signal):** Detects architectural style (API-First vs Monolith), UI
  patterns, and location of "Source of Truth" for types/utilities.

---

## 🔍 Mandatory Extraction Checklist

### 1. Technology DNA & Setup

- [ ] **Main Stack:** Languages, Frameworks, Runtimes.
- [ ] **Local Run:** Entry points for dev, build, and test.
- [ ] **Secrets:** Discovery of how development secrets are managed.

### 2. Architectural Principles

- [ ] **SOLID/Clean Code:** Detected enforcement patterns.
- [ ] **Error/State:** Standardized patterns for error handling and state.

### 3. Git & DevOps Culture

- [ ] **Workflow:** Strategy + Branch Naming + Commit Format.
- [ ] **CI/CD:** Overview of scripts triggered in `.github/` or `.gitlab/`.

---

## 🛠 Execution Workflow

1. **Ecosystem Audit**: `ls -F` and `cat` root config files.
2. **Culture Audit**: `rtk run git-parse` to extract branch/commit trends.
3. **Local Audit**: Inspect `scripts` or `Taskfile` for entry points.
4. **Pattern Audit**: `grep` for common imports/abstractions.

## 📦 The "Day One" Onboarding Report

### 🏗️ Tech Stack & Implementation Docs

- **[Technology]**: [Version] | [Implementation Note]

### 🚀 Getting Started (Local Environment)

- **Start Command**: `[Command]`
- **DB Setup**: [Migration/Seed instructions]
- **Secrets**: [Discovery source]

### 🌳 Git & Workflow Culture

- **Branch Strategy**: [Type] | [Naming Pattern]
- **Commit Format**: [Prefix conventions]

### 🎨 Patterns & Shared Code

- **Architecture**: [Type] | [Description]
- **Shared Utilities**: [Path]
- **Enforcement**: [How standards are maintained]
