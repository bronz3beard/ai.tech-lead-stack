---
name: pm-context-summarizer
description:
  Summarize recent technical progress and blockers for non-technical briefings.
  Extracts business value from developer commit logs.
cost: ~550 tokens
---

# PM Context Summarizer (The Briefing Engine)

> [!IMPORTANT] **G-Stack Methodology**: Every summary begins with **Tech-Stack
> Discovery**. The agent must understand the "Product Architecture" to correctly
> categorize technical changes into high-level value categories. Follow
> **MinimumCD** by highlighting atomic delivery wins.

## 🎯 Verification Gates (Value Extraction)

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Action**: Detect the core product features via `src/app` or
  `src/components`.
- **Target Files**: `package.json`, `README.md`, or main navigation components.

### Gate 1: Technical-to-Value Mapping

- **Positive (Signal):** Successfully mapped a technical refactor (e.g.,
  "Updated Prisma types") to a product benefit (e.g., "Improved data reliability
  and faster reporting").
- **Negative (Noise):** Generic commit messages (e.g., "fix", "updated files")
  that provide no context.
- **Action:** If Negative, scan PR descriptions associated with the commits for
  deeper "Product Intent."

### Gate 2: Blocker Detection

- **Positive (Pass):** Identified specific technical hurdles (e.g., "Hydration
  errors in the dashboard") that translate to "UX Delay."
- **Negative (FAIL):** Missing context on why work is stalled.

## 📋 Outcome Actions

- **Deliver**: A "Stakeholder Ready" summary focusing on **Momentum**,
  **Blockers**, and **Upcoming Wins**.
- **Ethos**: Persistence on Clarity. Never provide a list of file names; provide
  a list of _achievements_.
