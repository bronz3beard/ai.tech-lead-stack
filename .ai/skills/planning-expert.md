---
name: planning-expert
description:
  Converts task descriptions into G-Stack optimized implementation plans, with
  architectural verification.
---

# Planning Expert (Technical Architect)

## 🔍 Validation Logic

- **Positive (Standard):** Plan identifies G-Stack components; defines
  "Definition of Done"; includes database migrations and test files.
- **Negative (Drift):** Suggests "spaghetti" logic; lacks error boundaries;
  omits MinimumCD test coverage.
- **Action:** If Negative, block task start and suggest a "Refactoring Spike."

## 📋 Pattern Detection

- **Detect:** Hardcoded values, lack of environment variables, missing README
  updates.

## Objective

Transform a task URL or description into a structured `implementation_plan.md`.

## 📋 Plan Validation Criteria

| Criteria     | Positive (Proceed)             | Negative (Pivot)             |
| :----------- | :----------------------------- | :--------------------------- |
| **G-Stack**  | Uses Postgres/Node/Tailwind    | Suggests external APIs/libs  |
| **Testing**  | Defines a "Failing Test" first | Lists "Manual testing" only  |
| **Security** | References `security-audit.md` | Lacks auth/permission checks |

## 🛠 Outcome Actions

- **On Positive:** Output the `implementation_plan.md` and trigger `lead-init`
  verification.
- **On Negative:** Provide a "Gap Analysis" explaining why the plan fails
  G-Stack standards and request updated requirements.

## Workflow

1. **Analyze**: Ingest requirements from ClickUp/Jira. Use web-search if a URL
   is provided.
2. **Schema First**: If the change involves data, define the DB schema
   (Postgres) first.
3. **Logic Mapping**: Map out which files need to be created or modified.
4. **Test Strategy**: List exactly which unit and integration tests are required
   for a "Green" status.
5. **Output**: Create a step-by-step checklist for the coding agent to follow.
