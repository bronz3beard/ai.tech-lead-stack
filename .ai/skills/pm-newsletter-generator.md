---
name: pm-newsletter-generator
description:
  Generate product-focused updates and highlights from recent code changes. Uses
  Conventional Commits to track feature narrative.
cost: ~650 tokens
---

# PM Newsletter Generator (The Narrative Architect)

> [!IMPORTANT] **G-Stack Methodology**: Every newsletter begins with
> **Tech-Stack Discovery**. The agent must map "The Churn" to "The Narrative" by
> identifying themes in the Conventional Commit history. Follow **MinimumCD** by
> highlighting the incremental delivery of value.

## 🎯 Verification Gates (Theme Discovery)

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Action**: Fetch git history for the target period.
- **Goal**: Identify the most active modules and their corresponding
  "Conventional Types" (`feat`, `fix`, `refactor`).

### Gate 1: Narrative Cohesion

- **Positive (Signal):** Successfully grouped individual commits into logical
  "Product Themes" (e.g., "Dashboard Overhaul", "Security Hardening").
- **Negative (Noise):** A chronological list of commits without a unifying
  story.
- **Action**: If Negative, search for "Feature Flags" or "PR Labels" to find the
  grouping logic.

### Gate 2: Tone & Engagement

- **Positive (Pass):** The newsletter celebration is balanced with technical
  transparency.
- **Negative (FAIL):** Over-hyping minor changes or using "Buzzwords" that don't
  match the code's reality.

## 📋 Outcome Actions

- **Deliver**: A drafted Newsletter highlighting **Key Features**,
  **Improvements**, and **The "Why"** behind the work.
- **Ethos**: Authenticity. If the team primarily fixed bugs, frame it as
  "Quality Hardening" rather than invent feature progress.
