---
name: reflexion-loop-sub-pro
description: >
  [LOOP · SUB-PRO · NO API KEYS · CROSS-MODEL VERIFY] $20/mo tier
  context-isolated loop. Single-pass cross-model plan check enforcing Mode B
  quota handling and mandatory disclosure without requiring API keys.
cost: ~1200 tokens
modes: [read-only, write, mcp]
surface: public
category: Plan & Harden
how:
  'Single-pass Generator/Critic model contract, Mode B consolidate-and-park, and
  mandatory three-state end-state disclosure'
useCase:
  'Frugal single-pass plan verification on a standard ($20/mo) subscription
  without API keys'
---

# Reflexion Loop ($20/mo Tier - No API Keys)

> [!NOTE] **Tier profile ($20/mo subscription):** Honest promise: **"One good
> adversarial pass"**, not a hardened plan. Operates as a single-pass
> cross-model check on a 5-turn budget without API keys.

<!-- -->

> [!NOTE] **Frugal Compression Notice:** Multi-lane rebalancing is **OMITTED**.
> The L0–L3 ladder, fallback rungs, and Findings Ledger structure are
> **COMPRESSED**. Detailed mechanics reference `reflexion-loop-sub-max` by name.
> The Pre-Flight Model Contract, `CLAUDE_CODE_SUBAGENT_MODEL` check, Mode B
> consolidate-and-park protocol, and Mandatory Three-State Disclosure rules are
> included **FULL and uncompressed**.

## Pre-Flight Model Contract (FULL)

Read active models from agent harness at runtime. Formulate and print:

| Role               | Model class assigned                                            | Isolation vs writer | Continuity Fallback |
| ------------------ | --------------------------------------------------------------- | ------------------- | ------------------- |
| Generator (Writer) | frontier / mid (e.g. Claude 3.7 Sonnet as of June 2026)         | N/A (author)        | Consolidate & Park  |
| Critic (Auditor)   | different vendor frontier (e.g. Gemini 2.5 Pro as of June 2026) | L0 (cross-vendor)   | L1 -> L2 -> Park    |

> **Sub-Pro Note:** Sub-pro is **throughput-limited** (one critique pass,
> tighter turn budget), not model-limited. Cross-vendor L0 isolation is
> reachable on the entry tier wherever the platform offers one lineup across
> paid tiers. Model availability is platform-dependent; read the harness's
> actual model list at runtime instead of assuming a tier ceiling.

### Environment Check (`CLAUDE_CODE_SUBAGENT_MODEL` — FULL)

If `CLAUDE_CODE_SUBAGENT_MODEL` is set to anything other than `inherit`, warn
plainly in chat and cap claimed isolation level at **L2** (same-model
sub-agent). Never claim L0 or L1 when overridden by environment variables.

### Isolation Ladder (COMPRESSED)

- **L0 (Cross-Vendor)**: Different vendor models. **L1**: Cross-family, same
  vendor. **L2**: Fresh sub-agent. **L3**: Cold paste.

## Single-Pass Mechanics & Quota Discipline

- **Deltas:** 1 critique pass, max 1 revision, pass threshold 7/10, budget 5
  turns (`[turn N/5 | model: <active-model>]`), plan <= 400 words / <= 8 tasks.
- **Risk-2 Refusal:** Risk signal = 2 (auth/payments/data/infra) -> MUST refuse
  single-pass hardening and escalate to `reflexion-loop-sub-max`.

## Mode B Consolidate-and-Park Protocol (FULL)

On encountering Mode B account-wide limit, or reaching 5 turns:

1. Write brief, diagnosis, score, decisions, and **OPTIONS REJECTED WITH
   REASONS** (mandatory) to `.loop-out/<runId>/loop.md`.
2. Mark status as `UNREVIEWED` (or `PROVISIONAL` if degraded critic was used).
3. Report progress and reset window in State 3 disclosure.

## Three Mandatory End-State Disclosures (FULL — VERY FIRST LINE OF OUTPUT)

The FIRST line of `.loop-out/<runId>/loop.md` and final chat output MUST emit
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

## Four Pillars & Anti-Rationalization

| Rationalization                                                               | Rebuttal                                                                                         |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| "The plan looks fine, let me skip the rubric."                                | Unscored is unhardened. Produce the rubric.                                                      |
| "Risk-2 task can be done in Sub-Pro."                                         | Risk-2 MUST refuse single-pass hardening. Escalate.                                              |
| "The audit passed anyway, so the notice would just worry them."               | A pass from the author is not a pass; the notice IS the finding. Emit disclosure line as line 1. |
| "The model swap was handled automatically, so it's an implementation detail." | Handling it seamlessly is why developer cannot see it, which is exactly why it must be stated.   |
| "It is already recorded in the provenance table below."                       | A table row is not a disclosure; the first line is.                                              |

## Exit States

Concludes in one of: `PASSED`, `PROVISIONAL`, `UNREVIEWED`, `PARKED`, `CAPPED`,
`ABORTED`.
