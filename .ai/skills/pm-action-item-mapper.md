---
name: pm-action-item-mapper
description:
  Translate meeting notes into actionable technical tasks linked to code.
  Ensures full traceability from product intent to technical footprint.
cost: ~650 tokens
---

# PM Action Item Mapper (The Traceability Link)

> [!IMPORTANT] **G-Stack Methodology**: Every mapping beginning with
> **Tech-Stack Discovery**. The agent must identify the specific logic nodes
> (files/functions) that correspond to the meeting decisions. Follow
> **MinimumCD** by linking intent to small, verifiable code changes.

## 🎯 Verification Gates (Discovery & Mapping)

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Action**: Locate the core modules discussed in the notes using `list_dir` or
  `grep_search`.
- **Target**: Find data models, API routes, or UI components that match the
  "Decision Context."

### Gate 1: Intent-to-Node Traceability

- **Positive (Signal):** Every decision in the meeting notes is mapped to one or
  more specific files/functions.
- **Negative (Noise):** Decision "float" where an action item has no clear
  technical home.
- **Action:** If Negative, report as a "Scope Fragility" and propose the
  creation of a new module or extension of an existing one.

### Gate 2: Logic Integrity

- **Positive (Pass):** The proposed changes conform to existing patterns (e.g.,
  if the user says "add logging", use the existing `Telemetry` service).
- **Negative (FAIL):** The proposed change would introduce "Pattern Drift."

## 📋 Outcome Actions

- **Deliver**: A mapping table of: `Decision Item` -> `Target Logic Node` ->
  `Technical Action`.
- **Ethos**: Traceability over Speed. Never leave an action item unmapped to a
  potential codebase impact.
