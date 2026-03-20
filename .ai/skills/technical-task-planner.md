---
name: technical-task-planner
description:
  Expert technical task decomposition for developers. Transforms high-level
  requirements into granular, G-Stack/MinimumCD compliant ClickUp tasks with
  database analysis.
---

# Technical Task Planner (Lead Architect)

## 🎯 Verification Gates

### Gate 1: Requirements Clarity & Research Ingestion

- **Positive (Signal):** All requirements (Backend, Frontend/UI, API) are
  identified; research details (if provided) are incorporated; clear "Definition
  of Ready."
- **Negative (Noise):** Ambiguous goals; missing research context when
  referenced; missing UI/UX specifications; unclear scope.
- **Action:** If Negative, request clarification or trigger a `research-spike`
  work item.

### Gate 2: Data & State Analysis (Structural Integrity)

- **Positive (Verified):** Schema/Data changes (SQL, Prisma, NoSQL, etc.) are
  defined; state management impact analyzed; zero breaking changes without a
  transition strategy.
- **Negative (Risk):** Manual DB/State updates suggested; missing migration or
  data transformation steps; "God Tables/Objects" being extended without
  justification.
- **Action:** Define the structural changes (Schema, API contracts, or State
  models) as the VERY FIRST task.

### Gate 3: Task Decomposition (Parent/Subtask Strategy)

- **Positive Outcome (Pass):** Tasks are atomic (< 4 hours); Parent tasks group
  logical features; Subtasks define specific implementation steps (e.g., "Create
  API Route," "Implement Unit Test").
- **Negative Outcome (Fail):** "Mega-tasks" (> 1 day); flat task list without
  hierarchy; missing test tasks.
- **Action:** Enforce a maximum of 5 subtasks per parent task.

### Gate 4: Standards Alignment (G-Stack & MinimumCD)

- **Positive Outcome (Pass):** All tasks require unit/integration tests; follows
  framework-specific conventions (e.g., Next.js App Router); favors decoupled,
  reusable components.
- **Negative Outcome (Fail):** Suggests tight coupling; omits "Failing Test
  First" approach; violates SOLID principles.
- **Action:** Block plan output and refactor for G-Stack and MinimumCD
  alignment.

## 🛠 ClickUp Task Template (Mandatory Structure)

For every task generated, include the following metadata:

| Field                | Value / Description                                                    |
| :------------------- | :--------------------------------------------------------------------- |
| **Status**           | `TO DO`                                                                |
| **Priority**         | `High` (Critical Path), `Medium` (Feature), `Low` (Polish)             |
| **Labels**           | `G-Stack`, `Backend`, `Frontend`, `DB`, `MinimumCD`                    |
| **Success Criteria** | Specific, measurable outcome (e.g., "API returns 200 with payload X"). |
| **Tech Stack**       | Reference specific components (e.g., Prisma, Tailwind, Next.js).       |

## 📋 Execution Workflow

1. **Ingest Context**: Read the ticket description, @[Research Task] details,
   and UI/UX requirements.
2. **Structural Pre-Flight**: Analyze existing data structures, API contracts,
   and state management.
3. **Mental Map**: Outline the architectural changes (Files to [NEW], [MODIFY],
   [DELETE]).
4. **Task Batching**: Create Parent Tasks for logical milestones.
5. **Subtask Detailing**: Create Subtasks with exact "Definition of Done".
6. **AI Prompt Generation**: For every task and subtask, generate a high-density
   technical prompt that a developer can use with an AI (e.g., Antigravity,
   Claude, ChatGPT) to execute the work.
7. **Final Polish**: Verify against `clean-code.md` and `security-audit.md`.

## Output Format

```markdown
# [Parent Task Name] ([Priority])

- **Status**: TO DO
- **Labels**: [Labels]
- **Success Criteria**: [Criteria]
- **Technical Details**: [Architecture, files, and logic]
- **AI Execution Prompt**: [A detailed, context-rich prompt for an AI assistant
  to execute this entire parent task.]

## Subtasks:

1. [Subtask Name]
   - Description: [Specific implementation steps]
   - DoD: [Specific verification step]
   - **AI Execution Prompt**: [A granular prompt specifically for this subtask.]

2. [Subtask Name]
   - Description: [Specific implementation steps]
   - DoD: [Specific verification step]
   - **AI Execution Prompt**: [A granular prompt specifically for this subtask.]
```
