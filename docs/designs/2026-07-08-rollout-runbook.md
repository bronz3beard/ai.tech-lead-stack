# Rollout Runbook — Agentic Dev Team + Reflexion v2

> The operating order for `2026-07-08-jules-prompts.md`. One phase at a time;
> never start the next phase until the current gate passes. Your total
> hands-on time is concentrated in PR review + the gates below (~6–9 h across
> the rollout); everything else runs without you.

Run order: **1 → 2 → (3 ∥ 8) → 4 → 5 → 6 → 7**. Prompt 7 is last on purpose:
automate the loop only after you've trusted it manually (manual → supervised →
autonomous; guards against cognitive surrender, Loop Eng. Fig. 6).

---

## Phase 0 — Foundations (you, ~30–45 min, no agents)

- [ ] Commit the four docs to `docs/designs/` on `main`: design doc, WS-2
      spec, skills audit, this runbook. The prompts reference them by path.
- [ ] Baseline on `main`: run `pnpm check-types && pnpm test &&
      pnpm validate:skills && pnpm lint` — everything green *before* agents
      start, or every PR inherits the noise. Fix reds first.
- [ ] Snapshot analytics: note current `AnalyticsEvent` row count and grab a
      dashboard screenshot — your before/after for the new metrics.
- [ ] Secrets: `GEMINI_API_KEY` + `ANTHROPIC_API_KEY` in local `.env`;
      `ANTHROPIC_API_KEY` as a repo Actions secret now (Prompt 3 CI needs it),
      `GEMINI_API_KEY` too (Prompt 7 will).
- [ ] Decide caps you'll live with: `REFLEXION_MAX_COST_USD` (default 3),
      `maxRevisions` (default 3). Write them down; you'll tune via the
      interview later, not by editing code.

## Phase 1 — Foundation merges (Prompts 1 → 2, sequential, ~2–4 days elapsed)

- [ ] **Prompt 1** (actor telemetry) → one Jules session → PR. Review with the
      Appendix checklist; merge.
- [ ] Gate 1a: run the backfill dry-run, read its report, then run it live.
- [ ] Gate 1b: send one chat message in the web UI, then confirm in the DB it
      landed `actorType: HUMAN`; confirm one MCP call lands `AGENT`.
- [ ] **Prompt 2** (reflexion v2) → session → PR. Before merging, on the
      branch: run `rtk run reflexion-loop` with a toy brief; force a park
      (low threshold), open `interview.md`, answer the yaml, `--resume`;
      `kill -9` a run mid-critique and `--resume` it to completion.
- [ ] Gate 2: one full real-brief run end-to-end; verify per-phase telemetry
      rows carry `loopRunId`/`loopPhase`; verify `--max-cost-usd 0.05` stops
      with `stopReason: budget-exceeded` and persisted state. Merge.

## Phase 2 — Calibration + conformance (Prompts 3 ∥ 8, parallel, ~1–2 days)

- [ ] **Prompt 3** (defect library) and **Prompt 8** (skills readiness, full
      prompt at the bottom of the audit doc) in two parallel Jules sessions —
      they touch disjoint files.
- [ ] Gate 3 (after merging 3): run `rtk run reflexion-eval` yourself once.
      DL-001..006 must FAIL, DL-007 must PASS. Keep `report.json` — it's your
      ERR baseline. If any DL case doesn't behave, the evaluator is nodding:
      **stop here and tune `CRITIC_SYSTEM` until it does.** Nothing downstream
      is trustworthy before this gate.
- [ ] Gate 8 (after merging 8): `pnpm validate:skills` green with the new
      checks; `pnpm generate:registry` twice → `git status` clean; open three
      skills in the read-only web UI and confirm the Runtime-modes line reads
      sensibly to a human.
- [ ] **Hard rule: do not start Prompt 4 until both gates pass** — the
      orchestrator selects skills by Prompt-8 frontmatter and hands plans to a
      Prompt-3-calibrated evaluator.

## Phase 3 — The team (Prompts 4 → 5, ~2–3 days)

- [ ] **Prompt 4** (dev-team-orchestrator) → session → PR → merge.
- [ ] Gate 4a: dry-run the Crew Sizing Gate on three real backlog items you
      pre-size in your head (one XS, one M, one L). The printed scores should
      roughly match your intuition; if XS items summon a planner, tighten the
      rubric wording before real use.
- [ ] Gate 4b: run ONE S-sized task end-to-end in an IDE (Antigravity or
      Cursor): worktree lane created, Lane Ledger updated, interview batched
      to `.dev-team/inbox.md`, friction file drafted but **no** auto-filed
      issue (`DEV_TEAM_AUTOFILE_ISSUES` unset).
- [ ] **Prompt 5** (competitive-analysis) → session → PR → merge.
- [ ] Gate 5: run it against one real external source; confirm Phase-0
      self-inventory ran first, at least one pillar-conflict auto-decline is
      exercised (pick a source that praises big-bang delivery), and the report
      lands in `.dev-team/competitive/`.

## Phase 4 — Observability (Prompt 6, ~1 day + patience)

- [ ] **Prompt 6** (Agentic Health dashboard) → session → PR. In review,
      specifically hunt for any number that blends HUMAN and AGENT rows —
      reject if found. Merge.
- [ ] Gate 6: empty-state renders with zeros (no NaN); seeded fixtures show
      all four ERR badge states; your Gate-3 baseline ERR is plotted in the
      healthy band. Real trends need ~a week of runs — that's fine, ship it
      sparse.

## Phase 5 — Hands-off (Prompt 7, last, ~1 day)

- [ ] **Prompt 7** (issue-driven cloud runner) → session → PR → merge.
- [ ] Gate 7 (full rehearsal on a scratch issue): apply `reflexion:run` from
      your phone → bot comment with scores + questions → reply with the yaml →
      refined result → `approve` → `ide-prompt` posted + `reflexion:approved`
      label. Then once with `REFLEXION_MAX_COST_USD=0.05` to see the budget
      stop in the wild.
- [ ] Only after 2–3 clean supervised issue-runs: consider uncommenting the
      cron trigger. Not before.

---

## Steady-state cadence (after rollout)

- Daily: label issues `reflexion:run` at night; answer interviews from your
  phone over coffee; sit down only for approved `ide-prompt.md` execution and
  PR merges.
- Per incident: every "the reviewer missed X" becomes a DL-case the same day;
  every friction file becomes a real GitHub issue at a weekly triage.
- Weekly: glance at ERR on the dashboard — `NODDING_LOOP` badge → recalibrate
  with the defect library; `BLOCKED_EVALUATOR` → the generator or rubric
  drifted. Check cost-per-passed-plan trend against your caps.
- Always: **you** merge. The approve gate never gets automated away, even at
  high trust — that's the one door that stays open.

## Rollback map

Every prompt = one PR = one revert. Additionally: WS-1/WS-2 migrations are
additive (revert drops only new columns/tables); v2 `.reflexion-out/` dirs are
inert to v1 code; Prompt-8's generator can be reverted while keeping the
frontmatter (it's inert metadata to v1 tooling); the WS-7 workflow file can be
deleted independently — state artifacts simply expire.
