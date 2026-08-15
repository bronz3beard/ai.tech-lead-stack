---
name: dev-team-sub-pro
description: >
  [DEV-TEAM · SUB-PRO · NO API KEYS · CROSS-MODEL VERIFY] Subscription-tier
  ($20/mo) dev pair orchestrator. Single-lane, branch-based execution without
  worktrees, enforcing turn budgets, builder/checker roles, cross-vendor model
  isolation, Mode B quota handling, and tier-ceiling enforcement without
  requiring API keys.
cost: ~2300 tokens
modes: [read-only, write, mcp]
surface: public
category: Orchestrators
how:
  'Single-lane Builder/Checker model contract, compressed Findings Ledger, Mode
  B consolidate-and-park, and mandatory three-state end-state disclosure'
useCase:
  'Frugal single-lane feature orchestration on a standard ($20/mo) subscription
  without API keys'
---

# Dev Team Orchestrator — Sub-Pro Tier ($20/mo)

> [!NOTE] **Tier profile ($20/mo subscription):** Honest promise: **A
> disciplined pair, not a team.** Designed for standard subscription tiers (e.g.
> Pro/Plus plans). Operates as a single-lane **Builder + Checker pair** directly
> on a feature branch (no git worktrees), capped at size M / Risk 1 tasks, with
> a strict 20-turn slice budget and **no external API keys**.

<!-- -->

> [!NOTE] **Frugal Compression Notice:** To preserve token frugality on a $20
> plan, multi-lane rebalancing and rung-probing sequences are **OMITTED**. The
> L0–L3 ladder, fallback rungs, and Findings Ledger structure are
> **COMPRESSED**. For detailed protocol mechanics, refer to `dev-team-sub-max`.
> The Pre-Flight Model Contract, `CLAUDE_CODE_SUBAGENT_MODEL` check, Mode B
> consolidate-and-park protocol, and Mandatory Three-State Disclosure rules are
> included **FULL and uncompressed**.

## Runtime modes

Produces a blueprint in read-only chat; executes in IDE/MCP mode.

> [!IMPORTANT] **Anti-Micromanagement Litmus** Personas receive goals + gates,
> never line-by-line instructions. The human appears only at gates. We advise;
> the User Tech-Lead decides.

<!-- -->

> [!CAUTION] **RUNTIME MODE (DETERMINE FIRST — NON-NEGOTIABLE)** Read-only chat
> (`/chat`): write/exec forbidden; deliver verifiable blueprint + handoff.
> IDE/MCP mode: full write access via native edits.

## Pre-Flight Model Contract (FULL)

Read active models from agent harness at runtime. Formulate and print:

| Role                      | Model class assigned                                            | Isolation vs writer | Continuity Fallback |
| ------------------------- | --------------------------------------------------------------- | ------------------- | ------------------- |
| Builder (Plan + Dev)      | frontier / mid (e.g. Claude 3.7 Sonnet as of June 2026)         | N/A (writer)        | Consolidate & Park  |
| Checker (Review + Verify) | different vendor frontier (e.g. Gemini 2.5 Pro as of June 2026) | L0 (cross-vendor)   | L1 -> L2 -> Park    |

> **Sub-Pro Note:** The $20 tier does not include Opus class; Sonnet class is
> its frontier. Model separation comes from **cross-vendor pairing**, not
> cross-class pairing.

### Environment Check (`CLAUDE_CODE_SUBAGENT_MODEL` — FULL)

If `CLAUDE_CODE_SUBAGENT_MODEL` is set to anything other than `inherit`, warn
plainly in chat and cap claimed isolation level at **L2** (same-model
sub-agent). Never claim L0 or L1 when overridden by environment variables.

### Isolation Ladder & Fallback Rungs (COMPRESSED)

- **L0 (Cross-Vendor)**: Different vendor models. Default target for Checker.
- **L1 (Cross-Family)**: Same vendor, different model family.
- **L2 (Fresh Sub-Agent)**: Same model, fresh sub-agent context.
- **L3 (Fresh Session)**: Same model, cold paste into fresh session.
- **Fallback Rungs:** Rung 1 (same class, different vendor) -> Rung 2 (same
  vendor lower class, claim drops to L2 if lands on writer) -> Rung 3
  (small/fast, throughput roles only; assurance roles PARK).

## Phase 0A — Cold Resume Protocol (MANDATORY FIRST STEP)

1. Check for existing state file `.dev-team/lanes/lane-1.md`.
2. If incomplete: print `[turns: used/20 | model: <active-model>]`, read
   `.dev-team/analysis/lane-1.md` and state file. **DO NOT re-run Phase 0
   discovery**. Resume immediately from recorded `Phase`.
3. If no incomplete lane file exists, proceed to Phase 0B.

## Phase 0B — Stack Discovery & Mission Frame

- **Skill acquisition:** Call `get_skills` for `dev-team-sub-pro`. Never
  raw-read `.ai/skills/`.
- **Discovery Budget:** Scoped searches (exclude build dirs). Print sizing
  scores immediately after discovery.
- **Findings Ledger:** Write stack facts, file paths, and domain boundaries to
  `.dev-team/analysis/lane-1.md`.

## Phase 1 — Crew Sizing & Tier Ceiling Gate

Evaluate task using 0–2 rubric (Surface area, Novelty, Risk, Ambiguity,
Parallelism). **Scores MUST be printed first.**

| Size   | Score | Execution Model              | Hardening                                     |
| ------ | ----- | ---------------------------- | --------------------------------------------- |
| XS     | 0–1   | Single Builder/Checker slice | Self-check                                    |
| S      | 2–3   | Builder + Checker            | Optional `reflexion-loop-sub-pro` if Risk = 1 |
| M      | 4–5   | Builder + Checker            | Optional `reflexion-loop-sub-pro` if Risk = 1 |
| L / XL | 6–10  | **REFUSED (Exceeds Budget)** | Escalate to `dev-team-sub-max`                |

> [!CAUTION] **Sub-Pro Tier Refusal Rules:** Score ≥ 6 (L/XL) or Risk signal = 2
> (auth/payments/data/infra) -> Print scores and REFUSE: _"Exceeds this tier's
> budget. Decompose with `vertical-slice-decomposer` or escalate to
> dev-team-sub-max."_ STOP.

## Phase 2 — Single-Lane & Quota Ledger (COMPRESSED)

- Slice turn budget: **20 turns max**. Branch-based (no git worktrees).
- Quota Ledger (`.dev-team/quota.md`):
  `[turns: used/20 | active_model | headroom | swap_count]`.
- Lane Ledger: `lane-1` | task | size | Builder+Checker | current branch |
  `.dev-team/lanes/lane-1.md` | Active | gate.
- **CHECKPOINT-BEFORE-GATE:** Write `.dev-team/lanes/lane-1.md` BEFORE entering
  any gate.

## Phase 3 — Two-Hat Execution, Mode B Protocol & Slices (UNREVIEWED vs PROVISIONAL)

### Mode B Consolidate-and-Park Protocol (FULL)

On a single-lane $20/mo subscription, there is no headroom to spend probing
fallback rungs.

- On encountering Mode B account-wide limit, or reaching 20 turns:
  1. Compact all stack facts, file paths, decisions, and **OPTIONS REJECTED WITH
     REASONS** into `.dev-team/analysis/lane-1.md`.
  2. Write state file `.dev-team/lanes/lane-1.md` with status `UNREVIEWED`.
  3. PARK, report progress, and report reset window in State 3 disclosure.

### Slice Status Definitions: UNREVIEWED vs PROVISIONAL (FULL)

- **PROVISIONAL Slices:** Reviewed by a degraded Checker (same model or L2/L3
  isolation). Marked `PROVISIONAL` in Lane Ledger and state file. Re-reviewed
  when capacity returns or requires explicit Tech-Lead waiver.
- **UNREVIEWED Slices:** Work where the run stopped before Checker ran or
  completed (Mode B park). UNREVIEWED work has received NO verification pass.
- **Risk-2 Work Rule:** Auth, payments, data, and infrastructure changes MAY NOT
  close on a PROVISIONAL or UNREVIEWED approval — PARK instead.

### Findings Ledger Structure (COMPRESSED)

File: `.dev-team/analysis/lane-1.md`. Contains stack facts, file paths, domain
boundaries, Figma measurements, decisions, and **OPTIONS REJECTED WITH REASONS**
(mandatory).

### Checker Isolation & Visual Gate

Checker runs in fresh sub-agent context. Must **ACT, not read**. Figma spec in
plan STILL required. Visual gate captures 2 viewports (Desktop/Mobile).

## Phase 4 & 5 — Gates & Friction Defect Protocol

Batch questions in `.dev-team/inbox.md`. PARK is a hard stop. Inbox is read-only
after human responds.

- **Friction Defect Trigger:** Write `.dev-team/friction/<date>-<slug>.md` if
  rework ≥2 on a gate, skill misbehaviour, missing tool, **or if lane swaps
  models >2 times or Checker falls to Rung 3**. Draft-only unless
  `DEV_TEAM_AUTOFILE_ISSUES=1`.

> [!CAUTION] **ABSOLUTE RULE** `git push`, `git add`, and `merge` are STRICTLY
> FORBIDDEN.

## Telemetry

Pass `{ teamRole: "<ROLE>", loopRunId: "<MISSION_ID>", actorType: "AGENT" }` on
every skill call.

## Three Mandatory End-State Disclosures (FULL — VERY FIRST LINE OF OUTPUT)

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

Emit Provenance Table
(`| Phase | Role | Model | Isolation | Reason for swap | Effect on the claim |`)
beneath disclosure line.

## Four Pillars & Anti-Rationalization

### Anti-Rationalization Protocol

| Rationalization                                                               | Rebuttal / Required Behavior                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| "It's an L task, but I can handle it in Sub-Pro."                             | Score L/XL or Risk 2 MUST be refused immediately. Escalate to Sub-Max or Dev-Team-Orchestrator.  |
| "Since we don't use worktrees, I'll commit directly."                         | `git add` and `git push` are strictly forbidden. Edits remain uncommitted.                       |
| "I'm the Builder so I can self-certify the review."                           | Checker must run in fresh sub-agent context and paste hard evidence.                             |
| "The audit passed anyway, so the notice would just worry them."               | A pass from the author is not a pass; the notice IS the finding. Emit disclosure line as line 1. |
| "The model swap was handled automatically, so it's an implementation detail." | Handling it seamlessly is why developer cannot see it, which is exactly why it must be stated.   |
| "It is already recorded in the provenance table below."                       | A table row is not a disclosure; the first line is.                                              |
