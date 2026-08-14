---
name: reflexion-loop-sub-pro
description: >
  [LOOP · SUB-PRO · NO API KEYS] $20/mo tier context-isolated loop. One good
  adversarial pass, not a hardened plan.
cost: ~700 tokens
modes: [read-only, write, mcp]
surface: public
category: Plan & Harden
how: Simulated context isolation (frugal)
useCase: Quick single-pass check on a $20/mo subscription
---

# Reflexion Loop ($20/mo Tier - No API Keys)

This tier's honest promise is **"one good adversarial pass"**, not "a hardened
plan".

## Deltas from Sub-Max

To trade off for the $20/mo subscription tier's stricter quota limits, the
following constraints apply compared to the $100/mo tier:

- **Revisions:** ONE critique pass. Max 1 revision. Pass threshold 7 (not 8).
- **Turn Budget:** 5 agent turns per run. Print the turn count in every phase
  header, e.g. `[turn 2/5]`.
- **Discovery Cap:** At most 4 scoped greps and 3 file reads. Manifest + one
  config file.
- **Condensed Rubric:** ONE line per pillar, integer score, no prose critique,
  one fix.
- **Plan Cap:** <= 400 words, <= 8 atomic tasks. If the brief cannot fit, that
  IS the finding — return "TOO LARGE FOR THIS TIER, decompose first" and point
  at `vertical-slice-decomposer`.
- **Context Firewall:** L2 or L3 only. L1 assumes a second paid subscription,
  which a $20/mo dev by definition does not have.
- **Artifacts:** ONE artifact file, `.loop-out/<runId>/loop.md`, with all
  sections as headings. Multiple files cost multiple write turns.

## Mandatory Escalation Ladder

If the brief scores **Risk 2** on the dev-team rubric (auth, payments, customer
data, or infra), this tier **MUST refuse** to be the hardening gate. It must
state:

> "Risk-2 change: single-pass hardening is insufficient. Escalate to
> reflexion-loop-sub-max, or reflexion-loop with API keys, or obtain explicit
> Tech-Lead sign-off to proceed un-hardened."

Then it stops. **NEVER silently bypass a gate.**

## Four Pillars Compliance

This loop mechanically enforces the Four Pillars:

- **P1 G-Stack**: Phase 0 is a hard precondition; the generator receives the
  diagnosis or does not run.
- **P2 MinimumCD**: Every emitted task <100 LOC with its own verification gate;
  plans that cannot be sliced are rejected, not stretched.
- **P3 Prod Ethos**: The critic's numeric rubric IS the gate; include an
  explicit ANTI-RATIONALIZATION table (see below).
- **P4 Modern Web**: The critic scores whether the plan reaches for modern
  platform APIs over legacy shims, and flags legacy choices as deviations.

### Anti-Rationalization Rebuttals

| Rationalization                                    | Rebuttal                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| "The plan looks fine, let's skip the rubric."      | Unscored is unhardened. Produce the rubric.                                                     |
| "I'll harden it after I start coding."             | The loop exists because rework after code is 10x more expensive.                                |
| "I have no second model so the loop is pointless." | Context isolation is degraded, not absent — declare the level and proceed.                      |
| "The critic agreed with me immediately."           | A 10/10 first pass is a firewall-leak smell. Re-run the critique at a stronger isolation level. |

## Quota Discipline (Turns, not USD)

- **Turn Budget:** 5 agent turns per run. Print the turn count in every phase
  header, e.g. `[turn N/5]`.
- **Checkpoint:** Checkpoint state to `.loop-out/<runId>/loop.md` to track
  progress and budget.
- **Turn Cap:** On hitting the turn cap: print state `CAPPED` and stop. Never
  silently continue past a budget.

## Context Firewall

You must declare the Context Firewall level used in the artifact:

- **L2 (default)**: A fresh sub-agent / task-tool invocation with a clean
  context window, receiving ONLY: the plan text + the rubric + the Phase-0
  diagnosis.
- **L3 (weakest)**: A new chat session in the same tool, plan pasted in cold.
  _(L1 is not available in this tier.)_

## Exit States

The run concludes in one of these states:

- `PASSED`
- `PARKED`
- `CAPPED`
- `ABORTED`
