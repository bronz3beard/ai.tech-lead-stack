---
name: dev-team-orchestrator
description: >
  [DEV-TEAM · FULL · MCP] The flagship orchestration skill: an agent-agnostic
  "dev team" you manage as a technical product manager. Sizes the crew to the
  task, runs multiple task lanes in parallel without collision, interviews the
  human only at gates, and files friction defects automatically on its own repo.
cost: ~2500 tokens
modes: [read-only, write, mcp]
surface: public
category: Orchestrators
---

# Dev Team Orchestrator (The Agentic Crew)

> [!NOTE] **Sibling subscription tiers (no API keys required):** For
> subscription-only accounts, use `dev-team-sub-max` ($100/mo tier, max 2
> parallel lanes) or `dev-team-sub-pro` ($20/mo tier, single-lane pair).

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

<!-- -->

> [!IMPORTANT] **EXECUTION DISCIPLINE (IDE/MCP MODE)**
>
> - **Produce, don't deliberate:** never call a sequential-thinking/planning
>   tool more than twice consecutively without emitting a concrete output. If
>   unsure, emit the current phase's artifact.
> - **No stall commands:** run no further search/terminal command between
>   finishing a phase's inputs and emitting its artifact.
> - **DIRECT EDITS ONLY:** never write generated regex/patch.js scripts that
>   mutate source (they fail silently and leave no reviewable diff). Use native
>   file edit tools.

## Phase 0 — Discovery (MANDATORY)

- **Skill acquisition (NON-NEGOTIABLE):** IDE/MCP agent MUST call `get_skills`
  tool; Chat UI MUST call `get_skill`. Never read `.ai/skills/` via raw file
  access.
- **Discovery Budget:** Apply a small cap of scoped searches only. Every
  grep/find MUST exclude `node_modules`, `.next`, `.nx`, `dist`, and `build`. No
  unscoped recursive search. Discovery is COMPLETE once the stack, relevant
  files, and named config flags are known. The FIRST output after discovery MUST
  be the Phase 1 sizing scores, with no terminal command between discovery and
  sizing.
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

**Phase artifact:** The printed sizing scores (the first thing emitted after
discovery).

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
  writer per lane. Lane creation is NOT silent — when a worktree/branch is
  created, print the worktree path and branch, and record them in the Ledger row
  and lane state file immediately.
- **Worktree Bootstrap (MANDATORY):** A fresh worktree does not inherit
  `node_modules`, built workspace packages, `.env` files, or generated clients
  (e.g. Prisma). Before any `check-types` or `test` in a new lane, you MUST
  bootstrap it: install deps, copy required `.env` file(s) from the source
  checkout, generate clients, and build dependent workspace packages. Only then
  run `check-types`/`tests`.
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
compiles and behaves, not that it matches the design. For any UI-facing slice,
the PLAN for that slice MUST already contain the fetched Figma measurements (a
'Frame read' block with concrete numbers per screen). If the plan lacks fetched
numbers, it is not ready for approval — return it for Figma fetching before any
code is written. Deferring the fetch to execution is a defect. For any slice
that changes rendered UI, the QA persona MUST, before the slice is marked
complete:

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

**Gate Guardrails (HARD RULES):**

- **PARK IS A HARD STOP:** After writing questions to `.dev-team/inbox.md`, the
  lane MUST stop ALL commands (no searches, reads, edits, discovery) and yield
  until the human fills answers and signals continue. Continuing to work after
  posting questions is a defect. Parking is correct behaviour, not a stall, and
  must not be worked around by guessing an answer.
- **INBOX IS READ-ONLY TO THE AGENT ONCE POPULATED:** The agent may CREATE the
  question block, but once the human saves answers it must read them in place
  and MUST NOT rm/overwrite/rewrite `.dev-team/inbox.md` (read into memory if a
  normalized copy is needed; never destroy or paraphrase the human's file). The
  inbox is for QUESTIONS only; status/confirmations go to the Lane Ledger or
  chat, never as inbox answer entries.
- **NEVER SILENTLY BYPASS A GATE ON TOOL FAILURE:** If a gate tool (e.g.
  `reflexion-loop`) fails or times out, do NOT auto-skip by writing a
  "bypassing" note and continuing. Retry once; if it still fails, PARK and ask
  the human whether to proceed un-hardened. For Risk-2+ tasks
  (auth/payments/data/infra), proceeding un-hardened REQUIRES explicit human
  approval.

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
