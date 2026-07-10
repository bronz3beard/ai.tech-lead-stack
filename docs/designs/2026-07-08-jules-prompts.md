# Jules / Gemini Implementation Prompts — Agentic Dev Team + Reflexion v2

> Companion to `2026-07-08-agentic-dev-team-design.md`,
> `2026-07-08-reflexion-loop-v2-interview-gate.md` (WS-2 spec), and
> `2026-07-08-skills-readiness-audit.md` (WS-8 + PROMPT 8). Commit **all four**
> files to `docs/designs/` on `main` first — every prompt tells the agent to
> read them there, exactly like your `2026-03-19-jules-prompt.md` pattern.

## How to use

**For the order to run these in, and the full step-by-step, follow
`2026-07-10-setup-walkthrough.md` — not this section.** Quick reference only:
each prompt below is one Jules session → one feature branch → one PR that you
review and merge.

If you've added `AGENTS.md` at your repo root (the walkthrough's Step 11a —
recommended, takes 5 minutes), Jules reads the Standing Rules automatically and
you just paste the prompt itself. Otherwise, paste the **Standing Rules** block
first, then the prompt, every time.

Run order, plain and simple: **1, 2, 3, 8, 4, 5, 6, 7** — one at a time, wait
for each to merge before starting the next. (Prompt 8's text lives at the bottom
of `2026-07-08-skills-readiness-audit.md`, not in this file — the walkthrough
tells you exactly when to go get it.)

---

## PROMPT 0 — Standing Rules (prepend to every prompt below)

```
STANDING RULES for bronz3beard/ai.tech-lead-stack (read before anything else):

1. FOUR PILLARS are non-negotiable and grade your output:
   (1) G-Stack/Diagnosis-First: begin with Phase 0 — inspect package.json,
       tsconfig.json, prisma/schema.prisma, and the files named in the task
       BEFORE writing code. Ground every decision in what actually exists.
   (2) MinimumCD/Atomic Batches: commit in vertical slices <100 LOC each, every
       commit independently verifiable. Never one big-bang commit.
   (3) Production-Grade Ethos: no "add tests later", no "seems right". Every
       slice ends with hard evidence (test output, tsc output) pasted into the
       PR description. If you catch yourself rationalizing a shortcut, stop and
       do it properly.
   (4) Modern Web Guidance: for anything UI/web-facing use modern, performant,
       accessible, secure APIs (Server Components, Zod validation, semantic
       HTML/ARIA). No legacy workarounds.
2. GIT DISCIPLINE: work only on the feature branch named in the prompt. Never
   merge, never touch main, never force-push. Deliver via a single PR.
   (This extends .ai/agents.md, which forbids agents from git push/git add in
   user checkouts; as a cloud agent you may commit to YOUR OWN branch only.)
3. CODE STYLE: strict TypeScript (no `any` unless justified in a comment),
   early returns, Zod validation on every API payload and external input,
   Prettier + markdownlint clean (npm run format:check, npm run lint pass).
4. VERIFICATION COMMANDS you must run and paste before opening the PR:
   npm run check-types && npm test && npm run validate:skills
   (plus any task-specific commands listed in the prompt).
5. Do not rename, move, or "improve" existing files outside the prompt's scope.
   If you believe something out of scope is broken, note it in the PR
   description under "Observed friction" instead of fixing it — this repo
   treats agent-reported friction as first-class input.
```

---

## PROMPT 1 — WS-1: Actor telemetry (agent vs human)

```
Branch: feature/ws1-actor-telemetry

CONTEXT
We are making agent activity distinguishable from human activity in analytics.
Today every AnalyticsEvent is actor-blind. The full design is in
docs/designs/2026-07-08-agentic-dev-team-design.md, section WS-1. Read it, plus:
prisma/schema.prisma (model AnalyticsEvent), src/mcp-server/telemetry.ts,
src/lib/telemetry-service.ts, src/lib/analytics-service.ts, and the tests in
src/lib/__tests__/ and src/mcp-server/__tests__/.

YOUR TASK
1. Prisma migration `add_agentic_actor_telemetry` adding to AnalyticsEvent:
     actorType  String?   // 'HUMAN' | 'AGENT'
     autonomy   String?   // 'DIRECTED' | 'AUTONOMOUS'
     loopRunId  String?
     loopPhase  String?   // 'generate'|'critique'|'route'|'adjudicate'|'interview'|'resume'|'lane'
     teamRole   String?   // 'pm'|'planner'|'developer'|'reviewer'|'qa'|'critic'|'adjudicator'|'interviewer'
   with indexes @@index([actorType, createdAt]) and @@index([loopRunId]).
2. Define a shared Zod schema + TS types for these five fields in a new
   src/lib/actor-telemetry.ts (single source of truth: enums as z.enum,
   ActorTelemetry type, and a normalizeActorTelemetry(input) helper that
   validates/strips unknown values). Every writer below imports from here.
3. Extend TelemetryService.recordEvent input and the Prisma write to persist
   the five fields (nullable, backward compatible).
4. Extend src/mcp-server/telemetry.ts withAnalytics:
   - new optional fields on `overrides`: actorType, autonomy, loopRunId,
     loopPhase, teamRole;
   - defaults when absent: actorType 'AGENT', autonomy 'DIRECTED';
   - pass-through into telemetryService.recordEvent.
5. Human surfaces: in src/app/api/chat/route.ts (and any other route where a
   signed-in human directly triggers a skill/chat completion), record
   actorType 'HUMAN', autonomy 'DIRECTED'. Do NOT change response behavior.
6. Langfuse sync (src/lib/analytics-service.ts): map
   trace.metadata.{actorType, autonomy, loopRunId, loopPhase, teamRole} into
   the new columns when present; otherwise leave null (backfill handles
   history). Validate via normalizeActorTelemetry.
7. Backfill script scripts/backfill-actor-type.ts (tsx, mirrors the import
   style of scripts/migrate-analytics.ts):
   - default DRY RUN printing a summary table of intended changes;
     --apply flag to write;
   - heuristics: metadata.source==='mcp' -> AGENT/DIRECTED;
     skillName==='reflexion-loop' -> AGENT/AUTONOMOUS;
     else HUMAN/DIRECTED; never overwrite non-null values.
8. Tests (Jest): actor-telemetry normalization; withAnalytics default +
   override propagation (extend src/mcp-server/__tests__/telemetry.test.ts);
   backfill heuristic unit tests with a mocked prisma client.

STRICT TECHNICAL REQUIREMENTS
- Additive only: no existing column changed or removed; all new fields nullable.
- Columns, not metadata JSON, for these five fields (they are dashboard
  group-by keys; metadata remains for per-event payloads).
- Zod-validate anything crossing a process boundary (sync, backfill input).

EXECUTION STEPS (one commit per step, in order)
1. Migration + prisma generate.
2. src/lib/actor-telemetry.ts + tests.
3. TelemetryService + withAnalytics + tests.
4. Chat route HUMAN tagging.
5. Langfuse sync mapping + test update.
6. Backfill script + tests.

ACCEPTANCE CRITERIA
- [ ] npm run check-types, npm test pass; outputs pasted in PR.
- [ ] npx prisma migrate diff shows only the five columns + two indexes.
- [ ] withAnalytics with no overrides writes actorType='AGENT',
      autonomy='DIRECTED' (asserted in a test).
- [ ] Chat-route events assert actorType='HUMAN' in a test.
- [ ] Backfill dry-run on an empty DB exits 0 and prints the summary header.
- [ ] Zero behavior change for existing dashboards (no query in
      src/components/dashboard/** modified).

OUT OF SCOPE
Dashboard UI (Prompt 6), reflexion phase events (Prompt 2), any GitHub API work.
```

---

## PROMPT 2 — WS-2: Reflexion Loop v2 — Interview Gate, state/resume, budget caps

````
Branch: feature/ws2-reflexion-interview-gate

CONTEXT
The reflexion loop (Gemini generates, Claude critiques against the Four
Pillars, router, Claude adjudicates) must gain a human checkpoint AFTER the
loop: an Interview that lets the Tech Lead either approve, refine a named plan
section, retune the loop itself (threshold/caps/pillar focus), or stop — then
loop again. It must also persist state to disk after every phase so the human
can walk away and resume later, and it must carry hard budget caps.
Read docs/designs/2026-07-08-reflexion-loop-v2-interview-gate.md FIRST — it is
the authoritative spec for this workstream (state machine table, schemas,
deterministic-vs-LLM step map, section-refine contract, StateStore port, test
matrix); where this prompt and that spec differ in detail, the spec wins.
Then docs/designs/2026-07-08-agentic-dev-team-design.md section WS-2, then:
src/lib/ai/reflexion/{engine,prompts,schema,
providers-env,providers-user}.ts, scripts/reflexion-loop.ts,
src/app/api/orchestrator/reflexion/route.ts, src/app/reflexion/
ReflexionClient.tsx, src/mcp-server/index.ts (reflexion_loop tool),
.ai/skills/reflexion-loop.md, and Prompt-1's src/lib/actor-telemetry.ts.

YOUR TASK
A. schema.ts — add InterviewQuestionSchema, InterviewSchema (summary,
   recommendation: approve|refine-plan|tune-loop|stop, questions max 5, each
   {id, target:'plan'|'loop', section?, question, options?, suggested?}),
   InterviewAnswers type, ReflexionState type (version:2, runId, cfg, rounds,
   scores, draft, lastCritique, usage, interview?, answersHistory, stopReason?).
B. prompts.ts — add INTERVIEWER_SYSTEM: builds questions ONLY from genuine
   tradeoffs visible in the final critique/scores; every question answerable in
   one line; tag each with target and (for plan) the exact section heading; if
   all pillar sub-scores >= 9, return zero questions and recommendation
   'approve'. Add SECTION_REFINE generator prompt: rewrite ONLY the named
   section per the directive, reproduce every other section verbatim. Add a
   focusPillars suffix helper appended to BOTH GENERATOR_SYSTEM and
   CRITIC_SYSTEM (writer and grader must always share one rubric).
C. engine.ts — keep it pure (no I/O, no SDK imports):
   - ReflexionRunner: add interview(prompt, system): Promise<Interview> and
     getUsage(): { totalTokens: number; totalCostUsd: number }.
   - ReflexionConfig: add mode ('auto'|'interview', default 'interview'),
     budget { maxTotalTokens?, maxCostUsd? }, focusPillars?.
   - After each phase, check runner.getUsage() against budget; on exceed set
     stopReason 'budget-cap', break to adjudication.
   - ReflexionResult: add runId (crypto.randomUUID), stopReason
     ('passed'|'revision-cap'|'budget-cap'|'user-stop'), interview?.
   - In 'interview' mode, after adjudicate, call runner.interview with brief +
     final draft + final critique + score history; include result.
   - Export resumeReflexion(runner, state, answers, onStep?):
       approve -> finalize (rebuild idePrompt from stored draft, no model call);
       refine-plan -> one SECTION_REFINE generate per answered plan question,
         then ONE critique, then interview again;
       tune-loop -> apply loop answers to cfg (passThreshold, maxRevisions
         extension, focusPillars, budget), continue the loop seeded with the
         current draft as the next revision, then interview again;
       stop -> mark stopReason 'user-stop', return.
   - Extend StepEvent with {phase:'interview'} and {phase:'resume'}.
D. providers-env.ts + providers-user.ts — implement interview() on the Claude
   side (generateObject with InterviewSchema) and getUsage() by accumulating
   SDK-reported usage per call (tokens; cost via the same pricing approach the
   codebase already uses for totalCost — inspect analytics-service for the
   convention; if none exists for these SDKs, compute tokens only and treat
   maxCostUsd as unsupported with a clear runtime warning).
E. CLI scripts/reflexion-loop.ts —
   - write .reflexion-out/state.json after EVERY StepEvent (atomic: write
     temp file then rename);
   - write .reflexion-out/interview.md rendering the questions plus a fenced
     ```yaml answers: ...``` template block;
   - flags: --auto, --resume <state.json>, --answers <file|-> (parses the yaml
     block from interview.md or a plain yaml file), --interactive (readline
     Q&A), --max-cost-usd <n>, --max-tokens <n>, --focus <pillar[,pillar]>;
   - exit codes (spec §Interface is authoritative): 0 passed/approved,
     2 parked awaiting interview answers (state + interview.md written),
     3 budget/user stop, 4 contract violation or unrecoverable error.
F. Website —
   - Prisma model ReflexionRun { id cuid, userId, projectId?, brief, status
     ('RUNNING'|'AWAITING_INTERVIEW'|'PASSED'|'REVISION_CAP'|'BUDGET_CAP'|
     'APPROVED'|'STOPPED'), state Json, createdAt, updatedAt, relation to User,
     @@index([userId, createdAt]) } — migration `add_reflexion_run`.
   - POST /api/orchestrator/reflexion: persist a ReflexionRun; when the engine
     pauses for interview return { runId, status:'AWAITING_INTERVIEW',
     interview, scores, verdict }.
   - New POST /api/orchestrator/reflexion/resume: Zod body { runId, answers };
     loads state, authorizes owner, runs resumeReflexion, updates the row.
   - ReflexionClient.tsx: render the interview as a form (radio group when
     options exist, textarea otherwise, decision selector, submit -> resume
     endpoint); keep the existing timeline/verdict/idePrompt UI; accessible
     labels on every control.
G. MCP (src/mcp-server/index.ts): reflexion_loop gains mode + budget params;
   new sibling tool reflexion_resume { stateJson, answers } (file/state-based,
   no DB dependency, so it stays repo-portable).
H. Telemetry: on the website route and MCP paths, record one AnalyticsEvent
   per StepEvent via the Prompt-1 fields — actorType 'AGENT', autonomy
   'AUTONOMOUS', loopRunId=runId, loopPhase=event.phase, teamRole
   'critic'/'adjudicator'/'interviewer' as appropriate; critique events carry
   metadata { score, passed, revision }. CLI stays file-only (no DB assumed).
I. Docs: update .ai/skills/reflexion-loop.md (new flags, interview flow, exit
   codes, budget caps) and the README reflexion section + skill-table row.
   Keep the skill's frontmatter valid for scripts/validate-skills.sh.

STRICT TECHNICAL REQUIREMENTS
- engine.ts stays free of I/O and SDK imports (this is an existing invariant —
  preserve it; all persistence lives in CLI/route/MCP callers).
- Interview questions must never be generic; they must reference the critique.
- Backward compatible: calling runReflexion with mode 'auto' and no new config
  behaves exactly like today (assert in a test with a stub runner).
- Zod on every new API payload; strict TS; early returns.

EXECUTION STEPS (atomic commits)
1. schema.ts contracts + unit tests (stub data).
2. prompts.ts additions + snapshot-style tests on prompt builders.
3. engine.ts v2 + resumeReflexion + budget logic, tested with a scripted stub
   runner (no network): pass path, cap path, budget path, all three resume
   branches, zero-question auto-approve path.
4. providers (interview + usage accounting).
5. CLI flags + state/interview file writing + yaml answer parsing + tests for
   the parser and exit codes.
6. Prisma ReflexionRun + routes + client UI.
7. MCP tools.
8. Telemetry emission (H) + docs (I).

ACCEPTANCE CRITERIA
- [ ] Stub-runner engine tests cover: legacy behavior unchanged in 'auto';
      interview produced in 'interview'; budget-cap stopReason; approve /
      refine-plan / tune-loop / stop branches; zero-question fast-approve.
- [ ] Section refine provably leaves untouched sections byte-identical
      (asserted in a test using the stub runner).
- [ ] state.json written after every phase; killing the CLI between phases and
      resuming with --resume continues correctly (integration test with stub
      runner injected via a test entrypoint or module mock).
- [ ] Exit codes 0/2/3/4 asserted.
- [ ] npm run check-types && npm test && npm run validate:skills pass; paste
      outputs. Resume endpoint rejects a non-owner (test).
- [ ] PR description includes a worked example transcript: brief -> 2 rounds ->
      interview -> refine-plan answer -> re-critique -> approve (stub models
      are fine; the transcript demonstrates the state machine).

OUT OF SCOPE
Dashboard rendering of these events (Prompt 6); GitHub Action runner (Prompt 7);
any change to what the generator/critic models are.
````

---

## PROMPT 3 — WS-3: Defect library + evaluator calibration harness

```
Branch: feature/ws3-defect-library

CONTEXT
Blog requirement: "use defect libraries to test the code review workflow."
Loop-engineering requirement: a loop whose evaluator has never said "no" has no
real check. We are seeding a library of deliberately flawed implementation
plans and a harness that asserts the reflexion CRITIC rejects each one for the
right pillar — plus one golden PASS case so the critic can't drift into
rejecting everything either.
Read docs/designs/2026-07-08-agentic-dev-team-design.md section WS-3, then:
src/lib/ai/reflexion/{prompts,schema,providers-env}.ts,
scripts/reflexion-loop.ts (env runner construction), scripts/rtk-run.sh and
package.json scripts (to mirror how reflexion-loop is registered),
.github/workflows/ci.yml, and .reflexion-out/plan.md + critique.json (real
examples of plan shape and critique shape).

YOUR TASK
1. defect-library/README.md: purpose, the violation-class taxonomy, the growth
   rule ("every 'the reviewer missed X' friction defect adds a DL case
   reproducing X — prevent the class, not the instance"), how to run.
2. Seven seeded cases in defect-library/plans/, each a realistic plan in the
   exact output shape the generator produces (Phase 0 / Architecture / Atomic
   Task List / Risks & Verification — mirror .reflexion-out/plan.md), each
   embedding exactly ONE canonical violation, with frontmatter:
     ---
     id: DL-001
     title: <short>
     class: <pillar-or-ethos class>
     expected:
       passed: false            # true only for DL-007
       maxOverallScore: 6       # omit for DL-007
       pillarBelow: { atomicBatches: 6 }   # keyed by CritiqueSchema field
       fixMustMentionAnyOf: ["split", "atomic", "slice"]  # case-insensitive
     ---
   Cases: DL-001 big-bang integration step; DL-002 "add tests later"
   (productionEthos); DL-003 missing Phase-0 / generic stack-agnostic advice
   (gstackDiagnosis); DL-004 legacy web API workaround where a modern API
   exists (modernWeb); DL-005 fake verification ("looks right", no evidence
   command); DL-006 a single task that clearly exceeds 100 LOC disguised as
   one atomic step; DL-007 GOLDEN PASS — a genuinely pillar-clean plan with
   expected.passed: true.
3. scripts/reflexion-eval.ts (tsx, relative imports like scripts/
   reflexion-loop.ts):
   - loads every defect-library/plans/*.md, parses frontmatter (add a tiny
     dependency-free parser or reuse one already in the repo — inspect first);
   - builds the SAME critique prompt the engine builds (import
     stackContextBlock/CRITIC_SYSTEM from prompts.ts; import or minimally
     export the critic side of runnerFromEnv so ONLY ANTHROPIC_API_KEY is
     required — do not require GEMINI_API_KEY for critic-only evaluation);
   - asserts each expectation; writes defect-library/report.json plus a
     markdown summary table to stdout; exit 1 on any miss, 0 otherwise;
   - --case DL-003 flag to run a single case; --json for machine output.
4. Register: package.json script "reflexion:eval", plus whatever
   scripts/rtk-run.sh needs so `rtk run reflexion-eval` works (mirror the
   existing reflexion-loop registration exactly — inspect, then replicate).
5. CI: add an `evaluator-calibration` job to .github/workflows/ci.yml that
   runs the harness ONLY when secrets.ANTHROPIC_API_KEY is present (guard with
   an `if:`), plus workflow_dispatch. It must not break CI for forks without
   the secret.
6. Unit tests (no network): frontmatter parser; expectation-assertion logic
   fed synthetic Critique objects (hit: reject-with-right-pillar; miss:
   passed=true on a defect; miss: fix text lacking all keywords; DL-007
   inverse logic).

STRICT TECHNICAL REQUIREMENTS
- The harness must exercise the REAL critic prompt path — same RUBRIC, same
  CRITIC_SYSTEM, same schema — otherwise it calibrates nothing.
- Seeded plans must be realistic enough that a naive reviewer could plausibly
  wave them through; no cartoon violations ("step 1: do everything").
- Markdown passes npm run lint and format:check (they glob .ai/skills only —
  verify; if defect-library isn't covered, add it to those globs).

EXECUTION STEPS (atomic commits)
1. README + DL-001..003. 2. DL-004..007. 3. Harness + parser + tests.
4. Registration (package.json / rtk). 5. CI job.

ACCEPTANCE CRITERIA
- [ ] npm run check-types && npm test pass (paste output).
- [ ] With ANTHROPIC_API_KEY set locally, `npm run reflexion:eval` output
      pasted into the PR showing all 7 cases evaluated. If any seeded case is
      NOT rejected by the real critic, do not weaken the expectation — flag it
      in the PR under "Observed friction" (that result is itself the point of
      the library).
- [ ] CI job skips cleanly when the secret is absent (link a passing run).
- [ ] `rtk run reflexion-eval` documented in defect-library/README.md.

OUT OF SCOPE
Changing critic prompts to pass the eval (that is a human decision informed by
the report); generator-side evals; dashboard integration.
```

---

## PROMPT 4 — WS-4: `dev-team-orchestrator` skill (Crew Sizing + Lane Ledger + Friction Protocol)

````
Branch: feature/ws4-dev-team-orchestrator

CONTEXT
We are adding the flagship orchestration skill: an agent-agnostic "dev team"
the user manages as a technical product manager. It must size the crew to the
task (solo dev for XS, full team for XL — never more personas than the work
needs), run several task lanes in parallel without collision, interview the
human only at gates, and file friction defects on its own repo.
Read docs/designs/2026-07-08-agentic-dev-team-design.md section WS-4 (contains
the sizing rubric and crew presets verbatim) and section WS-8 +
docs/designs/2026-07-08-skills-readiness-audit.md — Prompt 8 has merged before
you, so every skill now carries machine-readable `modes:` and `surface:`
frontmatter and a `## Runtime modes` section: your skill must carry them too
(`modes: [read-only, write, mcp]`, `surface: public`), and your persona/lane
routing must SELECT chained skills by reading that frontmatter — a lane in a
read-only context may only invoke skills whose modes include read-only
delivery, deterministically, never by guessing from prose. Then study the
HOUSE STYLE of:
.ai/skills/feature-orchestrator.md (runtime-mode caution block, phase gates),
.ai/skills/vertical-slice-decomposer.md (the Slice Ledger anti-drift pattern —
you will generalize it into a Lane Ledger), .ai/skills/mission-architect.md,
templates/SKILL_TEMPLATE.md, .ai/agents.md (git prohibitions),
.ai/skills/operational-boundaries.md, scripts/validate-skills.sh, and the
registration surfaces: .agents/workflows/, .ai/cursor-skills.manifest,
src/lib/workflow-roles.ts, README skill table (note: manifest + README are now
GENERATED — register your skill by frontmatter and run pnpm generate:registry;
never hand-edit those two outputs).

YOUR TASK
1. Create .ai/skills/dev-team-orchestrator.md with frontmatter
   (name: dev-team-orchestrator, description, cost estimate) and this
   structure, written in the repo's established voice (IMPORTANT/CAUTION
   blocks, phase gates, explicit FORBIDDEN lists):

   Phase 0 — Discovery (MANDATORY): skill acquisition via get_skills/get_skill
   only; stack ID; mission frame (one sentence + success metric); runtime-mode
   determination copied in spirit from feature-orchestrator (read-only chat =
   blueprint + hand-off; IDE/MCP = execute).

   Phase 1 — Crew Sizing Gate: the five-signal 0–2 rubric (surface area,
   novelty, risk, ambiguity, parallelism) -> XS/S/M/L/XL -> crew preset table
   from the design doc. HARD RULES: idle personas are never instantiated;
   the sizing decision and its scores are printed before any work; a size may
   be revised at a gate but never silently.

   Phase 2 — Lane Ledger: one row per task lane
   (lane-id | task | size | crew | branch+worktree | state-file | status |
   next-gate). One git worktree per lane (`rtk git worktree add ...`), single
   writer per lane. State file .dev-team/lanes/<lane-id>.md updated at every
   gate (template included in the skill). Ledger reprint rules copied from
   vertical-slice-decomposer's anti-drift directive. Multiple lanes advance
   independently and concurrently.

   Phase 3 — Persona execution protocol: each persona = a named chain of
   EXISTING skills (pm-analyst -> feature-design-assistant; planner ->
   planning-expert or vertical-slice-decomposer; developer -> implement per
   plan; reviewer -> code-review-checklist + verification-auditor; qa ->
   visual-verifier/accessibility-auditor when UI-facing). Reviewer NEVER
   shares the developer's context and must ACT, not read: run the stated
   verification gates and paste evidence. For L/XL, the plan gate SHOULD/MUST
   (L/XL) be hardened via `rtk run reflexion-loop` before execution.

   Phase 4 — Tech-Lead Interview at gates: questions are batched at gate
   boundaries ONLY, appended to .dev-team/inbox.md using the same fenced
   ```yaml answers:``` convention as the reflexion interview; if unanswered,
   the lane PARKS at its gate and other lanes continue.

   Phase 5 — Friction Defect Protocol: triggers (>=2 rework loops on one gate;
   a skill behaving contrary to its description; missing tool/permission).
   Action: write .dev-team/friction/<date>-<slug>.md using the template in
   step 3 below and append a ready-to-run
   `gh issue create --repo bronz3beard/ai.tech-lead-stack --label friction
   --title "..." --body-file ...` command to the inbox. DEFAULT: draft only.
   In IDE/MCP mode the agent MAY execute gh issue create iff the env var
   DEV_TEAM_AUTOFILE_ISSUES=1. ABSOLUTE: git push/git add/merge remain
   forbidden regardless (restate .ai/agents.md).

   Telemetry section: every persona action must run through the MCP skill
   tools so withAnalytics records it; instruct agents to pass overrides
   { teamRole, loopRunId: <mission id>, actorType: 'AGENT' } per Prompt 1.

2. Mirror workflow .agents/workflows/dev-team.md (follow how existing
   workflows condense their skill; keep names consistent:
   workflow name "dev-team").
3. Friction issue template .github/ISSUE_TEMPLATE/friction-defect.md
   (labels: friction; fields: observed vs expected, skill involved,
   reproduction, rework count, proposed prevention class, link to the DL case
   it should become per defect-library/README.md).
4. Registration: src/lib/workflow-roles.ts entries
   ("dev-team": ["PM","DEVELOPER"]) + description; .ai/cursor-skills.manifest
   lines for both skill and workflow (follow existing naming:
   dev-team-orchestrator|... and workflow-dev-team|...); README skill-table
   row matching the table's exact column format; ONBOARDING.md mention if that
   file lists skills (inspect first).

STRICT TECHNICAL REQUIREMENTS
- Markdown only + tiny TS registration edits. No new runtime code.
- npm run validate:skills, npm run lint, npm run format:check must pass.
- The skill must be agent-ambiguous: no vendor-specific commands except the
  already-established rtk/gh/git surface; where the reflexion loop is invoked,
  note it is the stack's one declared non-agnostic feature (link the existing
  reflexion-loop.md wording).
- Anti-micromanagement litmus (from the design doc §1) stated inside the
  skill: personas receive goals + gates, never line-by-line instructions; the
  human appears only at gates.

EXECUTION STEPS (atomic commits)
1. Skill file. 2. Workflow mirror. 3. Issue template. 4. Registrations.

ACCEPTANCE CRITERIA
- [ ] validate:skills / lint / format:check outputs pasted.
- [ ] workflow-roles test suite still green (extend the existing test if one
      asserts the registry).
- [ ] PR description includes a dry-run walkthrough: a sample "3 tasks, sizes
      XS + M + L" mission showing the printed sizing scores, the Lane Ledger,
      which personas were NOT instantiated and why, and one simulated friction
      filing.
- [ ] grep confirms the skill never instructs git push / git add / merge.

OUT OF SCOPE
Any change to the chained skills themselves; dashboard; reflexion internals.
````

---

## PROMPT 5 — WS-5: `competitive-analysis` skill

```
Branch: feature/ws5-competitive-analysis

CONTEXT
Port of the blog's /competitive-analysis: compare this stack against external
sources (blog posts, other agent stacks/plugins, papers, vendor docs), produce
a Four-Pillars gap report grounded in OUR actual artifacts, and queue accepted
ideas as GitHub issues + reflexion briefs — the self-improvement flywheel.
Read docs/designs/2026-07-08-agentic-dev-team-design.md section WS-5, plus the
house style files from Prompt 4, .ai/skills/planning-expert.md (its optional
Firecrawl link-reading convention — reuse the same convention, do not invent a
new one), and .ai/skills/product-strategist.md. Prompts 4 and 8 have merged
before you: your skill must carry the `modes:`/`surface:` frontmatter and a
`## Runtime modes` section (this skill is `modes: [read-only, write, mcp]` —
full analysis + drafted issues inline in read-only chat; writing the
.dev-team/competitive/ report file and executing gh drafts happen only in a
write-capable agent), and manifest/README registration happens via
pnpm generate:registry, never by hand-editing those outputs.

YOUR TASK
1. .ai/skills/competitive-analysis.md with:
   Phase 0 — Self-inventory FIRST (Diagnosis-First applied to ourselves):
   enumerate our skills via get_skills, read README Four Pillars + skill
   table; build the "our side" of the comparison from real artifact paths.
   Phase 1 — Source ingestion: accepts URLs (Firecrawl-optional, same as
   planning-expert), local files, transcripts. Summarize each source in <=10
   lines, PARAPHRASED — quoting is limited to short attributed fragments; the
   skill must say this explicitly.
   Phase 2 — Practice extraction table: practice | paraphrased evidence |
   source section pointer.
   Phase 3 — Four-Pillars gap matrix: practice | pillar(s) | our status
   (Better / Parity / Gap / N-A) | our artifact path | adoption cost S/M/L |
   verdict (adopt / decline / investigate). HARD RULE: a practice conflicting
   with any pillar is auto-declined with the conflict recorded — sources never
   outrank pillars.
   Phase 4 — Outputs: write the report to
   .dev-team/competitive/YYYY-MM-DD-<slug>.md; for each "adopt", (a) a drafted
   `gh issue create --label competitive-analysis` command appended to
   .dev-team/inbox.md (draft-only default; DEV_TEAM_AUTOFILE_ISSUES=1 escape
   hatch identical to Prompt 4), and (b) a one-line brief formatted for
   `rtk run reflexion-loop -- "<brief>"` so adopted ideas enter the hardening
   loop before implementation.
   Telemetry note: run via MCP so withAnalytics records it (teamRole 'pm',
   actorType 'AGENT').
2. Mirror workflow .agents/workflows/competitive-analysis.md.
3. Registrations exactly as in Prompt 4 (roles: ["PM","DEVELOPER"];
   manifest lines; README table row).
4. Include ONE worked micro-example inside the skill (a two-row gap matrix)
   so agents see the exact output contract.

STRICT TECHNICAL REQUIREMENTS
Same as Prompt 4 (markdown + registration only; validators pass;
agent-ambiguous; no git push/add).

ACCEPTANCE CRITERIA
- [ ] validate:skills / lint / format:check outputs pasted.
- [ ] PR description includes a real dry run: the skill applied to
      docs/designs/2026-07-08-agentic-dev-team-design.md §2's two source
      documents as inputs, producing at least a 5-row gap matrix.
- [ ] The pillar-conflict auto-decline rule is present verbatim.

OUT OF SCOPE
Executing gh commands; building any web UI for reports; scheduling.
```

---

## PROMPT 6 — WS-6: Agentic Health dashboard (the new metrics)

```
Branch: feature/ws6-agentic-health-dashboard

CONTEXT
The dashboard must now show AGENT work as a first-class citizen, side by side
with (never blended into) the existing human usage stats. Metric definitions,
formulas, and alert thresholds are specified in
docs/designs/2026-07-08-agentic-dev-team-design.md section WS-6 — treat that
table as the spec. Read it, then: prisma/schema.prisma (Prompt-1 columns +
Prompt-2 ReflexionRun), src/components/dashboard/** (DashboardContent,
InsightsTable, WorkflowPhaseTracker, DateRangePicker, ProjectSelector),
src/app/dashboard/page.tsx, src/lib/access.ts (getProjectAccessFilter),
src/components/ui/chart.tsx, and docs/designs/2026-03-19-agent-analytics-
dashboard.md (the original dashboard design whose conventions you extend).

YOUR TASK
1. Aggregation layer src/lib/agentic-metrics.ts (pure functions over Prisma
   query results; fully unit-testable with fixture rows):
   - autonomousWorkRatio(events) = AGENT / all
   - autonomyDepth(events) = AUTONOMOUS / AGENT
   - evaluatorRejectionRate(events) over loopPhase='critique' using
     metadata.passed, plus classify(err, sampleSize): 'NODDING_LOOP' when
     err===0 && n>=20; 'BLOCKED_EVALUATOR' when err>=0.95 && n>=20; 'HEALTHY'
     within 0.15–0.85; 'WATCH' otherwise.
   - convergence(runs): mean revisions-to-pass; mean first->final score delta
     (group by loopRunId).
   - humanTouchpointsPerRun(events): interview events / distinct loopRunId.
   - frictionRate(events): metadata.frictionFiled===true per 100 agent runs
     (documented as the v1 proxy; a TODO comment references a v2 GitHub-label
     query, not implemented now).
   - costPerPassedPlan(runs).
   Each with JSDoc citing the design-doc formula it implements.
2. Route/server data: a server-side loader (route handler or server action,
   matching how DashboardContent currently fetches) that runs the Prisma
   aggregations with Zod-validated { projectId?, from?, to? }, scoped by
   getProjectAccessFilter, and returns a typed AgenticHealthSummary.
3. UI: an "Agentic Health" tab or section within the existing dashboard page:
   - four stat cards (AWR, ERR with health badge, HTR, cost per passed plan);
   - AWR trend line (weekly buckets) and an ERR band chart with the
     0.15–0.85 healthy band shaded, using the existing chart primitives;
   - a Reflexion runs table: runId (short), brief (truncated), revisions,
     score path (e.g. 5 -> 7 -> 9), cost, status — sourced from ReflexionRun;
   - alert badges for NODDING_LOOP / BLOCKED_EVALUATOR with a one-line
     explanation tooltip quoting the design rationale ("an evaluator that has
     never said no is proof no check exists").
4. Extend InsightsTable with a Human/Agent/All toggle filtering on actorType
   (default All; no change to its existing columns).
5. Tests: unit tests for every function in agentic-metrics.ts (fixtures for
   nodding-loop, blocked, healthy, empty/NaN-safe cases); a component test for
   the ERR badge states; loader input-validation test.

STRICT TECHNICAL REQUIREMENTS
- React 19 / Next.js Server Components; `use cache` where the existing
  dashboard uses it; Tailwind + Shadcn + the repo's chart wrapper; complete
  class strings (no dynamic string concat for Tailwind).
- Human and agent metrics must remain visually and semantically separated —
  no combined "total usage" number that mixes actorTypes.
- Empty-state safe: a fresh DB renders the section with zeros and no NaN.
- Accessibility: charts get aria-labels + a text summary; badges are not
  color-only (icon + label).

EXECUTION STEPS (atomic commits)
1. agentic-metrics.ts + tests. 2. Loader + validation + tests.
3. Stat cards + charts. 4. Runs table + alerts. 5. InsightsTable toggle.

ACCEPTANCE CRITERIA
- [ ] check-types, test, lint:next outputs pasted.
- [ ] Screenshot (or the repo's visual-verifier evidence convention) of the
      section in empty-state AND with seeded fixture data (add a small
      scripts/seed-agentic-fixtures.ts dev-only seeder, clearly marked, to
      make this reproducible).
- [ ] ERR badge states demonstrated for all four classifications in tests.
- [ ] No existing dashboard query/component behavior changed except the
      opt-in toggle.

OUT OF SCOPE
GitHub-label friction queries (v2); public/unauthenticated exposure of agentic
metrics; reflexion engine changes.
```

---

## PROMPT 7 — WS-7: Issue-driven cloud loop runner (hands-off mode)

````
Branch: feature/ws7-reflexion-issue-runner

CONTEXT
Cloud scheduling per the loop-engineering playbook: the loop must run while
the machine is off, and the human checkpoint must be reachable from a phone.
Transport is GitHub issues; the runner NEVER pushes code — it communicates
via issue comments and workflow artifacts only.
Read docs/designs/2026-07-08-agentic-dev-team-design.md section WS-7, then:
scripts/reflexion-loop.ts and the Prompt-2 state/resume/answers machinery
(this workstream is a thin transport around it), docs/github-action-example.yml
(the repo's existing Action conventions), .github/workflows/ci.yml.

YOUR TASK
1. .github/workflows/reflexion-issue-runner.yml
   - on: issues (types: [labeled]) filtered to label 'reflexion:run';
     issue_comment (types: [created]) guarded to bodies starting '/reflexion';
     workflow_dispatch (inputs: issue_number).
   - permissions: issues: write, actions: read, contents: read. Nothing more.
   - env caps read from repo/environment vars with safe defaults:
     REFLEXION_MAX_COST_USD (default 3), REFLEXION_MAX_REVISIONS (default 3).
   - secrets: GEMINI_API_KEY, ANTHROPIC_API_KEY; the job exits with a clear
     comment if either is missing.
   - concurrency group per issue number so parallel comments don't race.
2. scripts/reflexion-issue-runner.mjs
   START path (label event): brief = issue title + body; run the v2 CLI (or
   call the engine via the env runner directly — choose whichever gives
   cleaner exit-code handling and justify in the PR); upload .reflexion-out/*
   as artifact 'reflexion-state-<issue#>'; post ONE comment containing:
   score-per-revision table, adjudicator verdict, the interview questions,
   a pre-filled fenced ```yaml answers:``` template the user edits, the
   artifact's workflow run id, and usage/cost.
   RESUME path (/reflexion answers comment): parse the yaml block; locate the
   previous run id from the runner's own prior comment (embed it in an HTML
   comment marker for machine parsing, e.g. <!-- reflexion-run:12345 -->);
   download the state artifact via the Actions REST API with GITHUB_TOKEN;
   run resume; post the refined result the same way. On decision 'approve',
   post the final ide-prompt.md content in a collapsed <details> block and
   apply label 'reflexion:approved'.
   GUARDS: ignore comments from the runner itself (author check); max 10
   loop turns per issue (hard stop with a comment); every failure posts a
   diagnostic comment rather than dying silently.
3. Docs: docs/reflexion-issue-runner.md — setup (secrets, labels, caps), the
   phone workflow ("label at night, answer over coffee"), the security model
   (no push, artifact retention window applies to state), and troubleshooting.
4. Tests: unit tests for the pure parts of the runner script (comment yaml
   parsing, run-id marker extraction, answers validation via the Prompt-2
   schemas) with the GitHub API mocked. The workflow file is validated by
   actionlint if available in CI, else note it.

STRICT TECHNICAL REQUIREMENTS
- Never git push, never open PRs, never write to the repo from the Action.
- Fig. 5 discipline (Loop Engineering, Stripe Minions): the runner script — not
  any model — owns ALL transport mechanics. Label parsing, artifact
  download/upload, yaml extraction, run-id markers, turn counting, caps, and
  exit-code handling are deterministic code paths; no LLM call may decide any
  of them. The models only ever receive the brief and the parsed answers.
- All user-provided text (issue body, comments) is untrusted input: parse
  defensively, Zod-validate the answers shape, and never interpolate it into
  shell commands unescaped.
- Idempotent: re-delivering the same event must not double-run (use the
  concurrency group + a processed-marker in the runner's comment).

EXECUTION STEPS (atomic commits)
1. Runner script pure functions + tests. 2. Script I/O paths.
3. Workflow yml. 4. Docs.

ACCEPTANCE CRITERIA
- [ ] check-types + test outputs pasted.
- [ ] A recorded end-to-end demo on a scratch issue in the PR description:
      label -> bot comment with questions -> answers comment -> refined
      result -> approve -> ide-prompt posted (screenshots or comment links).
- [ ] Cost cap demonstrably enforced (set REFLEXION_MAX_COST_USD=0.01 in the
      demo and show the budget-cap comment).
- [ ] grep confirms no git push/commit-to-repo path exists in the workflow.

OUT OF SCOPE
Cron scheduling (add later by uncommenting a schedule trigger — include it
commented with a warning about caps first, per the design doc); multi-repo
operation; dev-team lane execution in CI.
````

---

## PROMPT 8 — WS-8: Skills readiness pass

**The full prompt lives at the bottom of
`docs/designs/2026-07-08-skills-readiness-audit.md`** — it is inseparable from
the findings (F1–F5) it fixes, so audit + prompt travel as one file. Summary:
add `modes:`/`surface:` frontmatter + a `## Runtime modes` line to all 29
skills, generate the Cursor manifest and README table from frontmatter
(`scripts/generate-skill-registry.ts`), and make `validate-skills.sh` fail CI on
any drift.

- Branch: `feat/skills-readiness-pass`
- Prepend the same PROMPT 0 Standing Rules.
- Parallel-safe with Prompts 1–3. **Must merge before Prompt 4** — the dev-team
  orchestrator sizes crews and routes lanes using these fields.

---

## Appendix — suggested PR review checklist (for you, the merger)

For every PR these prompts produce, before merging ask:

1. Did the agent paste real command output (Pillar 3), or describe it?
2. Are commits atomic and independently revertible (Pillar 2)?
3. Does anything blend human and agent metrics into one number? (Reject.)
4. Did the agent report friction instead of silently working around it? If it
   worked around something, that's a friction defect to file — practice the
   protocol on the PRs themselves.
5. After merging Prompt 3: run `rtk run reflexion-eval` once yourself and keep
   the report — that's your baseline ERR calibration before the dashboard starts
   charting it.
6. After merging Prompt 8: run `pnpm validate:skills` and
   `pnpm generate:registry` once on main — from then on, registry drift is a CI
   failure, not a discovery you make in Cursor.
