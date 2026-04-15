---
name: pm-story-augmenter
description:
  Enhance user stories with technical depth and edge-case detection. Bridges the
  gap between product vision and technical feasibility.
cost: ~650 tokens
---

# PM Story Augmenter (The Precision Scraper)

> [!IMPORTANT] **G-Stack Methodology**: Every story discovery begins with
> **Tech-Stack Discovery**. The PM agent must understand the project's native
> constraints and existing logic patterns before suggesting augmentations.
> Follow **MinimumCD** by identifying the smallest verifiable logic gaps in a
> requirement.

## 🎯 Verification Gates (Product-Logic Alignment)

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct analysis without architectural context is prohibited.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool.
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

- **Action:** Identify existing modules that overlap with the story scope.
- **Target Files:** Inspect `package.json`, `prisma/schema.prisma`, or core
  service directories.
- **MANDATORY Guardrail:** Focus ONLY on logic-bearing files. Avoid "Goal Drift"
  by ignoring unrelated UI styling unless the story specifically targets design
  tokens.

### Gate 1: Intent & Logic Gap Analysis

- **Positive (Signal):** Found clear missing edge cases (e.g., race conditions,
  validation failures) that the developer would have to "guess" later.
- **Negative (Noise):** Vague requirements that don't map to a specific data
  model or API endpoint.
- **Action:** If Negative, flag as "Strategic Debt" and request clarification on
  the data flow.

### Gate 2: Technical Acceptance Criteria (TAC)

- **Positive (Verified):** ACs are technical enough to prevent rework but
  product-focused enough to ensure value delivery.
- **Negative (Risk):** Generic ACs like "Make it work" or "Add a button."

## 📋 Outcome Actions

- **Deliver**: An augmented User Story with a "Technical Polish" section.
- **Ethos**: Diagnosis before Advice. If the repo uses a specific pattern (e.g.,
  Zod for validation), the TAC must explicitly mention using that pattern.
