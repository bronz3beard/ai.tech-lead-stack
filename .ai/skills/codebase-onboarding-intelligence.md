---
name: codebase-onboarding-intelligence
description:
  Exhaustive discovery auditor for developer onboarding. Extracts tech stack,
  git culture, environment setup, and implementation patterns.
---

# Codebase Onboarding Intelligence (The Master Discovery)

## 🎯 Verification Gates

### Gate 1: Stack & Documentation (The Source)

- **Positive (Signal):** Detects exact versions; provides **Specific
  Implementation Links**.
- **Negative (Noise):** Generic homepage links; missing environment-specific
  setup docs.
- **Action:** Scrape `.env.example`, `README`, and `CONTRIBUTING.md` for
  internal deep-links.

### Gate 2: Local Vitals & Environment (The First Build)

- **Positive (Signal):** Identifies `dev` scripts, Docker configs, and database
  migration/seeding commands.
- **Negative (Noise):** Missing local secrets management strategy (e.g., where
  to find the real `.env`).
- **Action:** Identify "Time-to-First-Hello-World" by mapping setup steps
  (Install -> Migrate -> Seed -> Start).

### Gate 3: Git & Workflow Culture (The Rules)

- **Branch Management:** Scan for `Trunk-based` vs `GitFlow`. Identify Merge
  Strategy (`Rebase` vs `Merge`).
- **Naming Conventions:** Detect branch regex (e.g., `feat/`, `fix/`,
  `user/task-id`).
- **Commit Structure:** Detect **Prefixes** (`feat:`, `fix:`) and
  **Title/Body/Footer** structure.

### Gate 4: Implementation Patterns (The "How-To")

- **Architecture:** Detect **API-First** vs **UI-First**. Identify UI pattern
  (Atomic, Page-based, etc.).
- **Shared Code:** Locate the "Source of Truth" for Global Types, Helpers, and
  Design System tokens.

## 🔍 Mandatory Extraction Checklist

### 1. Technology DNA & Setup

- [ ] **Main Stack:** Languages, Frameworks, Runtimes.
- [ ] **Local Run:** Exactly how to start the app and run migrations/seeds.
- [ ] **Secrets:** How are dev secrets shared (1Password, `.env.vault`, manual
      copy)?

### 2. Architectural Principles

- [ ] **SOLID/Clean Code:** Enforcement patterns for `clean-code.md`.
- [ ] **Error/State:** Standardized try/catch wrappers and Server vs. Local
      state management.

### 3. Git, DevOps & Comm Culture

- [ ] **Workflow:** Strategy name + Naming regex + Commit format
      (Title/Body/Footer).
- [ ] **CI/CD:** What scripts run on push? (Referencing `.github/workflows`).
- [ ] **Communication:** Where does the team talk? (Slack, ClickUp, GitHub
      Comments).

## 🛠 Execution Workflow

| Step              | Discovery Action                                                  |
| :---------------- | :---------------------------------------------------------------- | ------------------------------------------- |
| **Culture Audit** | `./.ai/rtk-run run git-parse` (Extracts real branch/commit data). |
| **Local Audit**   | `cat package.json                                                 | grep -A 10 "scripts"` (Finds entry points). |
| **Import Audit**  | `grep -r "import" src/` (Maps shared code).                       |

## 📦 The "Day One" Onboarding Report

### 🏗️ Tech Stack & Implementation Docs

- **[Technology Name]**: [Version] | [Link to Specific Implementation Docs]

### 🚀 Getting Started (Local Environment)

- **Start Command**: `[Command]`
- **DB Setup**: [How to migrate and seed data]
- **Secrets**: [Where to get the .env file]

### 🌳 Git & Workflow Culture

- **Branch Strategy**: [Trunk-based / GitFlow] | [Rebase / Merge]
- **Branch Naming**: `regex-pattern`
- **Commit Format**: [Title/Body/Footer structure + Prefix list]

### 🎨 Patterns & Shared Code

- **UI Implementation**: [How to build a UI component to match]
- **Shared Utilities**: Located in `[Path]`
- **API vs UI First**: This repo is [Type] because [Reasoning]

### 💬 Team & Best Practices

- **Comm Channels**: [Slack/ClickUp/Discord]
- **Do's & Don'ts**: [List of project-specific standards found in code]
