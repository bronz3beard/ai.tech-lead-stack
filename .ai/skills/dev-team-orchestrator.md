---
name: dev-team-orchestrator
description: >
  The flagship orchestration skill: an agent-agnostic "dev team" you manage as a
  technical product manager. Sizes the crew to the task, runs multiple task
  lanes in parallel without collision, interviews the human only at gates, and
  files friction defects automatically on its own repo.
cost: ~2500 tokens
modes: [read-only, write, mcp]
surface: public
---

# Dev Team Orchestrator (The Agentic Crew)

## Runtime modes

Produces a blueprint and hand-off in read-only chat; executes in an IDE/MCP
agent.

> [!IMPORTANT] **Anti-Micromanagement Litmus** Personas receive goals + gates,
> never line-by-line instructions. The human appears only at gates. We advise;
> the User Tech-Lead decides.

<!-- -->

> [!CAUTION] **RUNTIME MODE (DETERMINE FIRST — NON-NEGOTIABLE)**
>
> - **Read-only chat (`/chat`):** write/exec tools are forbidden; only
>   `get_skill`, `list_skills`, `read_file` exist. Deliver a **verifiable
>   blueprint + handoff**.
> - **IDE / MCP-enabled Agent:** you have full write access and must use `rtk`
>   (Run Tool Kit) to execute and verify changes.

## Phase 0 — Discovery (MANDATORY)

- **Skill acquisition (NON-NEGOTIABLE):** IDE/MCP agent MUST call `get_skills`
  tool; Chat UI MUST call `get_skill`. Never read `.ai/skills/` via raw file
  access.
- **Stack ID:** Inspect manifest/config (`package.json`, `tsconfig.json`, etc.)
  for framework + conventions.
- **Mission Frame:** Formulate a one-sentence mission statement and a success
  metric.
- **Runtime-mode determination:** Confirm whether you are in a read-only chat or
  an IDE/MCP agent capable of execution.

## Phase 1 — Crew Sizing Gate

Evaluate the task based on the five-signal 0–2 rubric to determine the crew
size. **HARD RULES:** idle personas are never instantiated; the sizing decision
and its scores MUST be printed before any work begins; a size may be revised at
a gate but never silently.

| Signal       | 0                | 1                      | 2                        |
| ------------ | ---------------- | ---------------------- | ------------------------ |
| Surface area | 1 file, 1 layer  | ≤5 files or 2 layers   | many files / cross-layer |
| Novelty      | existing pattern | adjacent pattern       | new pattern/system       |
| Risk         | cosmetic         | business logic         | auth/payments/data/infra |
| Ambiguity    | spec is exact    | minor gaps             | open questions           |
| Parallelism  | none             | 2 independent subtasks | 3+ independent subtasks  |

Total score → size → crew preset:

| Size | Score | Crew                                          | Parallel lanes | Loop hardening                       |
| ---- | ----- | --------------------------------------------- | -------------- | ------------------------------------ |
| XS   | 0–1   | Developer only                                | 1              | self-check + autoeval                |
| S    | 2–3   | Developer + Reviewer                          | 1              | reviewer gate                        |
| M    | 4–5   | Planner + Developer + Reviewer                | 1–2            | plan gate + review gate              |
| L    | 6–8   | PM-analyst + Planner + Dev ×N + Reviewer + QA | 2–3            | reflexion-hardened plan recommended  |
| XL   | 9–10  | mission-architect strategy + full L crew      | 3+             | `reflexion-loop` plan gate mandatory |

## Phase 2 — Lane Ledger

One row per task lane, tracking concurrent work.

| lane-id | task | size | crew | branch+worktree | state-file | status | next-gate |
| ------- | ---- | ---- | ---- | --------------- | ---------- | ------ | --------- |
| ...     | ...  | ...  | ...  | ...             | ...        | ...    | ...       |

- **Isolation:** One git worktree per lane (`rtk git worktree add ...`), single
  writer per lane.
- **Persistence:** State file `.dev-team/lanes/<lane-id>.md` updated at every
  gate.
- **Anti-drift:** The Ledger is the source of truth. Reprint the Ledger after
  every detour; lanes advance independently without cross-talk. Never silently
  abandon a pending slice.

**State File Template:**

```md
# Lane: <lane-id>

- Task: <description>
- Status: <status>
- Next Gate: <gate>
- Current Artifacts: <links/paths>
```

## Phase 3 — Persona Execution Protocol

Each persona maps to a chained sequence of EXISTING skills. The orchestrator
routes lanes by reading skill frontmatter (`modes:`, `surface:`) — a read-only
lane may only invoke skills whose modes include read-only delivery.

- **pm-analyst:** `feature-design-assistant`
- **planner:** `planning-expert` or `vertical-slice-decomposer`
- **developer:** Implement per plan
- **reviewer:** `code-review-checklist` + `verification-auditor`
- **qa:** `design-system-review` (authoritative layout/design gate) driving
  `visual-verifier` (capture) + `accessibility-auditor` — MANDATORY for any
  UI-facing slice, not optional

**Reviewer Rules:** The Reviewer NEVER shares the developer's context. The
Reviewer must ACT, not read: run the stated verification gates and paste hard
evidence. **Loop Hardening:** For L/XL sizes, the plan gate SHOULD (L) or MUST
(XL) be hardened via `rtk run reflexion-loop` before execution. Note that the
reflexion loop is the stack's one declared non-agnostic feature (refer to
`reflexion-loop.md` wording).

**Visual Fidelity Gate (MANDATORY for any UI-facing slice — BLOCKING):** A UI
slice does NOT close on `check-types` + passing tests; those prove the code
compiles and behaves, not that it matches the design. For any slice that changes
rendered UI, the QA persona MUST, before the slice is marked complete:

1. **Fetch the design source at implementation time** — the specific Figma node
   for the slice via the Figma MCP `get_figma_data` tool (the actual frame, not
   the Phase-0 summary). The frame's measurements are acceptance criteria:
   container/card width, column widths, gaps, breakpoints, and sub-element
   reflow.
2. **Run `design-system-review`** on the changed component. Its **Gate 4 (Layout
   Fidelity)** produces an itemised built-vs-frame Layout Deviation Report and
   is BLOCKING; `visual-verifier` performs the capture at Desktop/Tablet/Mobile.
3. **Any DEVIATION blocks the slice.** It returns to the developer with the
   report until all-MATCH, or a specific deviation is explicitly waived by the
   Tech-Lead at a gate (record the waiver). Paste the final all-MATCH Layout
   Deviation Report as the slice's completion evidence, alongside the test
   output.

> [!CAUTION] Layout words in prose ("side by side", "wider", "stacked") are
> CONSEQUENCES of building to the frame, never the instruction. Build to the
> frame; the prose is a hint, the frame is the spec. Implementing the words
> without matching the frame is a FAILED slice, not a complete one. Test-pass is
> not design-pass.

## Phase 4 — Tech-Lead Interview at Gates

Questions for the human (the Tech-Lead) are batched at gate boundaries ONLY.
Append them to `.dev-team/inbox.md` using the fenced yaml convention:

```yaml answers:
# Leave blank for the human to answer inline
question_1: ''
```

If unanswered, the lane PARKS at its gate and other lanes continue working. Do
not interrupt mid-lane.

## Phase 5 — Friction Defect Protocol

**Triggers:**

- ≥2 rework loops on one gate.
- A skill behaving contrary to its description.
- Missing tool/permission.

**Action:** Write `.dev-team/friction/<date>-<slug>.md` using the Friction
Defect template (observed vs expected, skill involved, reproduction, rework
count, proposed prevention class). Append a ready-to-run command to the inbox:
`gh issue create --repo bronz3beard/ai.tech-lead-stack --label friction --title "..." --body-file ...`

**Execution:** DEFAULT is draft only. In IDE/MCP mode, the agent MAY execute
`gh issue create` iff the env var `DEV_TEAM_AUTOFILE_ISSUES=1`.

> [!CAUTION] **ABSOLUTE RULE** `git push`, `git add`, and `merge` remain
> STRICTLY FORBIDDEN regardless of mode or env var. Restated from
> `.ai/agents.md`.

## Telemetry

Every persona action MUST run through the MCP skill tools so `withAnalytics`
records it. Instruct agents to pass telemetry overrides to correctly tag team
role actions:

Pass `{ teamRole: "<ROLE>", loopRunId: "<MISSION_ID>", actorType: "AGENT" }`
when invoking skills to ensure the activity is correctly attributed on the
Agentic Health dashboard.
