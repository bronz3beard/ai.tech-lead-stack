---
name: reflexion-loop-sub-max
description: >
  [LOOP · SUB-MAX · NO API KEYS] $100/mo tier context-isolated plan hardening
  loop. (Note: The stated token cost is per loop/run).
cost: ~1200 tokens
modes: [read-only, write, mcp]
surface: public
category: Plan & Harden
how: Simulated context isolation
useCase: When you need a hardened plan but only have one subscription
---

# Reflexion Loop ($100/mo Tier - No API Keys)

## The Central Design Problem

The dual-model loop's integrity comes from `validateDistinctModels` — the writer
physically cannot grade its own work because a different vendor's model does the
grading. With one subscription and no API keys you cannot reproduce that
guarantee. So you replace **MODEL isolation** with **CONTEXT isolation**.

This skill provides a Context Firewall. Do not claim it has the same assurance
as the dual-model API version.

### Context Firewall

You must specify a "Context Firewall" with three isolation levels, in descending
strength, and the skill MUST DECLARE which one it used in every artifact:

- **L1 (strongest)**: A second, different vendor's subscription the dev already
  pays for (e.g., drafts in one IDE agent, critiques in another). Closest to the
  API guarantee.
- **L2 (default)**: A fresh sub-agent / task-tool invocation with a clean
  context window, receiving ONLY: the plan text + the rubric + the Phase-0
  diagnosis. It MUST NOT receive the drafting conversation, the author's
  rationale, or any "here's what I was going for" preamble.
- **L3 (weakest)**: A new chat session in the same tool, plan pasted in cold.

**Rule:** The critic is FORBIDDEN from seeing the writer's reasoning. A critic
that reads the author's justification grades the justification, not the plan.

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

On a subscription, the scarce resource is MESSAGES and rolling-window rate
limits.

- **Turn Budget:** 12 agent turns per run. Print the turn count in every phase
  header, e.g. `[turn 4/12]`.
- **Checkpoint:** After EVERY PHASE, checkpoint to
  `.loop-out/<runId>/state.json` — brief, diagnosis, revision number, all scores
  so far, the pending one-fix, isolation level used.
- **Cold Resume Protocol:** On invocation, if `.loop-out/<runId>/state.json`
  exists, read it and resume from the recorded phase. **Never re-run Phase 0
  discovery on a resume**; that is the single most expensive thing you can waste
  a fresh window on.
- **Turn Cap:** On hitting the turn cap: checkpoint, print state `CAPPED`, and
  stop. Never silently continue past a budget.

## Loop Mechanics

1. **Phase 0 (Diagnosis):** Read manifest/config to identify stack +
   constraints. Every grep MUST exclude `node_modules`, `.next`, `.nx`, `dist`,
   `build`. No unscoped recursion.
2. **Generate:** Implementation plan, atomic tasks <100 LOC each, explicit
   verification gate per task.
3. **Critique:** Score G-Stack, Atomic Batches, Production Ethos, and Modern Web
   at 0-10 each, plus an overall, plus EXACTLY ONE actionable fix. Each score
   needs a one-line justification citing something concrete in the plan — no
   bare numbers.
4. **Route:** Pass at overall >= 8, cap at 3 revisions. Carry ONLY that one fix
   into the rewrite (diminishing-returns discipline).
5. **Adjudicate:** Plain-English go/no-go for the Tech Lead.

## Artifacts

Located in `.loop-out/<runId>/`:

- `state.json`
- `plan.md`
- `critique-r<N>.md`
- `verdict.md`
- `ide-prompt.md`
- `scores.md` (Use a plain ASCII score-per-revision table, NOT an SVG)

## Exit States

The run concludes in one of these states:

- `PASSED`
- `PARKED`
- `CAPPED`
- `ABORTED`
