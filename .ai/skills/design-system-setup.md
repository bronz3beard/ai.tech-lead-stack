---
name: design-system-setup
description: End-to-end design system setup. Runs design-expert to extract and document all design information, then runs design-system-docs to audit or plan the Storybook implementation, and finally uses plan-expert to create a parent ClickUp ticket with all execution subtasks. Use when starting or improving the design system in a project.
allowed-tools: Glob Read Grep Write Bash AskUserQuestion mcp__clickup__clickup_get_workspace_hierarchy mcp__clickup__clickup_get_task mcp__clickup__clickup_create_task TaskCreate TaskUpdate
effort: high
cost: ~1500 tokens
---

# design-system-setup

You are a design system orchestrator. You run three skills in sequence within this context. The skills are preloaded — execute their instructions directly, do not spawn subagents.

---

## Phase 1 — Design Documentation (`design-expert`)

Run the full `design-expert` skill as defined in its SKILL.md.

This means:
- Read `AGENTS.md` and `DESIGN.md` if they exist
- Run the complete file discovery (Steps 2a–2e) and deep extraction (Steps 3a–3g) — do not skip any scan step
- Write or update `DESIGN.md` at the project root
- Complete the Step 5 confirmation output

Once `DESIGN.md` has been written or updated, store its full content as `DESIGN_MD_CONTENT` and proceed to Phase 2. Do not ask the user whether to continue.

---

## Phase 2 — Storybook Audit or Plan (`design-system-docs`)

Run the full `design-system-docs` skill as defined in its SKILL.md.

This means:
- Detect whether Storybook is present (Step 2a) and whether Markdown docs exist (Step 2b)
- Branch to Section A (Storybook audit) or Section B (implementation plan) accordingly
- Complete all audit sub-steps or plan phases in full
- Output the full report or plan

Once the skill completes, capture the entire output as `PHASE2_OUTPUT`. This is the raw material for Phase 3.

Present the Phase 2 output to the user, then use `AskUserQuestion` with:
- Header: "Plan the work"
- Question: "How would you like to track the tasks for this work?"
- Options:
  - `ClickUp` — create a parent ticket and subtasks in ClickUp
  - `Local files` — generate a task plan as local Markdown files
  - `Skip` — no task tracking, finish here

Capture the choice as `TASK_MODE` and proceed to Phase 3.

---

## Phase 3 — Task Creation (`plan-expert`)

If `TASK_MODE` is `Skip`, go directly to [Finish](#finish).

---

### Branch A — ClickUp (`TASK_MODE = ClickUp`)

#### 3A.1 — Ask for workspace and list

Before fetching anything, use `AskUserQuestion` to ask the user for their ClickUp workspace name or ID:

- Header: "ClickUp workspace"
- Question: "Which ClickUp workspace should this ticket be created in? Enter the workspace name or ID."
- Accept free-form text. Capture the answer as `WORKSPACE_INPUT`.

Then fetch the workspace hierarchy to resolve available spaces and lists:

```
mcp__clickup__clickup_get_workspace_hierarchy {}
```

Use the hierarchy response to find the workspace that matches `WORKSPACE_INPUT` (by name or ID). If no match is found, inform the user and ask them to confirm the workspace name or ID before continuing.

Once the workspace is resolved, use `AskUserQuestion` to ask the user to pick the destination list:

- Header: "ClickUp list"
- Question: "Which list should the parent ticket be created in?"
- Options: build from the resolved workspace hierarchy (Space → Folder → List). Show at most 6 options; include an "Other (type list ID)" option for anything not listed.

Capture the selected value as `LIST_ID`. Do not proceed to 3A.2 until both `WORKSPACE_INPUT` and `LIST_ID` are confirmed.

#### 3A.2 — Create the parent ticket

Determine the ticket title based on the Phase 2 branch:

- **Storybook already exists (Section A was run):** `"Improve Storybook implementation"`
- **No Storybook found (Section B was run):** `"Set up Storybook and design system documentation"`

Build the ticket description from `PHASE2_OUTPUT`:
- Section A: summarize critical issues, improvements, and coverage gaps
- Section B: summarize current documentation state and include the phase overview

```
mcp__clickup__clickup_create_task {
  list_id: "<LIST_ID>",
  name: "<ticket title>",
  description: "<summary from PHASE2_OUTPUT>"
}
```

Capture `PARENT_TICKET_ID` and `PARENT_TICKET_URL`.

#### 3A.3 — Execute `plan-expert`

Run the full `plan-expert` skill as defined in its SKILL.md, passing:

- `--ticket-id <PARENT_TICKET_ID>`
- `--description "<PHASE2_OUTPUT>"` — pass the full Phase 2 output so plan-expert has complete context

The skill will present the subtask plan for confirmation, wait for approval, then create all subtasks on the parent ticket. Do not skip the confirmation step — `plan-expert` owns it.

---

### Branch B — Local files (`TASK_MODE = Local files`)

#### 3B.1 — Execute `plan-expert`

Run the full `plan-expert` skill as defined in its SKILL.md, passing only:

- `--description "<PHASE2_OUTPUT>"` — pass the full Phase 2 output as the planning input

The skill will decompose the work into subtasks, present the plan for confirmation, and on approval create local task files for the session. Do not skip the confirmation step — `plan-expert` owns it.

---

## Finish

Once all phases are complete, output this summary and stop:

```
## Design System Setup Complete

### Phase 1 — Design Documentation
DESIGN.md was written / updated at the project root.

### Phase 2 — Storybook
[Storybook audit completed — X critical issues, Y improvements identified]
  OR
[Storybook implementation plan produced — 5 phases defined]

### Phase 3 — Task Plan
[ClickUp] Parent ticket: <PARENT_TICKET_URL> — Subtasks created: <count>
  OR
[Local files] <count> tasks created for this session
  OR
[Skipped]
```

Do not suggest further steps or offer to continue.
