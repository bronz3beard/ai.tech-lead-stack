---
name: reflexion-loop
description: >
  [LOOP · DUAL-MODEL · API KEYS] ✨ SPECIAL FEATURE (not agent-agnostic —
  requires API keys). A self-correcting generator–critic–adjudicator loop that
  turns a brief into a Four-Pillars-graded implementation plan. Gemini drafts
  the plan, Claude grades it 0–10 on each pillar and returns ONE actionable fix,
  the router rewrites or stops, and Claude writes the final verdict. Runs the
  real two-model loop via `rtk run reflexion-loop` or the `reflexion_loop` MCP
  tool. Use when you want a plan hardened by an independent critic before
  committing engineering time. (Note: The stated token cost is per loop/run).
cost: ~900 tokens
modes: [read-only, write, mcp]
surface: public
category: Plan & Harden
---

# Reflexion Loop (Special Feature)

## Runtime modes

Produces a verifiable loop blueprint in read-only chat, and executes + verifies
the loop phase in an IDE/MCP agent.

> [!IMPORTANT] **This is the one non-agent-agnostic skill in the stack.** Every
> other skill works with any LLM driving your IDE. This one calls **two** models
> directly (Gemini as the writer, Claude as the grader) so the writer never
> grades its own work — the same rule the codebase enforces in
> `validateDistinctModels`. It needs `GEMINI_API_KEY` and `ANTHROPIC_API_KEY`.

**Sibling tiers:** No API keys? Use `reflexion-loop-sub-max` ($100/mo tier) or
`reflexion-loop-sub-pro` ($20/mo tier).

## Two surfaces, two behaviours (read this)

| Surface                                           | Behaviour                                                                                                   | Code changes?                                      | Telemetry                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------- |
| **Website page + chat**                           | **Read-only / advisory.** Runs the full loop, then returns a reviewed plan **and a copy-paste IDE prompt**. | **Never.** Output is a prompt you carry to an IDE. | n/a                                 |
| **MCP tool + Antigravity workflow** (in your IDE) | **Developer path.** Same loop; the IDE agent then **implements** the reviewed plan.                         | **Yes** — the agent edits code from the plan.      | Logged to Prisma (`source: 'mcp'`). |

Same engine, same loop. The only difference is what happens _after_ the loop:
the web/chat surface hands you a prompt; the IDE surface proceeds to build.

## Invoke

- **Terminal / any repo:** `rtk run reflexion-loop -- "<your brief>"`
- **MCP (Antigravity / Cursor / Claude Desktop):** call the `reflexion_loop`
  tool (exposed by `npm run mcp:start`, already wired by `lead-init`).
- **Website:** the **Reflexion Loop** page (uses your saved keys from Settings).

## What it does

1. **Phase 0 — Diagnosis (Pillar 1).** Reads the target repo's `package.json` /
   `tsconfig.json` / etc. and feeds that to the generator.
2. **Generate (Gemini).** Produces an implementation plan with atomic (<100 LOC)
   tasks and verification gates.
3. **Critique (Claude).** Scores G-Stack, Atomic Batches, Production Ethos, and
   Modern Web 0–10, plus an overall score and ONE fix.
4. **Route.** Pass (score ≥ threshold) or revision cap → stop; else rewrite
   carrying only that one fix. This is the diminishing-returns stop.
5. **Adjudicate (Claude).** A plain-English go/no-go for the Tech Lead.

Artifacts: `.reflexion-out/plan.md`, `ide-prompt.md`, `critique.json`,
`interview.md`, `diminishing-returns.svg`.

## Flags and CLI usage

- `--auto`: Run to completion (either pass or fail), never park.
- `--interactive`: Adjudicator questions are asked inline on TTY.
- `--answers <file.yaml|->`: Resume with a yaml answers payload.
- `--resume <runId|dir>`: Resume a parked run.
- `--max <n>`: Revision cap (default: 3).
- `--threshold <n>`: Pass score threshold (default: 8).
- `--max-cost-usd <n>` / `--max-tokens <n>`: Set budget caps for the run.
- `--focus <p,p>`: Comma-separated list of pillars to focus the critic on.

## Run Lifecycle & Exit Codes (Deterministic)

The CLI returns explicit exit codes indicating the state:

- **0**: `passed` or `user-approve`. The plan is ready, `ide-prompt.md` written.
- **2**: Parked (`AWAITING_ANSWERS`). The adjudicator has questions; edit
  `interview.md` and resume.
- **3**: `budget-exceeded` or `user-stop`. Budget cap tripped or manually
  halted.
- **4**: `refine-contract-violation` or internal error. Section rewrite failed
  strict verification.

## Hand-off

On approval, pass `.reflexion-out/plan.md` to `planning-expert` (or
`vertical-slice-decomposer`) to execute the atomic task list.
