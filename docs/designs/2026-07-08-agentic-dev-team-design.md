# Agentic Dev Team + Reflexion Loop v2 — Architecture Design

> Target repo: `bronz3beard/ai.tech-lead-stack` · Date: 2026-07-08
> Companion file: `2026-07-08-jules-prompts.md` (the implementation prompts)
> Sources: (1) "Physician, heal thyself" dev-team blog post; (2) *Loop Engineering: The Anthropic Playbook* (HuaShu Orange Book / Osmani, Jun 2026); (3) the current state of this repo (audited 2026-07-08).

---

## 1. Purpose

Evolve the Tech-Lead Stack from a library of **individually invoked skills** into a **scale-aware agentic dev team** you operate as a technical product manager: you set goals, provide resources, and give feedback; the team sizes itself, executes in parallel lanes, reviews itself with an independent evaluator, tells on itself when it hits friction, and pauses for you only at deliberate checkpoints.

Explicit anti-goal (from the blog post): *"when your focus is on the code... you end up using agents as junior developers that you micro-manage."* Every design decision below is tested against: **does this reduce the number of times the human must sit at the keyboard, without removing the human's ability to say "no"?** (Loop Engineering §IX, §XI-C: "keep one door open").

Everything is governed by the repo's **Four Pillars** exactly as defined in `README.md` and encoded in `src/lib/ai/reflexion/prompts.ts` (`RUBRIC`) and `src/lib/ai/reflexion/schema.ts` (`CritiqueSchema`):

1. **G-Stack / Diagnosis-First** — Phase 0 stack discovery before any advice.
2. **MinimumCD / Atomic Batches** — <100 LOC tasks, vertical slices, verification gate per task.
3. **Production-Grade Ethos** — process over prose, anti-rationalization, evidence non-negotiable.
4. **Modern Web Guidance** — modern, performant, accessible, secure APIs.

The pillars **outrank the source documents**: where a source practice conflicts with a pillar, the pillar wins and the conflict is recorded, not silently adopted.

---

## 2. Source → Stack mapping

How each concept from the two source docs lands on something that already exists in the repo (reuse-first, per Pillar 1):

| Source concept | Source | Lands on (existing) | New work |
|---|---|---|---|
| Generator/evaluator separation; "tune a skeptic, not a modest author" | Paper §V | `runReflexion` already splits Gemini generator / Claude critic; `validateDistinctModels` | Keep; extend with interview + acting-evaluator hooks (WS-2) |
| Five moves: discovery, handoff, verification, persistence, scheduling | Paper §III | discovery≈`feature-design-assistant`/`planning-expert`; handoff≈worktrees (`rtk git worktree`); verification≈critic + `verification-auditor`; persistence≈`.reflexion-out/*`; scheduling≈`docs/github-action-example.yml` pattern | Persistence → `state.json` + Lane Ledger (WS-2/4); scheduling → issue-driven cloud runner (WS-7) |
| "A loop that never says no is broken" (Nodding Loop) | Paper §VI-A | `CritiqueSchema.passed` already exists but is untested and unmeasured | Defect library + evaluator eval harness (WS-3); Evaluator Rejection Rate metric (WS-6) |
| Human checkpoint / "open door" / stop-boundary the loop cannot infer | Paper §XI-C, App. A "Stop" | Adjudicator verdict exists; `agents.md` git-push prohibition exists | **Interview Gate** after the loop (WS-2); gate-only interviews in dev team (WS-4) |
| Budget caps ("cap before you ship") | Paper §XI-B | `maxRevisions` only | Token/cost caps + stopReason (WS-2) |
| Memory on disk, not context ("the agent forgets, the repo does not") | Paper §IV | `.reflexion-out/`, KI service (`src/lib/ki/`) | `state.json`, `.dev-team/lanes/*.md`, `.dev-team/inbox.md` (WS-2/4) |
| Persona team; "spec, build, review"; hands-off TPM posture | Blog | `workflow-roles.ts` (PM/DEV/QA/DESIGNER), `feature-orchestrator`, `mission-architect`, `vertical-slice-decomposer` Slice Ledger | `dev-team-orchestrator` skill with **Crew Sizing Gate** + **Lane Ledger** (WS-4) |
| `/competitive-analysis` — compare self to blogs/plugins/docs, open issues for accepted ideas | Blog | `gh` CLI usage pattern from `pr-automator`; Firecrawl option from `planning-expert` | `competitive-analysis` skill (WS-5) |
| "The team tells on itself" — friction defects on its own repo | Blog | GitHub issue tooling (`rtk gh issue list`) | Friction Defect Protocol + issue template (WS-4) |
| "Defect libraries to test the code review workflow" | Blog + Paper §V | `scripts/autoeval-check.mjs` (generic), critic prompt | `defect-library/` + `scripts/reflexion-eval.ts` (WS-3) |
| Differentiate agent activity from human activity in analytics | Your requirement | `AnalyticsEvent` (Prisma), `withAnalytics` (MCP), Langfuse sync, `/dashboard` | `actorType`/`autonomy`/`loopRunId`/`loopPhase`/`teamRole` columns + **Agentic Health** dashboard (WS-1/6) |
| Agent-agnostic ("Agent-Ambiguous") | Repo ethos | All `.ai/skills/*.md` | All new skills are plain markdown; reflexion remains the one declared exception, unchanged in that regard |

---

## 3. Current-state audit (what we reuse, verbatim paths)

- **Reflexion engine** — `src/lib/ai/reflexion/engine.ts`: pure, transport-agnostic orchestration via `ReflexionRunner`; consumed by CLI (`scripts/reflexion-loop.ts`), MCP tool `reflexion_loop` (`src/mcp-server/index.ts`), and the website (`/reflexion` + `src/app/api/orchestrator/reflexion/route.ts`). Artifacts: `.reflexion-out/{plan.md, ide-prompt.md, critique.json, diminishing-returns.svg}`. Router: pass ≥ `passThreshold` (default 8) or `maxRevisions` (default 3).
- **Pillar rubric** — single shared `RUBRIC` in `prompts.ts`; critic returns `CritiqueSchema` with per-pillar 0–10 sub-scores, holistic `score`, `passed`, and exactly ONE `actionableFix`.
- **Telemetry** — `AnalyticsEvent` model (`prisma/schema.prisma`) with `skillName/model/agent/duration/status/tokens/cost/metadata/projectName`; `Telemetry.withAnalytics` (`src/mcp-server/telemetry.ts`) tags `metadata.source: 'mcp'`; `src/lib/analytics-service.ts` syncs Langfuse traces into Postgres; dashboard components under `src/components/dashboard/`.
- **Skills infra** — frontmatter contract enforced by `scripts/validate-skills.sh` (+ prettier + markdownlint via `package.json` scripts); template `templates/SKILL_TEMPLATE.md`; registration surfaces: `.ai/skills/`, `.agents/workflows/`, `.ai/cursor-skills.manifest`, `src/lib/workflow-roles.ts`, README skill table (~line 620s).
- **Orchestration precedents** — `feature-orchestrator` (3-phase, runtime-mode aware), `mission-architect` (multi-feature), `vertical-slice-decomposer` (Slice Ledger anti-drift pattern — we reuse this ledger discipline for lanes).
- **Hard constraints** — `.ai/agents.md`: agents NEVER run `git push` or `git add`; MCP `verify_mission_alignment` pre-flight; skill access only via `get_skill(s)` tools; `rtk`-prefixed commands (`CLAUDE.md`).
- **Scheduling precedent** — `docs/github-action-example.yml` (event-triggered curl into the app) proves the cloud-trigger pattern.

---

## 4. Workstreams and dependency order

| # | Workstream | Type | Depends on |
|---|---|---|---|
| WS-1 | Actor telemetry model (agent vs human) | Prisma + TS | — |
| WS-2 | Reflexion Loop v2: Interview Gate, state/resume, budget caps | TS engine + CLI + MCP + web | WS-1 (event fields) |
| WS-3 | Defect library + evaluator calibration harness | Files + TS script + CI | — (parallel-safe) |
| WS-4 | `dev-team-orchestrator` skill: Crew Sizing + Lane Ledger + Friction Protocol | Markdown skill + registration | WS-1 (teamRole), WS-2 (loop hand-off) |
| WS-5 | `competitive-analysis` skill | Markdown skill + registration | WS-4 (inbox conventions) |
| WS-6 | Agentic Health dashboard (the new metrics) | Next.js UI + API | WS-1, WS-2 emitting events |
| WS-7 | Issue-driven cloud loop runner (hands-off mode) | GitHub Action + script | WS-2 |
| WS-8 | Skills readiness pass: machine-readable modes + generated registry | Skill frontmatter + TS generator + validator | — (parallel-safe with WS-1..3; **must merge before WS-4**) |

One Jules prompt per workstream; one branch/PR each; **you** merge (agents never push — extended in the prompts to "Jules commits only to its own feature branch and opens a PR; never merges, never touches main").

---

## 5. Workstream specifications

### WS-1 — Actor telemetry: separating agent metrics from human metrics

**Problem.** Every `AnalyticsEvent` today is actor-blind: a human running `ask` from chat and the reflexion critic grading a plan look identical. Your requirement: *"a new metric that would indicate the agentic dev team is using the skills, reflexion loop etc. and not a human metric, so we can differentiate the 2."*

**Schema additions** (`prisma/schema.prisma`, migration `add_agentic_actor_telemetry`):

```prisma
model AnalyticsEvent {
  // ...existing fields unchanged...
  actorType  String?   // 'HUMAN' | 'AGENT'
  autonomy   String?   // 'DIRECTED' (human initiated this turn) | 'AUTONOMOUS' (loop/agent initiated)
  loopRunId  String?   // groups all phases of one reflexion/dev-team run
  loopPhase  String?   // 'generate'|'critique'|'route'|'adjudicate'|'interview'|'resume'|'lane'
  teamRole   String?   // 'pm'|'planner'|'developer'|'reviewer'|'qa'|'critic'|'adjudicator'|'interviewer'

  @@index([actorType, createdAt])
  @@index([loopRunId])
}
```

**Emission points.**
- `src/mcp-server/telemetry.ts` `withAnalytics`: defaults `actorType:'AGENT'`, `autonomy:'DIRECTED'`; `overrides` extended with `{ actorType?, autonomy?, loopRunId?, loopPhase?, teamRole? }` so orchestrating skills (WS-4) can label persona actions.
- Chat/API routes that a human drives (`/api/chat`, skill chat): `actorType:'HUMAN'`.
- Reflexion surfaces (WS-2): one event per phase with `actorType:'AGENT'`, `autonomy:'AUTONOMOUS'`, `loopRunId`, `loopPhase`, and `metadata: { score, passed, revision }` on critique phases — this is what powers the Evaluator Rejection Rate.
- `analytics-service.ts` Langfuse sync: maps `trace.metadata.actorType|loopRunId|...` when present; falls back to heuristic.
- Backfill: `scripts/backfill-actor-type.ts` (dry-run by default): `metadata.source==='mcp'` → AGENT/DIRECTED; `skillName==='reflexion-loop'` → AGENT/AUTONOMOUS; else HUMAN/DIRECTED.

**Why columns, not just `metadata` JSON:** these five fields are the group-by keys of every WS-6 chart; indexed columns keep dashboard queries O(index) instead of JSON scans, and the existing `metadata` stays the home for per-event payloads.

### WS-2 — Reflexion Loop v2: the Interview Gate

This is your core ask: *"integrate a more iterative interview approach at the end of a loop where I can either refine the loop design or just refine a part of the plan provided and then loop again"* — while spending less time at the computer.

**New loop shape** (engine stays pure; `engine.ts` grows, no I/O added):

```
generate → critique → route ─(pass or cap or budget)→ adjudicate → INTERVIEW
                                                                      │
        ┌── approve ──────────── finalize (ide-prompt, exit 0) ◄──────┤
        ├── refine-plan ──────── section-targeted regenerate → critique → INTERVIEW
        ├── tune-loop ────────── apply new threshold/cap/focusPillars → continue loop from current draft → INTERVIEW
        └── stop ─────────────── persist state, exit
```

**Contracts** (new in `src/lib/ai/reflexion/schema.ts`):

```ts
export const InterviewQuestionSchema = z.object({
  id: z.string(),                         // 'q1'...
  target: z.enum(['plan', 'loop']),       // what the answer will change
  section: z.string().optional(),         // plan heading, when target='plan'
  question: z.string(),
  options: z.array(z.string()).optional(),
  suggested: z.string().optional(),
});
export const InterviewSchema = z.object({
  summary: z.string(),                    // ≤5 sentences: state of the plan after the loop
  recommendation: z.enum(['approve', 'refine-plan', 'tune-loop', 'stop']),
  questions: z.array(InterviewQuestionSchema).max(5),
});
export interface InterviewAnswers {
  decision: 'approve' | 'refine-plan' | 'tune-loop' | 'stop';
  answers: Array<{ id: string; answer: string }>;
}
```

- `ReflexionRunner` gains `interview(prompt, system): Promise<Interview>` (Claude, same key as critic) and `getUsage(): { totalTokens: number; totalCostUsd: number }` (accumulated across calls) — both implemented in `providers-env.ts` and `providers-user.ts`.
- `ReflexionConfig` gains `mode?: 'auto'|'interview'` (default `interview`), `budget?: { maxTotalTokens?, maxCostUsd? }`, `focusPillars?: PillarKey[]` (appended to both GENERATOR_SYSTEM and CRITIC_SYSTEM so writer and grader stay on ONE rubric — preserving the engine's core invariant).
- `ReflexionResult` gains `runId`, `stopReason: 'passed'|'revision-cap'|'budget-cap'|'user-stop'`, `interview?`.
- New exported `resumeReflexion(runner, state, answers, onStep?)` implementing the three branches above. `refine-plan` uses a new `SECTION_REFINE` generator prompt: *rewrite ONLY the named section per the directive; reproduce every other section verbatim* — then ONE re-critique. Cheap, targeted, no full re-loop.
- New `INTERVIEWER_SYSTEM` prompt rule that protects your time: **ask questions only where the critique/scores show a real tradeoff the loop cannot resolve alone; if all pillar scores ≥9, ask zero questions and recommend `approve`.** Questions must be answerable in one line each.

**Persistence & hands-off.** `ReflexionState` (serializable: cfg, rounds, scores, draft, lastCritique, usage, interview, answersHistory, runId, `version: 2`) is written to `.reflexion-out/state.json` after every phase (atomic temp+rename — crash-safe, per the paper's Persistence move). `interview.md` is also written with a fenced ```yaml answers:``` block you can fill in from any editor — or your phone via WS-7 — then:

```bash
rtk run reflexion-loop -- --resume .reflexion-out/state.json --answers .reflexion-out/interview.md
```

CLI flags: `--auto` (skip interview), `--resume`, `--answers <file|->`, `--interactive` (TTY Q&A), `--max-cost-usd`, `--max-tokens`, `--focus <pillar,...>`. Exit codes: 0 passed/approved · 2 revision-cap · 3 budget-cap · 4 awaiting-interview (state written).

**Website & MCP.** New Prisma model `ReflexionRun { id, userId, projectId?, brief, status, state Json, timestamps }` so the web UI is resumable across sessions; `POST /api/orchestrator/reflexion` returns `{ runId, status:'AWAITING_INTERVIEW', interview }` when paused; `POST /api/orchestrator/reflexion/resume` continues; `ReflexionClient.tsx` renders the interview as a form (options → radio, free text → textarea, decision selector). MCP `reflexion_loop` gains `mode`, and a sibling `reflexion_resume` tool taking `stateJson` + `answers` (file-based, repo-portable — no DB required outside the website).

**Telemetry.** Each phase records a WS-1 event; budget stop and interview count are visible in WS-6.

### WS-3 — Defect library: proving the reviewer can say "no"

Implements *"I tell it to use defect libraries to test the code review workflow"* and the paper's warning that a loop that has never rejected anything is proof no check exists (§VI-A).

- `defect-library/plans/DL-00X-<slug>.md` — seeded plans, each embedding exactly one canonical violation class, with machine-readable expectations in frontmatter:

```yaml
---
id: DL-001
title: Big-bang integration hidden in the task list
class: atomic-batches
expected:
  passed: false
  maxOverallScore: 6
  pillarBelow: { atomicBatches: 6 }
  fixMustMentionAnyOf: ["split", "atomic", "slice"]
---
```

- Seed set: DL-001 big-bang step · DL-002 "add tests later" (productionEthos) · DL-003 no Phase-0, generic advice (gstackDiagnosis) · DL-004 legacy web API workaround (modernWeb) · DL-005 fake verification ("seems right") · DL-006 >100 LOC task disguised as one step · **DL-007 golden PASS case** (`expected.passed: true`, guards against an evaluator tuned so hostile it rejects everything — calibration cuts both ways).
- `scripts/reflexion-eval.ts`: runs the **critic only** (env runner) across all cases, asserts expectations, writes `defect-library/report.json` + a markdown summary, exits non-zero on any miss. Registered the same way `reflexion-loop` is registered (package script + rtk task).
- CI: optional job in `.github/workflows/ci.yml`, gated on the `ANTHROPIC_API_KEY` secret being present, plus `workflow_dispatch`.
- **Growth rule (the CD-pipeline ethos from the blog):** every friction defect of the form "the reviewer missed X" must add a DL case reproducing X — preventing the *class*, not the instance.

### WS-4 — `dev-team-orchestrator`: the team you manage as TPM

Agent-agnostic skill (`.ai/skills/dev-team-orchestrator.md` + `.agents/workflows/dev-team.md`). It chains existing skills as personas; it does not duplicate them.

**Phase 1 — Crew Sizing Gate (the "too many cooks" and cost control).** Score five signals 0–2 each after Phase-0 diagnosis:

| Signal | 0 | 1 | 2 |
|---|---|---|---|
| Surface area | 1 file, 1 layer | ≤5 files or 2 layers | many files / cross-layer |
| Novelty | existing pattern | adjacent pattern | new pattern/system |
| Risk | cosmetic | business logic | auth/payments/data/infra |
| Ambiguity | spec is exact | minor gaps | open questions |
| Parallelism | none | 2 independent subtasks | 3+ independent subtasks |

Total → size → crew preset (idle personas are **never instantiated** — silence is the noise/cost control):

| Size | Score | Crew | Parallel lanes | Loop hardening |
|---|---|---|---|---|
| XS | 0–1 | Developer only | 1 | self-check + autoeval |
| S | 2–3 | Developer + Reviewer | 1 | reviewer gate (generator/evaluator split starts here) |
| M | 4–5 | Planner + Developer + Reviewer | 1–2 | plan gate + review gate |
| L | 6–8 | PM-analyst + Planner + Dev ×N + Reviewer + QA | 2–3 | reflexion-hardened plan recommended |
| XL | 9–10 | mission-architect strategy + full L crew | 3+ | `reflexion-loop` plan gate mandatory |

Rules: **Reviewer is never the author's context** (paper §V — swap agent, not wording); Reviewer must *act*, not read — run the stated verification gate and paste evidence (tests, `rtk tsc`, screenshots via `visual-verifier`).

**Phase 2 — Lane Ledger (parallel tasks, iterated simultaneously).** The `vertical-slice-decomposer` Slice Ledger discipline, promoted to team level. One row per lane: `lane-id | task | size | crew | branch/worktree | state-file | status | next-gate`. Each lane gets its own git worktree (single writer per lane — the paper's Handoff move / Tangled-Loop prevention) and a state file `.dev-team/lanes/<lane-id>.md` (Persistence — the repo remembers between sessions). The Ledger is reprinted after every detour; lanes advance independently, so several tasks iterate at the same time without cross-talk.

**Phase 3 — Gate-only interviews.** Personas never ping you mid-lane. Questions are batched at gate boundaries into `.dev-team/inbox.md` (same yaml-answers convention as WS-2). If you're away, the lane parks at its gate — the open door — and other lanes continue.

**Phase 4 — Friction Defect Protocol ("the team tells on itself").** Triggers: ≥2 rework loops on one gate · a skill behaved contrary to its description · missing tool/permission. Action: write `.dev-team/friction/<date>-<slug>.md` (template: observed vs expected, skill involved, reproduction, proposed prevention class) and append a ready-to-run `gh issue create --repo bronz3beard/ai.tech-lead-stack --label friction ...` command to the inbox. Default is draft-only; in IDE/MCP mode with `DEV_TEAM_AUTOFILE_ISSUES=1` the agent may execute `gh issue create` itself (issue creation is not covered by the `agents.md` push/add prohibition, which remains absolute).

**Telemetry.** Every persona action goes through the MCP skill tools so `withAnalytics` logs it with `teamRole`, `actorType:'AGENT'`, shared `loopRunId` per mission — this is what makes the dev team visible as a *team* in WS-6.

### WS-5 — `competitive-analysis` skill

Direct port of the blog's `/competitive-analysis`, pillar-governed. Inputs: URLs, files, transcripts (Firecrawl optional, as with `planning-expert`). Output contract (`.dev-team/competitive/YYYY-MM-DD-<slug>.md`):

1. Source summary (≤10 lines, paraphrased — no long quotation).
2. Practice extraction table: practice · paraphrased evidence · source section.
3. **Four-Pillars gap matrix**: practice · pillar(s) touched · our status (Better / Parity / Gap / N-A) · our artifact path · adoption cost S/M/L · verdict (adopt / decline / investigate). A practice that violates a pillar is auto-declined with the conflict recorded — sources never outrank pillars.
4. Adoption queue: drafted `gh issue create --label competitive-analysis` commands (draft-only by default, same escape hatch as WS-4).
5. Reflexion hand-off: for each "adopt", a one-line brief ready for `rtk run reflexion-loop -- "<brief>"` — closing the self-improvement loop from the blog (analyze → issue → design change → harden → implement).

### WS-6 — Agentic Health dashboard (the new metrics)

New section/tab in `/dashboard` built on WS-1 columns. Definitions (all filterable by project + date range, always shown **beside**, never blended into, the existing human usage stats):

| Metric | Formula | Reading it |
|---|---|---|
| Autonomous Work Ratio (AWR) | `count(actorType='AGENT') / count(*)` | Your hands-off trend. Rising = the team is doing more of the work. |
| Autonomy depth | `count(autonomy='AUTONOMOUS') / count(actorType='AGENT')` | How much agent work happens without a human turn. |
| **Evaluator Rejection Rate (ERR)** | critique events with `metadata.passed=false` ÷ all `loopPhase='critique'` events | The anti-Nodding-Loop gauge. **0% over ≥20 critiques ⇒ "Nodding Loop" alert; ≥95% ⇒ "Blocked evaluator" alert.** Healthy band ~15–85%. |
| Convergence efficiency | mean revisions-to-pass; mean first→final score delta, grouped by `loopRunId` | Diminishing-returns health of the loop. |
| Human Touchpoints per Run (HTR) | interview events answered ÷ loop runs | Falling HTR with stable ERR = genuinely more hands-off, not just unchecked. |
| Friction defect rate | friction filings per 100 agent runs (v1: `metadata.frictionFiled` proxy; v2: GitHub label query) | The team telling on itself. |
| Cost per passed plan | `sum(totalCost by loopRunId, finalPassed) / passed runs` | Token-blowout guard (paper §VIII). |

UI: four stat cards + AWR trend chart + ERR band gauge + a runs table (`loopRunId`, brief, revisions, score path, cost, status). Server Components with `use cache`, Zod-validated route inputs, project scoping via the existing `getProjectAccessFilter`. The existing `InsightsTable` gains a Human/Agent toggle on `actorType`.

### WS-7 — Issue-driven cloud runner (run while you're away)

The paper's cloud-scheduling column (§VII-C/D) applied to this stack, honoring "never push": the runner communicates only through issue comments and workflow artifacts.

`.github/workflows/reflexion-issue-runner.yml`: triggers on issue labeled `reflexion:run`, on `issue_comment` starting with `/reflexion`, and `workflow_dispatch`. `scripts/reflexion-issue-runner.mjs`:

1. **Start**: brief = issue body → run the v2 loop with env caps (`MAX_COST_USD`, default 3) → upload `.reflexion-out/*` as artifact `reflexion-state-<issue#>` → post a comment with the score table, verdict, interview questions, and a pre-filled ```yaml answers:``` template, plus the artifact run id.
2. **Resume**: a `/reflexion answers` comment → download the prior state artifact via the Actions API (`GITHUB_TOKEN`, run id recorded in the previous comment) → `resumeReflexion` → post the refined result.
3. Never merges, never pushes; secrets `GEMINI_API_KEY` + `ANTHROPIC_API_KEY`; permissions `issues:write, actions:read, contents:read`.

Net effect: label an issue from your phone at night; answer three yaml lines over coffee; collect a hardened, twice-critiqued plan — zero time seated at the loop. Per Fig. 5 of the paper (Stripe Minions: *"anything rule-bound is kept out of the probabilistic model"*), the runner script — not any model — owns all transport mechanics: label parsing, artifact download, yaml extraction, run-id markers, caps, and exit codes are deterministic code; the LLM only ever sees the brief and the answers.

### WS-8 — Skills readiness pass (agent- & stack-agnostic consumption)

Full findings + remediation prompt live in the companion doc `2026-07-08-skills-readiness-audit.md` (Findings F1–F5, PROMPT 8). Summary: skill *discovery* currently differs by surface (MCP globs the directory; Cursor installs from a manifest missing 11 of 29 skills — including `feature-orchestrator` and `reflexion-loop`; the README table lists 19), *runtime modes* are prose in 8 skills and absent in 21, and `knowledge-manager` hardcodes an Antigravity storage path instead of the repo's own agnostic MCP KI tools.

The fix makes the agnosticism contract machine-readable and deterministic (Fig. 5 again): two new frontmatter fields on all 29 skills — `modes: [read-only|write|mcp]` and `surface: public|internal` — a `## Runtime modes` line following the `feature-orchestrator` house pattern, and a `scripts/generate-skill-registry.ts` that *generates* the Cursor manifest and README table from frontmatter, with `validate-skills.sh --check` failing CI on any drift. After this, a human in the read-only web UI, an MCP agent in Antigravity/Cursor/VS Code, and the WS-4 crew-sizer all see the same catalog and know each skill's write capabilities before spending a token. Parallel-safe with WS-1..3; **must merge before WS-4** (the orchestrator selects personas by these fields, not by model judgment).

---

**Surface contract (applies to every workstream):** each capability is consumable on all four surfaces — read-only web UI (advises, never implies writes), CLI, MCP for any IDE agent (Antigravity, Cursor, Continue/VS Code — the engine never knows which), and CI (WS-7). Only IDE/MCP agents and CI runners execute; only *you* merge. Skills declare their mode set (WS-8) so every surface can enforce this before invocation.

---

## 6. Four-Pillars enforcement matrix

| WS | P1 Diagnosis-First | P2 Atomic Batches | P3 Production Ethos | P4 Modern Web |
|---|---|---|---|---|
| 1 | Backfill inspects real historical metadata before rewriting | One migration, one wrapper change, one backfill — three atomic P~commits | Jest on wrapper + backfill; dry-run default | n/a (server-side) — noted per rubric |
| 2 | Interview questions must cite the critique, never be generic | Section-targeted refine avoids full re-loops | Budget caps, stopReason, evidence-bearing telemetry | Web UI: Server Components, Zod, accessible form controls |
| 3 | Cases derived from this repo's real rubric, not generic lint | One case = one violation class | Golden PASS case prevents over-rejection theater | DL-004 encodes P4 itself |
| 4 | Crew Sizing runs only after Phase-0 stack discovery | Lanes inherit <100 LOC task gates from chained skills | Reviewer must ACT (run gates, paste evidence) | Chains `design-system-review`/`accessibility-auditor` when UI-facing |
| 5 | Gap matrix compares against *our actual artifacts by path* | Adoption queue emits one issue per practice | Pillar-conflict auto-decline with recorded reason | P4 column in the matrix |
| 6 | Metrics computed from real columns, not inferred | Cards/charts shippable independently | ERR alerts encode "verification is non-negotiable" as a metric | Shadcn/Recharts, `use cache`, a11y on charts |
| 7 | Runner reads repo stack files exactly like the CLI | Start and resume are separate atomic jobs | Hard cost caps before first unattended run (paper §XI-B) | n/a — comment/artifact I/O only |
| 8 | Modes derived from each skill's own body text, never invented | One rule = one commit group across files; generator + regenerated registry land together | Validator proves drift-detection by breaking then fixing; idempotence proven by double-run | README table gains an accessible Modes column; no color-only signals |

## 7. Anti-goals (tested against every prompt)

- No micro-managed junior-dev pattern: personas receive goals + gates, not line-by-line instructions; you appear only at gates.
- No Nodding Loop: WS-3 proves rejection works; WS-6 alarms if it stops working.
- No Amnesiac Loop: every run writes disk state before it may pause.
- No Tangled Loop: one worktree per lane, single writer.
- No agent ever runs `git push` / `git add` / merges (Jules: own branch + PR only).
- No pillar is ever traded away for a source's recommendation.

## 8. References

1. "Physician, heal thyself" — your dev-team blog post (competitive-analysis skill, friction defects, TPM posture, defect libraries). Provided 2026-07-08.
2. HuaShu, *Loop Engineering: The Anthropic Playbook* (Orange Book v260615, Jun 2026) — five moves, six parts, generator/evaluator (§V, citing P. Rajasekaran, Anthropic eng. blog), anti-patterns (§VI), Stripe Minions (§VII-B, S. Kaliski), four costs (§VIII), first-loop checklist (§XII). Term coined by A. Osmani; concurrent statements by P. Steinberger and B. Cherny. **Figures 1–6 received 2026-07-08** and folded in: Fig. 4's move↔anti-pattern mapping is §7 here; Fig. 5's deterministic/LLM interlock is enforced in WS-7, WS-8, and the step map in the WS-2 spec; full alignment table at the end of `2026-07-08-reflexion-loop-v2-interview-gate.md`.
3. Repo artifacts audited: `README.md` (Four Pillars), `src/lib/ai/reflexion/*`, `scripts/reflexion-loop.ts`, `src/mcp-server/{index,telemetry}.ts`, `prisma/schema.prisma`, `src/lib/{analytics-service,workflow-roles}.ts`, `.ai/agents.md`, `.ai/skills/{feature-orchestrator,vertical-slice-decomposer,mission-control,agent-optimizer,reflexion-loop}.md`, `scripts/{validate-skills.sh,autoeval-check.mjs}`, `docs/designs/2026-03-19-*.md`, `docs/github-action-example.yml`.
4. Pillar upstreams as cited in README: garrytan/gstack · MinimumCD (beyond.minimumcd.org) · addyosmani/agent-skills · GoogleChrome/modern-web-guidance-src.
