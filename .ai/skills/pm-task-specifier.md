---
name: pm-task-specifier
description:
  Draft high-fidelity technical specifications for new features. Focuses on data
  models, API contracts, and schema integrity.
cost: ~750 tokens
---

# PM Task Specifier (The Blueprint Drafter)

> [!IMPORTANT] **G-Stack Methodology**: Every specification begins with
> **Tech-Stack Discovery**. The agent must audit existing schemas and types
> before drafting new feature blueprints. Follow **MinimumCD** by defining the
> "Minimum Viable Schema" required for the feature.

## 🎯 Verification Gates (Spec Integrity)

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Action**: Research the state of `prisma/schema.prisma`, `src/types`, and
  existing API routes.
- **Goal**: Understand the "Pattern Language" of the project (e.g., camelCase vs
  snake_case, Zod validation).

### Gate 1: Contract Consistency

- **Positive (Signal):** The new feature spec uses existing utility types and
  follows the project's data flow conventions.
- **Negative (Noise):** Creating redundant types or data fields that already
  exist.
- **Action**: If Negative, force a "Schema Deduplication" pass.

### Gate 2: Security & Validation Gate

- **Positive (Pass):** The spec includes non-negotiable validation rules (Zod)
  and authorization checks.
- **Negative (FAIL):** Missing error handling or data sanitizer definitions.

## 🛠 Analysis Layer (The Hands)

### 1. Schema Heartbeat

- Verify the database schema and identify any required migrations.

### 2. Contract Draft

- Define the `Input` and `Output` types for the proposed feature.

## 📋 Outcome Actions

- **Deliver**: A "High-Fidelity Technical Spec" document for developer
  ingestion.
- **Ethos**: Precision over Narrative. A spec should be so clear that it
  requires zero "back-and-forth" with the developer.
