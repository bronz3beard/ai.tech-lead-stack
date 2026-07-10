# SETUP WALKTHROUGH — Agentic Dev Team, end to end

> **This is the only document you follow.** Top to bottom, step numbers in
> order, tick the boxes. Every step is one action followed by "→ expect:" so you
> know it worked. If a step fails, stop there — the fix is either in the
> Troubleshooting table at the bottom or it's a defect to report. Elapsed time:
> ~7–10 days (agents do the building). Your hands-on time: ~6–9 hours total,
> mostly PR reviews and the gates marked **GATE**.

## The document pile, decoded (30 seconds)

| File                                             | What you do with it                                                                                   |
| :----------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **`2026-07-10-setup-walkthrough.md`**            | **Follow it. This file.**                                                                             |
| **`AGENTS.md`**                                  | **Save at your repo root** (Step 11a) — Jules reads it automatically, no more pasting Standing Rules. |
| `2026-07-08-jules-prompts.md`                    | **Copy-paste from it** — PROMPT 0–7 text goes into Jules, nothing else.                               |
| `2026-07-08-skills-readiness-audit.md`           | **Copy-paste PROMPT 8** from its bottom section (Step 26).                                            |
| `2026-07-08-agentic-dev-team-design.md`          | Reference. The agents read it; you never have to.                                                     |
| `2026-07-08-reflexion-loop-v2-interview-gate.md` | Reference. The spec Session 2's agent builds from.                                                    |
| `2026-07-08-rollout-runbook.md`                  | Condensed gate list — superseded by this walkthrough. Keep or delete.                                 |

---

## PART A — One-time prerequisites (Steps 1–8, ~20 min)

- [ ] **Step 1 — Clean repo on main.**

  ```bash
  cd <your-clone-of-ai.tech-lead-stack>
  git checkout main && git pull && git status
  ```

  → expect: `nothing to commit, working tree clean`.

- [ ] **Step 2 — Dependencies install.**

  ```bash
  pnpm install
  ```

  → expect: completes without errors.

- [ ] **Step 3 — Database reachable.** Your `.env` has `DATABASE_URL`; run:

  ```bash
  npx prisma migrate status
  ```

  → expect: `Database schema is up to date!` (If you use a hosted DB, same check
  against it.)

- [ ] **Step 4 — Model keys locally.** `.env` contains both `GEMINI_API_KEY=...`
      and `ANTHROPIC_API_KEY=...` (the loop uses Gemini to generate and Claude
      to critique — it needs both).

- [ ] **Step 5 — Model keys in GitHub.** On github.com →
      `bronz3beard/ai.tech-lead-stack` → **Settings → Secrets and variables →
      Actions → New repository secret**: add `ANTHROPIC_API_KEY` (Session 3's CI
      needs it) and `GEMINI_API_KEY` (Session 8 needs it). → expect: both listed
      under Repository secrets.

- [ ] **Step 6 — Jules can see the repo.** Open Jules (jules.google.com),
      confirm `bronz3beard/ai.tech-lead-stack` is connected and you can start a
      session with source branch `main`.

- [ ] **Step 7 — GATE: baseline is green.**

  ```bash
  pnpm check-types && pnpm test && pnpm validate:skills && pnpm lint
  ```

  → expect: all four pass. **If anything is red, fix it before Step 9** —
  otherwise every agent PR inherits the noise and you can't tell their failures
  from yours.

- [ ] **Step 8 — Snapshot "before".** Run `npx prisma studio`, open
      `AnalyticsEvent`, note the row count somewhere. Screenshot your current
      dashboard. (This is your before/after proof once the new metrics land.)

---

## PART B — Publish the docs the agents will read (Steps 9–11, ~5 min)

- [ ] **Step 9 — Copy the files in.** From wherever you downloaded them:

  ```bash
  mkdir -p docs/designs
  cp ~/Downloads/2026-07-08-agentic-dev-team-design.md \
     ~/Downloads/2026-07-08-jules-prompts.md \
     ~/Downloads/2026-07-08-reflexion-loop-v2-interview-gate.md \
     ~/Downloads/2026-07-08-skills-readiness-audit.md \
     ~/Downloads/2026-07-08-rollout-runbook.md \
     ~/Downloads/2026-07-10-setup-walkthrough.md \
     docs/designs/
  ```

- [ ] **Step 10 — Commit and push to main.**

  ```bash
  git add docs/designs/2026-07-*.md
  git commit -m "docs: agentic dev team designs, prompts, walkthrough"
  git push
  ```

  → expect: push succeeds. (Yes, straight to main — these are docs, and the
  prompts reference them at these exact paths.)

- [ ] **Step 11 — Verify the paths exist on GitHub.** Open the repo in a browser
      → `docs/designs/` → all six files visible. The prompts tell Jules to read
      `docs/designs/2026-07-08-agentic-dev-team-design.md` etc.; if the path is
      wrong, every session starts blind.

---

## Before Session 1 — give Jules the Standing Rules permanently (5 min, do once)

Jules automatically reads a file called `AGENTS.md` at your repo root at the
start of every task — no pasting required once it exists. This is a cross-tool
standard now (Cursor, Copilot, and most other agents read it too), so it's worth
having regardless of which tool ends up running these prompts.

- [ ] **Step 11a — Add the file.** Save the `AGENTS.md` content (provided
      alongside this walkthrough) at the **repo root** — `AGENTS.md`, not inside
      `.ai/`. It's the persistent version of the Standing Rules block;
      `.ai/agents.md` stays exactly as it is (that one's for IDE/MCP agents in a
      local checkout — the two complement each other).
  ```bash
  git add AGENTS.md
  git commit -m "chore: add AGENTS.md for Jules and other coding agents"
  git push
  ```
- [ ] **Step 11b — Trust, then verify.** For Session 1 only, still paste the
      Standing Rules block anyway, as a belt-and-suspenders check. Once Jules
      posts its Plan, look for it to reference the pillars/Phase-0 language
      unprompted — that's your evidence it actually read `AGENTS.md`. From
      Session 2 onward, stop pasting the block; just paste the prompt.

---

## PART C — The eight build sessions (Steps 12–38, ~7–10 days elapsed)

**The pattern — every session is the same five moves:**

1. Jules → **New session** → repo `ai.tech-lead-stack` → source branch `main`.
2. Open `docs/designs/2026-07-08-jules-prompts.md` (Session 4 below is the one
   exception — its prompt lives at the bottom of a different file, noted when
   you get there). Copy that session's prompt fenced block and paste it. (If you
   skipped the `AGENTS.md` step above, paste the **PROMPT 0 — Standing Rules**
   block first, then the prompt underneath, every time.)
3. Wait. Jules works on its own branch (the branch name is printed at the top of
   each prompt) and opens a PR. It never touches `main`.
4. **You review the PR** — checklist given per session below, plus the universal
   three: (a) real command output is _pasted_ in the PR, not described; (b)
   commits are small and independently revertible; (c) nothing out of scope was
   "helpfully" fixed.
5. Merge (however you normally merge; one PR = one revert unit), then run the
   session's **local verify** steps below.

**Run these 8 sessions in exactly this order, one at a time. Don't start the
next one until the current one is merged:**

1. Actor telemetry
2. Reflexion Loop v2
3. Defect library
4. Skills readiness pass
5. Dev-team-orchestrator
6. Competitive-analysis
7. Agentic Health dashboard
8. Cloud runner

That's the whole order. No exceptions, no shortcuts — just work top to bottom.

### Session 1 of 8 — Actor telemetry (who did the work: human or agent)

- [ ] **Step 12 — Start it.** Pattern moves 1–2 with **PROMPT 1**. → expect
      branch: `feature/ws1-actor-telemetry`.
- [ ] **Step 13 — Review the PR.** Specifically: the Prisma migration is
      additive only (new columns, no drops/renames); `withAnalytics` defaults
      are AGENT/DIRECTED with override support; backfill has unit tests; command
      outputs pasted. Merge.
- [ ] **Step 14 — Local verify.**
  ```bash
  git checkout main && git pull && pnpm install
  npx prisma migrate dev        # applies add_agentic_actor_telemetry
  npx tsx scripts/backfill-actor-type.ts          # DRY RUN — writes nothing
  ```
  → expect: dry-run prints what it _would_ tag, row counts, zero writes. Read
  it. If sane:
  ```bash
  npx tsx scripts/backfill-actor-type.ts --apply
  ```
- [ ] **Step 15 — GATE.** Start the app (`pnpm dev`), send one chat message in
      the web UI, then in `npx prisma studio` open `AnalyticsEvent`, sort
      newest: → expect: that event has `actorType: HUMAN`. If it says AGENT (or
      null), stop — every metric downstream depends on this tag being right.

### Session 2 of 8 — Reflexion Loop v2 (the interview gate)

- [ ] **Step 16 — Start it.** Pattern with **PROMPT 2**. → expect branch:
      `feature/ws2-reflexion-interview-gate`.
- [ ] **Step 17 — Review the PR.** Specifically: matches the spec's state
      machine and exit codes (0/2/3/4); the shared `RUBRIC` constant is still
      the single source for all prompts; a kill/resume integration test exists;
      the section-refine byte-diff guard exists. **Don't merge yet.**
- [ ] **Step 18 — Test-drive on the branch** (this is 15 minutes that buys you
      total confidence):
  ```bash
  git fetch && git checkout feature/ws2-reflexion-interview-gate && pnpm install
  rtk run reflexion-loop -- "Add a GET /api/health route returning { ok: true } with a unit test" --max-cost-usd 1
  ```
  → expect: console shows GENERATING → CRITIQUING → ADJUDICATING with pillar
  scores; `.reflexion-out/` now contains `state.json`, `plan.md`,
  `critique.json`, and — if it didn't auto-pass — `interview.md`; process exits
  2 (check with `echo $?`) meaning _parked, waiting for you_.
- [ ] **Step 19 — Answer the interview.** Open `.reflexion-out/interview.md`.
      You'll see up to five one-line questions and a pre-filled yaml template.
      Edit only the `answer:` lines, e.g.:
  ```yaml
  answers:
    runId: <already filled in>
    decisions:
      - id: q1
        answer: 'Return version from package.json too; no auth on this route.'
  ```
  (To end a run instead, replace `decisions:` with `directive: approve` or
  `directive: stop`.) Then resume:
  ```bash
  rtk run reflexion-loop -- --resume .reflexion-out/state.json --answers .reflexion-out/interview.md
  ```
  → expect: only the targeted plan section changes, it re-critiques, and either
  parks again or approves; on approve, `ide-prompt.md` appears.
- [ ] **Step 20 — Kill/resume drill.** Start a fresh run, hit `Ctrl-C` while
      it's mid-critique, then run the same `--resume` command. → expect: it
      continues from the last completed phase and finishes. This is the "walk
      away safely" guarantee.
- [ ] **Step 21 — Budget drill.**
  ```bash
  rtk run reflexion-loop -- "any brief" --max-cost-usd 0.05
  ```
  → expect: stops early, exit 3, `state.json` shows
  `stopReason: budget-exceeded`.
- [ ] **Step 22 — Merge, then GATE.** Merge the PR,
      `git checkout main && git pull`, `npx prisma migrate dev` (adds
      `ReflexionRun`). In prisma studio, filter `AnalyticsEvent` by
      `skillName = reflexion-loop`: → expect: one row per phase from your test
      runs, each carrying `loopRunId` and `loopPhase`, `actorType: AGENT`.

### Session 3 of 8 — Defect library

- [ ] **Step 23 — Start it.** Pattern moves 1–2 with **PROMPT 3**. → expect
      branch: `feature/ws3-defect-library`.
- [ ] **Step 24 — Review the PR.** Specifically: seven cases `DL-001..007` each
      with expectation frontmatter; the harness needs only `ANTHROPIC_API_KEY`;
      the CI job is skipped gracefully when the secret is absent. Merge.
- [ ] **Step 25 — GATE: the evaluator can say no.**
  ```bash
  git checkout main && git pull && pnpm install
  rtk run reflexion-eval
  ```
  → expect: a table where **DL-001 through DL-006 = FAIL (correctly rejected)**
  and **DL-007 = PASS**, exit 0, report written to `defect-library/report.json`.
  Save it:
  ```bash
  cp defect-library/report.json ~/reflexion-err-baseline-$(date +%F).json
  ```
  **If any case misbehaves, STOP HERE.** A critic that passes bad plans is a
  nodding loop — everything downstream would be theater. Tighten the wording in
  `src/lib/ai/reflexion/prompts.ts` (`CRITIC_SYSTEM`) and re-run until the table
  is correct.

### Session 4 of 8 — Skills readiness pass

- [ ] **Step 26 — Start it.** New Jules session. This is the one exception to
      the usual file: paste **PROMPT 0** from `2026-07-08-jules-prompts.md`,
      then the full **PROMPT 8** section copied from the **bottom of
      `2026-07-08-skills-readiness-audit.md`** (the findings and the fix live in
      that one file together). → expect branch: `feat/skills-readiness-pass`.
- [ ] **Step 27 — Review the PR.** Specifically: PR states (and the diff
      confirms) that no skill's _instructional_ body changed outside Runtime
      modes / Verification Gate / the knowledge-manager storage paragraph;
      idempotence proven (`generate:registry` twice → clean); validator
      break-then-fix output pasted. Merge.
- [ ] **Step 28 — GATE: one catalog everywhere.**
  ```bash
  git checkout main && git pull && pnpm install
  pnpm validate:skills
  pnpm generate:registry && pnpm generate:registry && git status --porcelain
  grep feature-orchestrator .ai/cursor-skills.manifest
  ```
  → expect: validator green; `git status` empty after the double generate
  (idempotent); the flagship skill is finally in the Cursor manifest. Open two
  or three skills in the read-only web UI and confirm the new **Runtime modes**
  line reads sensibly to a human.

_(Once you're comfortable with the flow: Sessions 3 and 4 don't touch the same
files, so you could run them in two Jules tabs at the same time instead of
back-to-back. Entirely optional — ignore this if you'd rather just keep going
one at a time.)_

### Session 5 of 8 — Dev-team-orchestrator (the team itself)

_Do not start until Steps 25 **and** 28 both passed._

- [ ] **Step 29 — Start it.** Pattern with **PROMPT 4**. → expect branch:
      `feature/ws4-dev-team-orchestrator`.
- [ ] **Step 30 — Review the PR.** Specifically: the skill carries
      `modes:`/`surface:` frontmatter; the Crew Sizing rubric and preset table
      match the design doc verbatim; git push/add/merge are in an explicit
      FORBIDDEN list; friction filing is draft-only by default; registration
      went through `pnpm generate:registry` (no hand-edited manifest/README
      hunks in the diff). Merge, pull main.
- [ ] **Step 31 — Quick sizing sanity (read-only chat, 5 min).** In the web UI
      (or any read-only agent chat), send:
  > Use the dev-team-orchestrator skill. Task: "Fix the typo 'recieve' in
  > README.md." → expect: printed five-signal scores summing to 0–1, size
  > **XS**, crew = solo developer, and a blueprint/hand-off (no execution — chat
  > is read-only). If an XS task summons a planner or reviewer, the rubric
  > wording needs tightening before real use — tell me and we'll adjust.

### Session 6 of 8 — Competitive-analysis

- [ ] **Step 32 — Start it.** Pattern with **PROMPT 5**. → expect branch:
      `feature/ws5-competitive-analysis`.
- [ ] **Step 33 — Review the PR.** Specifically: Phase 0 is self-inventory
      _first_; the pillar-conflict auto-decline section exists; sources are
      paraphrased with only short attributed fragments; modes frontmatter
      present. Merge, pull.

### Session 7 of 8 — Agentic Health dashboard

- [ ] **Step 34 — Start it.** Pattern with **PROMPT 6**. → expect branch:
      `feature/ws6-agentic-health-dashboard`.
- [ ] **Step 35 — Review the PR.** Hunt specifically for any number that blends
      HUMAN and AGENT rows into one total — reject if found. Empty-state renders
      zeros, never NaN; all four ERR badge states covered by tests. Merge, pull.
- [ ] **Step 36 — GATE.** `pnpm dev` → open the dashboard → **Agentic Health**:
      → expect: AWR > 0 (your Session-2 runs exist), the ERR chart shows your
      Step-27 baseline inside the shaded 0.15–0.85 band, the Reflexion-runs
      table lists your test runs with score paths, and the Insights
      Human/Agent/All toggle filters correctly.

### Session 8 of 8 — Cloud runner (the phone workflow) — deliberately last

- [ ] **Step 37 — Start it.** Pattern with **PROMPT 7**. → expect branch:
      `feature/ws7-reflexion-issue-runner`.
- [ ] **Step 38 — Review the PR.** Specifically: workflow permissions are
      exactly `issues: write, actions: read, contents: read`; the PR pastes a
      grep proving no `git push`/commit path exists; all transport mechanics
      (label parsing, artifacts, yaml, caps) are deterministic script code, no
      LLM involved; the demo evidence on a scratch issue is linked. Merge.

_(Full live test of Session 7 is Part D, Steps 42–43 — do it there.)_

---

## PART D — TEST THE TEAM, end to end (Steps 39–44, ~1–2 h active)

You've already tested the loop (Steps 18–21), the evaluator (25), the catalog
(28), sizing (31), and the dashboard (36). What's left is the team doing real
work, and the hands-off path.

- [ ] **Step 39 — Sizing spread.** In read-only chat, run the orchestrator on
      these two, one at a time:

  > Task: "Add a date-range preset dropdown (7 / 30 / 90 days) to the dashboard
  > insights filters."

  > Task: "Add per-project sharing: invite by email, viewer/editor roles,
  > enforced in the API routes and the dashboard UI, with migrations." → expect:
  > the first sizes **S–M** (dev + reviewer, maybe planner); the second sizes
  > **L–XL** with 2–3 lanes and — because it's XL-adjacent — a mandatory
  > reflexion plan gate before any lane starts. Sanity-check the printed scores
  > against your gut. Gut says different → note it, we tune.

- [ ] **Step 40 — One real S task, in your IDE (the first real delegation).** In
      Antigravity/Cursor (MCP connected — `pnpm mcp:start` if you run it
      manually), give the orchestrator:

  > Use the dev-team-orchestrator skill. Task: "Add a 'Copy run id' button to
  > each row of the Reflexion runs table on the Agentic Health dashboard." While
  > it runs, verify the machinery:

  ```bash
  git worktree list                 # → a new lane worktree appears
  cat .dev-team/lanes/*.md          # → Lane Ledger row: task, size, crew, status
  cat .dev-team/inbox.md            # → any questions batched HERE, not mid-stream
  ```

  → expect: crew = dev + reviewer; the reviewer runs the gates itself
  (check-types/test) and pastes evidence into the lane file; if it has questions
  it _parks_ and they're in `inbox.md`. Answer inbox questions in the file, tell
  the agent to continue. → expect at the end: a completed lane with a diff
  **you** review; the agent never ran `git push` (check `git log origin/main..`
  on the lane branch — commits exist locally/on its branch only per your merge
  flow). You commit or merge it yourself.

- [ ] **Step 41 — Friction protocol check.** Look in `.dev-team/friction/`. →
      expect: if the lane hit ≥2 rework loops or a missing tool, a dated
      friction file exists containing a _drafted_ `gh issue create` command —
      and **no issue was actually opened** (the default; auto-filing requires
      `DEV_TEAM_AUTOFILE_ISSUES=1`). If the lane was smooth and the folder is
      empty, that's also a pass.

- [ ] **Step 42 — Competitive analysis on a real source.** In chat:

  > Use the competitive-analysis skill on <URL of any article that praises
  > big-bang releases / "ship it all then test">. (No URL handy? Point it at the
  > dev-team blog post you based this on — the meta-comparison is genuinely
  > useful.) → expect: it inventories _our_ stack first, produces the
  > Better/Parity/Gap/N-A matrix with our artifact paths, and at least one row
  > is **auto-declined for pillar conflict** with the reason recorded; the
  > report lands in `.dev-team/competitive/2026-07-...md`.

- [ ] **Step 43 — The phone loop (the payoff).** From your phone or browser:
  1. Create a scratch GitHub issue — title: `Add rate limiting to /api/health`,
     body: two sentences of context.
  2. Add the label **`reflexion:run`** (create the label first if it doesn't
     exist: Issues → Labels → New label, exact string).
  3. Watch **Actions** → the runner starts. → expect within minutes: a bot
     comment with the score-per-revision table, verdict, interview questions, a
     pre-filled `yaml answers:` block, and a hidden run-id marker.
  4. Reply to the issue: copy that yaml block into a comment starting with
     **`/reflexion`**, edit only the answer lines, send.
  5. → expect: a new run resumes from the stored state and posts the refined
     result. Reply once more with `directive: approve` in the yaml.
  6. → expect: final comment contains `ide-prompt.md` in a collapsed `<details>`
     block, and the issue now has the **`reflexion:approved`** label.
  7. Close/delete the scratch issue.

- [ ] **Step 44 — Cloud budget stop.** Repo → Settings → Secrets and variables →
      Actions → **Variables** → set `REFLEXION_MAX_COST_USD = 0.05`. Label one
      more scratch issue `reflexion:run`. → expect: the runner halts early and
      posts a budget-cap comment instead of results. Set the variable back to
      `3`. Delete the issue.

### ✅ You're done when

- [ ] All four baseline commands still green on `main` (Step 7 commands).
- [ ] A HUMAN and an AGENT row verifiably coexist in `AnalyticsEvent`.
- [ ] A killed loop resumed from disk (Step 20) and a budget cap fired (21).
- [ ] `rtk run reflexion-eval`: DL-001..006 fail, DL-007 passes (25).
- [ ] Double `generate:registry` → clean tree; manifest lists all public skills
      (28).
- [ ] XS task → solo dev; L task → lanes + plan gate (31, 39).
- [ ] One real S task delegated end to end with Lane Ledger + inbox, merged by
      **you** (40).
- [ ] Competitive analysis produced a matrix with ≥1 pillar-conflict decline
      (42).
- [ ] Dashboard shows AWR, ERR-in-band, runs table, working toggle (36).
- [ ] Full phone loop: label → questions → yaml answer → approve → ide-prompt +
      `reflexion:approved` (43), and the cloud cap fired (44).

---

## PART E — Driving it daily (after setup)

- Night: label real issues `reflexion:run` from wherever you are.
- Morning: answer interview yaml over coffee; approve the good ones.
- At the desk: execute approved `ide-prompt.md`s via the orchestrator (it sizes
  the crew); answer `.dev-team/inbox.md` at gates; review lane diffs; **you**
  merge — always.
- Same-day rule: every "the reviewer should have caught X" becomes a new
  `DL-00N` case; every friction file becomes a real issue at a weekly triage.
- Weekly: glance at ERR — `NODDING_LOOP` badge → recalibrate with the defect
  library; `BLOCKED_EVALUATOR` → generator or rubric drifted. Watch
  cost-per-passed-plan against your caps.

## Troubleshooting

| Symptom                                                      | Likely cause                             | Fix                                                                                                                             |
| :----------------------------------------------------------- | :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| Jules PR says "tests pass" with nothing pasted               | Evidence rule ignored                    | Reject with one comment: "Paste the actual command output (Standing Rules / Pillar 3)."                                         |
| Step 15: chat event tagged AGENT                             | Chat route not tagging HUMAN             | Re-open Session 1 PR review — the route override is missing; file it back to Jules on the same branch.                          |
| Step 18 exits 4 immediately                                  | Contract violation or schema error       | `cat .reflexion-out/state.json` → `stopReason` says which; usually a malformed answers file or refine drift.                    |
| Step 25: a DL case passes that shouldn't                     | Critic too polite (nodding)              | Strengthen `CRITIC_SYSTEM` in `src/lib/ai/reflexion/prompts.ts`; re-run `rtk run reflexion-eval` until the table is right.      |
| `pnpm validate:skills` fails on drift after you edit a skill | Manifest/README are generated now        | Run `pnpm generate:registry`, commit the regenerated files.                                                                     |
| Step 43: label added, no Action run                          | Label string mismatch or missing secrets | Label must be exactly `reflexion:run`; check both API keys exist as repo secrets; check Actions tab for a skipped run's reason. |
| Runner comment: missing key                                  | Secrets not visible to workflow          | Re-add secrets at repo (not environment) level, or grant the environment to the workflow.                                       |
| Sizing feels wrong (XS summons a crew)                       | Rubric wording too eager                 | Note the task + printed scores; the rubric text in the skill is one paragraph — we tune it together.                            |
| Two lanes edited the same file                               | Lane isolation breached                  | That's a friction defect by definition — file it; check both lanes' ledger rows for overlapping surface area next time.         |

_If a step fails in a way this table doesn't cover: tell me the step number and
paste the output — that's all I need._
