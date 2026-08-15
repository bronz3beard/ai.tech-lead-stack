---
name: reflexion-loop-sub-max
description: >
  [LOOP · SUB-MAX · NO API KEYS · CROSS-MODEL VERIFY] $100/mo tier
  context-isolated plan hardening loop. Manages multi-vendor model isolation
  (L0-L3) and exhaustion limits without losing work, delivering cross-model
  verified plans without requiring API keys. (Note: The stated token cost is per
  loop/run).
cost: ~1400 tokens
modes: [read-only, write, mcp]
surface: public
category: Plan & Harden
how:
  'Multi-vendor model contract, Findings Ledger, and context-firewalled critic
  isolation'
useCase:
  'Plan hardening on a $100/mo subscription without requiring external API keys'
---

# Reflexion Loop ($100/mo Tier - No API Keys)

> Tier siblings: reflexion-loop (API keys, dual-model) · reflexion-loop-sub-max
> ($100 tier) · reflexion-loop-sub-pro ($20 tier). See the tier table in the
> README.
>
> [!NOTE] **Tier profile ($100/mo subscription):** Hardens implementation plans
> using multi-vendor model isolation (L0–L3) without requiring API keys. Handles
> model exhaustion limits seamlessly while preserving verification integrity.

## Pre-Flight Model Contract (MANDATORY BEFORE PHASE 0)

Read active models from the agent harness at runtime. Formulate and print the
Pre-Flight Model Contract before Phase 0:

| Role               | Model class assigned          | Isolation vs writer | Continuity Fallback      |
| ------------------ | ----------------------------- | ------------------- | ------------------------ |
| Generator (Writer) | frontier                      | N/A (author)        | Rung 1 -> Rung 2         |
| Critic (Auditor)   | a different vendor's frontier | L0 (cross-vendor)   | Rung 1 -> Rung 2 -> Park |

### Environment Check (`CLAUDE_CODE_SUBAGENT_MODEL`)

If `CLAUDE_CODE_SUBAGENT_MODEL` is set to anything other than `inherit`, warn
plainly in chat and cap claimed isolation level at **L2** (same-model
sub-agent). Never claim L0 or L1 when overridden by environment variables.

### Four-Level Isolation Ladder

- **L0 (Cross-Vendor)**: Generator and critic run on models from different
  vendors. Default target.
- **L1 (Cross-Family, Same Vendor)**: Generator and critic run on different
  model families from same vendor (shared lineage limitation apply).
- **L2 (Fresh Sub-Agent)**: Same model, fresh sub-agent context receiving ONLY
  plan text + rubric + diagnosis.
- **L3 (Fresh Session)**: Same model, plan pasted into a new session cold.

**Rule:** Critic is FORBIDDEN from seeing writer's drafting conversation or
rationale.

## Quota Discipline & Findings Ledger

- **Turn Budget:** 12 agent turns per run. Print
  `[turn N/12 | model: <active-model>]`.
- **Findings Ledger (`.loop-out/<runId>/findings.md`):** Write stack facts, file
  paths, domain boundaries, decisions taken, and **OPTIONS REJECTED WITH
  REASONS** (mandatory) to survive model swaps without re-discovery.
- **State File (`.loop-out/<runId>/state.json`):** Checkpoint after EVERY phase.
  Include `generatorModel`, `criticModel`, `activeIsolationLevel`, and `status`.
- **Cold Resume Protocol:** If `.loop-out/<runId>/state.json` exists, read it
  and Findings Ledger, then resume from recorded phase. **Never re-run Phase 0
  discovery on resume.**

## Model Continuity, UNREVIEWED vs PROVISIONAL Verdicts

### Exhaustion Modes A/B/C & Fallback Ladder

- **Mode A (MODEL-SCOPED):** Quota spent on one model. Try Rung 1 (cross-vendor
  frontier) -> Rung 2 (same vendor lower class). Recompute isolation level.
- **Mode B (ACCOUNT-WIDE):** Consolidate into Findings Ledger, checkpoint state
  as `PARKED`, report reset window. State 3 disclosure applies.
- **Mode C (SILENT DOWNGRADE):** Poll model identity at every phase boundary.
  Any change is treated as a swap event.
- **PROVISIONAL Verdict:** If plan passed critique under a degraded critic (same
  model or L2/L3 isolation), mark verdict as `PROVISIONAL`. PROVISIONAL plans
  require explicit Tech-Lead sign-off.
- **UNREVIEWED Verdict:** If the run stopped before the critic ran or completed
  (Mode B park), mark status as `UNREVIEWED`.

## Three Mandatory End-State Disclosures (VERY FIRST LINE OF VERDICT OUTPUT)

The FIRST line of `.loop-out/<runId>/verdict.md` and final chat output MUST emit
exactly one of these three end states:

- **STATE 1 — Separation Held (Auditor finished on a different model):**

  ```text
  Model separation held: written by <generator-model>, audited by <critic-model>.
  ```

- **STATE 2 — Separation Lost (Auditor FINISHED, but on the writer's model):**

  ```text
  MODEL SEPARATION LOST: <generator-model> wrote this work and also audited it.
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

## Four Pillars Compliance & Anti-Rationalization

### Anti-Rationalization Rebuttals

| Rationalization                                                               | Rebuttal                                                                                         |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| "The plan looks fine, let me skip the rubric."                                | Unscored is unhardened. Produce the rubric.                                                      |
| "I'll harden it after I start coding."                                        | Rework after code is 10x more expensive.                                                         |
| "I have no second model so the loop is pointless."                            | Context isolation is degraded, not absent — declare level and proceed.                           |
| "The audit passed anyway, so the notice would just worry them."               | A pass from the author is not a pass; the notice IS the finding. Emit disclosure line as line 1. |
| "The model swap was handled automatically, so it's an implementation detail." | Handling it seamlessly is why developer cannot see it, which is exactly why it must be stated.   |
| "It is already recorded in the provenance table below."                       | A table row is not a disclosure; the first line is.                                              |

## Exit States

Concludes in one of: `PASSED`, `PROVISIONAL`, `PARKED`, `CAPPED`, `ABORTED`.
