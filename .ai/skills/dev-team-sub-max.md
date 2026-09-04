---
name: dev-team-sub-max
description: >
  [DEV-TEAM · SUB-MAX · NO API KEYS · CROSS-MODEL VERIFY] Subscription-tier
  ($100/mo) dev team orchestrator. Runs up to 2 parallel lanes with git
  worktrees, enforces turn budgets and quota ledger checkpoints, hardens plans
  via reflexion-loop-sub-max, manages multi-vendor model isolation (L0-L3) and
  exhaustion limits without losing work, and keeps the full visual fidelity gate
  intact without requiring API keys.
cost: ~3100 tokens
modes: [read-only, write, mcp]
surface: public
category: Orchestrators
how:
  'Multi-vendor model contract, Quota Ledger with active model tracking,
  Findings Ledger, and context-firewalled reviewer isolation'
useCase:
  'Multi-lane parallel feature orchestration on a high-tier ($100/mo)
  subscription without API keys'
kind: orchestrator
domain: eng
spans: [intent, specify, plan, build, maintain, review, deploy]
ownership:
  drive: human-ai
  approve: human
targets: [api, subscription]
minModelClass: large
suggests:
  [
    dev-team-orchestrator,
    dev-team-sub-pro,
    mission-architect,
    reflexion-loop-sub-max,
    reflexion-loop,
    visual-verifier,
  ]
policies:
  - user-sovereignty
  - diagnosis-first
  - four-pillars
---

# Dev Team Orchestrator — Sub-Max Tier ($100/mo)

> Tier siblings: dev-team-orchestrator (API keys, dual-model) · dev-team-sub-max
> ($100 tier) · dev-team-sub-pro ($20 tier). See the tier table in the README.
>
> [!NOTE] **Tier profile ($100/mo subscription):** Designed for high-tier
> subscription agents (e.g. Pro/Max or Team plans). Runs up to **2 parallel
> lanes** with git worktree isolation, enforces turn budgets, uses
> `reflexion-loop-sub-max` for plan hardening, handles model exhaustion limits
> seamlessly without losing work, and requires **no external API keys**.

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
> - **IDE / MCP-enabled Agent:** you have full write access and must execute and
>   verify changes.

<!-- -->

> [!IMPORTANT] **EXECUTION DISCIPLINE (IDE/MCP MODE)**
>
> - **Produce, don't deliberate:** never call a sequential-thinking/planning
>   tool more than twice consecutively without emitting a concrete output. If
>   unsure, emit the current phase's artifact.
> - **No stall commands:** run no further search/terminal command between
>   finishing a phase's inputs and emitting its artifact.
> - **DIRECT EDITS ONLY:** native file edit tools only (no regex/patch.js
>   scripts).

## Pre-Flight Model Contract (MANDATORY BEFORE PHASE 0)

The orchestrator MUST read active models from the agent harness at runtime.
Formulate and print the Pre-Flight Model Contract before Phase 0:

| Role             | Model class assigned          | Isolation vs writer | Continuity Fallback        |
| ---------------- | ----------------------------- | ------------------- | -------------------------- |
| planner          | frontier                      | N/A (writer)        | Rung 1 -> Rung 2           |
| reviewer / qa    | a different vendor's frontier | L0 (cross-vendor)   | Rung 1 -> Rung 2 -> Park   |
| developer        | mid-tier                      | N/A (implementer)   | Rung 1 -> Rung 2 -> Rung 3 |
| discovery / grep | small/fast                    | N/A (read-only)     | Rung 3                     |

### Environment Check (`CLAUDE_CODE_SUBAGENT_MODEL`)

Before claiming an isolation level, check the `CLAUDE_CODE_SUBAGENT_MODEL`
environment variable.

- If `CLAUDE_CODE_SUBAGENT_MODEL` is set to anything other than `inherit`, all
  sub-agents collapse onto a single model.
- **Action:** Issue a warning plainly in chat and cap the claimed isolation
  level at **L2**. Never claim L0 or L1 when environment variables override
  sub-agent model selection.

### Four-Level Isolation Ladder

Claim the level ACHIEVED based on runtime model selection:

- **L0 (Cross-Vendor)**: Writer and reviewer run on models from different
  vendors. Default target for reviewer.
- **L1 (Cross-Family, Same Vendor)**: Writer and reviewer run on different model
  families from the same vendor (shared training lineage limitation apply).
- **L2 (Fresh Sub-Agent)**: Same model, fresh sub-agent context receiving only
  diff + criteria + commands.
- **L3 (Fresh Session)**: Same model, work pasted into a new session cold.

## Phase 0A — Cold Resume Protocol (MANDATORY FIRST STEP)

On invocation, before performing any codebase search or stack discovery:

1. Check for existing lane state files in `.dev-team/lanes/*.md`.
2. If any lane file exists and status is NOT `Complete`:
   - Read `.dev-team/quota.md` and print
     `[turns: used/budget | model: <active-model>]`.
   - Read Findings Ledger `.dev-team/analysis/<lane-id>.md` and incomplete lane
     state file(s).
   - **DO NOT re-run Phase 0 stack discovery** for a lane that already recorded
     its stack — that wastes turn budget in a fresh window.
   - Immediately resume execution from recorded `Phase` following
     `Resume Instruction`.
3. If no incomplete lane files exist, proceed to Phase 0B.

## Phase 0B — Stack Discovery & Mission Frame

- **Skill acquisition (NON-NEGOTIABLE):** IDE/MCP agent MUST call `get_skills`
  tool; Chat UI MUST call `get_skill`. Never raw-read `.ai/skills/`.
- **Discovery Budget:** Scoped searches only (exclude `node_modules`, `.next`,
  `.nx`, `dist`, `build`). Print Phase 1 sizing scores immediately after
  discovery.
- **Stack ID & Mission Frame:** Formulate stack summary, one-sentence mission,
  and success metric.
- **Findings Ledger Creation:** Immediately write stack facts, file paths, and
  domain boundaries to `.dev-team/analysis/<lane-id>.md`.

## Phase 1 — Crew Sizing Gate

Evaluate task based on five-signal 0–2 rubric (Surface area, Novelty, Risk,
Ambiguity, Parallelism). **Scores MUST be printed first before any work
begins.**

_(Note: The ceiling limits below are generated/derived — see
`TIER_POLICY['sub-max']` in `src/lib/ai/tier-policy.ts` for the authoritative
code policy.)_

| Size | Score | Crew                                          | Max Parallel Lanes | Loop Hardening                                                   |
| ---- | ----- | --------------------------------------------- | ------------------ | ---------------------------------------------------------------- |
| XS   | 0–1   | Developer only                                | 1                  | self-check + autoeval                                            |
| S    | 2–3   | Developer + Reviewer                          | 1                  | reviewer gate                                                    |
| M    | 4–5   | Planner + Developer + Reviewer                | 1–2                | plan gate + review gate                                          |
| L    | 6–8   | PM-analyst + Planner + Dev ×N + Reviewer + QA | 2                  | `reflexion-loop-sub-max` recommended                             |
| XL   | 9–10  | mission-architect strategy + L crew           | 2                  | `reflexion-loop-sub-max` mandatory + Tech-Lead confirmation gate |

> [!CAUTION] **Sub-Max Sizing Constraints:** Max 2 parallel lanes (enforced by
> `tier-policy.ts`). XL requires a Tech-Lead confirmation gate in
> `.dev-team/inbox.md` stating expected turn cost (~60 turns across lanes)
> before worktree creation.

## Phase 2 — Lane & Quota Ledgers

### Quota Ledger (`.dev-team/quota.md`)

- Mission turn budget: **60 turns** | Per-lane turn budget: **25 turns**
- Print `[turns: used/budget | model: <active-model>]` at every gate boundary.

| Lane ID | Active Model | Turns Used | Turn Budget | Headroom Last Poll | Swap Count | Last Checkpoint | Status |
| ------- | ------------ | ---------- | ----------- | ------------------ | ---------- | --------------- | ------ |
| ...     | ...          | ...        | 25          | ...                | 0          | ...             | ...    |

### Lane Ledger & CHECKPOINT-BEFORE-GATE

| lane-id | task | size | crew | branch+worktree | state-file | status | next-gate |
| ------- | ---- | ---- | ---- | --------------- | ---------- | ------ | --------- |
| ...     | ...  | ...  | ...  | ...             | ...        | ...    | ...       |

- **Isolation:** One git worktree per lane (`rtk git worktree add ...`), single
  writer per lane. Mandatory worktree bootstrap (deps, `.env`, clients, builds)
  before testing.
- **CHECKPOINT-BEFORE-GATE (MANDATORY):** Write `.dev-team/lanes/<lane-id>.md`
  BEFORE entering any gate.

**State File Template (`.dev-team/lanes/<lane-id>.md`):**

```md
# Lane: <lane-id>

- Task: <description>
- Status: <status> (Active | Complete | PROVISIONAL | UNREVIEWED)
- Next Gate: <gate>
- Phase: <current-phase-number>
- Active Model: <model-name>
- Isolation Level: <L0-L3>
- Turns Used: <turns-count> / 25
- Last Checkpoint: <timestamp>
- Resume Instruction:
  <one imperative sentence telling a fresh-context agent exactly what to do next>
- Current Artifacts: <links/paths>
```

## Phase 3 — Persona Execution, Model Continuity, UNREVIEWED vs PROVISIONAL Slices

### Model Exhaustion Classification

- **Mode A (MODEL-SCOPED):** Quota spent on one model. Run fallback ladder and
  continue.
- **Mode B (ACCOUNT-WIDE):** Limit reached across models. Consolidate into
  Findings Ledger, PARK, report reset window. State 3 disclosure applies.
- **Mode C (SILENT DOWNGRADE):** Harness swapped models mid-session without
  error. Poll active model at every phase boundary. Any change is recorded as a
  swap event.

### Sideways-Before-Downward Fallback Ladder

Reason about VENDOR and CLASS separately:

1. **Rung 1 (Same Class, Different Vendor):** Move to an equivalent frontier
   class model on another vendor. Isolation level preserved (L0).
2. **Rung 2 (Same Vendor, Lower Class):** Move to lower model class on same
   vendor. Recompute isolation level (if lands on writer's model, claim drops to
   L2).
3. **Rung 3 (Small/Fast Class):** THROUGHPUT ROLES ONLY (developer, discovery,
   QA capture). Assurance roles NEVER fall to Rung 3; PARK instead.
4. **Rung 4 (No Capacity Anywhere):** Consolidate into Findings Ledger, PARK,
   report reset window in State 3.

### Slice Status Definitions: UNREVIEWED vs PROVISIONAL

- **PROVISIONAL Slices:** A slice whose review was completed under a degraded
  assurance role (same model or L2/L3 isolation). Marked `PROVISIONAL` in Lane
  Ledger and state file. PROVISIONAL slices are re-reviewed when capacity
  returns, or require explicit Tech-Lead waiver.
- **UNREVIEWED Slices:** A slice where the run stopped before the audit ran or
  completed (Mode B park). UNREVIEWED work has received NO verification pass.
- **Risk-2 Work Rule:** Auth, payments, customer data, and infrastructure
  changes MAY NOT close on a PROVISIONAL or UNREVIEWED approval — PARK instead.

### Findings Ledger Protocol (`.dev-team/analysis/<lane-id>.md`)

Write stack facts, file paths, domain boundaries, Figma measurements, and
**OPTIONS REJECTED WITH REASONS** (mandatory) the moment established.
Consolidate at 20% headroom / 80% turn budget spent. Schedule swap for NEXT
phase boundary.

### Reviewer Isolation & Visual Gate

Reviewer runs in fresh sub-agent (Context Firewall: diff + criteria + commands).
Must **ACT, not read**. Figma spec in plan required. Gate 4 Layout Deviation
Report & `visual-verifier` capture required for UI slices.

## Phase 4 — Tech-Lead Interview at Gates

Batch questions in `.dev-team/inbox.md`. PARK is a hard stop. Inbox is read-only
after human responds. Never bypass gate failures silently.

## Phase 5 — Friction Defect Protocol & Model Swap Triggers

**Triggers:**

- ≥2 rework loops on one gate.
- Skill misbehaviour or missing tool/permission.
- **Model Swap Trigger:** A lane swaps models more than 2 times, or any
  assurance role falls to Rung 3.

**Action:** Write `.dev-team/friction/<date>-<slug>.md`. Append draft command to
inbox. Draft-only unless `DEV_TEAM_AUTOFILE_ISSUES=1`.

> [!CAUTION] **ABSOLUTE RULE** `git push`, `git add`, and `merge` remain
> STRICTLY FORBIDDEN regardless of mode or env var.

## Telemetry

Pass `{ teamRole: "<ROLE>", loopRunId: "<MISSION_ID>", actorType: "AGENT" }` on
every skill call.

## Three Mandatory End-State Disclosures (VERY FIRST LINE OF FINAL OUTPUT)

The FIRST line of final output MUST emit exactly one of these three end states:

- **STATE 1 — Separation Held (Auditor finished on a different model):**

  ```text
  Model separation held: written by <model-a>, audited by <model-b>.
  ```

- **STATE 2 — Separation Lost (Auditor FINISHED, but on the writer's model):**

  ```text
  MODEL SEPARATION LOST: <writer-model> wrote this work and also audited it.
  <exhausted-model> hit its usage limit at <phase/step>, so the audit fell back to the same model that produced the work. This audit was not independent.
  ```

- **STATE 3 — Audit Incomplete (Run stopped before auditor finished):**

  ```text
  AUDIT NOT COMPLETED: the run stopped at <phase/step> before the audit finished.
  <exhausted-model> hit an account-wide usage limit, so no model was available to continue. The work below is UNREVIEWED, not approved. Quota resets <window>.
  ```

### Selection Rule

State 2 REQUIRES that an audit RAN TO COMPLETION on the writer's model. If the
audit did not complete, State 3 applies — NEVER State 2. An unfinished audit is
not a weak audit, it is an absent one.

### Full Provenance Table (Emitted Beneath Disclosure Line)

| Phase | Role | Model | Isolation | Reason for swap | Effect on the claim |
| ----- | ---- | ----- | --------- | --------------- | ------------------- |
| ...   | ...  | ...   | ...       | ...             | ...                 |

## Four Pillars Compliance & Anti-Rationalization

### Anti-Rationalization Protocol

| Rationalization                                                               | Rebuttal / Required Behavior                                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| "Tests pass so the slice is done."                                            | Test-pass is not design-pass. Run visual fidelity gate and paste Layout Deviation Report.               |
| "I'll bootstrap the worktree later."                                          | Without bootstrap (deps, `.env`, clients, builds), `check-types` is meaningless. Bootstrap immediately. |
| "The human is probably fine with this choice."                                | PARK and write to `.dev-team/inbox.md`. Guessing an answer is a defect.                                 |
| "The audit passed anyway, so the notice would just worry them."               | A pass from the author is not a pass; the notice IS the finding. Emit disclosure line as line 1.        |
| "The model swap was handled automatically, so it's an implementation detail." | Handling it seamlessly is why developer cannot see it, which is exactly why it must be stated.          |
| "It is already recorded in the provenance table below."                       | A table row is not a disclosure; the first line is.                                                     |

### Hooks (Ownership Gates)

Before advancing to the next phase or gate, you MUST consult `.ai/hooks/`. If a
guard is triggered and requires human approval (`require-human-approve`), you
MUST append the question to the human inbox (`.dev-team/inbox.md`) rather than
proceeding.
