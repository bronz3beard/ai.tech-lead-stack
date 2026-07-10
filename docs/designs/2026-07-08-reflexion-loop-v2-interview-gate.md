# Reflexion Loop v2 (Interview Gate) - Architecture Design

> Expands **WS-2** of `2026-07-08-agentic-dev-team-design.md` to spec level.
> Implemented by **PROMPT 2** in `2026-07-08-jules-prompts.md`. Depends on WS-1
> (actor telemetry). Consumed by WS-4 (dev-team plan gate), WS-6 (dashboard),
> WS-7 (cloud runner).

## 🎯 Verification Gates Context

**1. Core Goal:** Upgrade the reflexion loop from a fire-and-forget
generate→critique→adjudicate cycle into a **pausable, resumable, budgeted
state machine** whose final phase is a structured interview: the loop asks you
up to five one-line questions, each targeting either a plan section
(`refine-plan`) or a loop parameter (`tune-loop`), then parks until you answer
— from the CLI, an IDE via MCP, the web UI, or a GitHub issue comment (WS-7).
**2. Success Metric:** (a) a run killed at *any* phase resumes to completion
from disk state; (b) a plan scoring ≥9 on all four pillar sub-scores produces
**zero** questions and auto-approves; (c) a `refine-plan` answer rewrites only
the named section — every other section is byte-identical or the run hard-fails;
(d) a full run halts deterministically at `maxCostUsd`/`maxTotalTokens` with
state persisted; (e) you answer an interview from a phone (WS-7 comment) and the
loop finishes without you at a keyboard. **3. Scope/Timeline:** Medium (~25h,
one Jules session + your review). **4. Architectural Layers:** Engine
(`src/lib/ai/reflexion/` — pure, transport-agnostic), State (StateStore port:
file / Prisma / Actions artifact), Surfaces (CLI · MCP · Next.js routes · WS-7
runner), Telemetry (WS-1 `AnalyticsEvent` columns).

---

## 🛠 Strategic Design Process

### Phase 2: Approach Exploration (The Fork)

- **Option A (Recommended) — Interview as a first-class engine phase behind a
  StateStore port.** The engine gains `INTERVIEWING` / `AWAITING_ANSWERS` /
  `REFINING_PLAN` / `TUNING_LOOP` states and a `resumeReflexion(runId, answers)`
  entrypoint. Persistence goes through a tiny `StateStore` interface so the same
  engine serves all four surfaces: `FileStateStore` (CLI/MCP →
  `.reflexion-out/state.json`), `DbStateStore` (web → `ReflexionRun` row),
  artifact-backed JSON (WS-7). This mirrors the existing `ReflexionRunner` port
  pattern already in `engine.ts` — the engine stays agent- and stack-agnostic.
- **Option B (Rejected) — Interview as an external wrapper script around v1.**
  A script runs the v1 loop, reads `critique.json`, asks questions, re-invokes.
  Rejected: state, budget, and telemetry would live *outside* the engine, so MCP
  and web surfaces would need parallel re-implementations (surface divergence),
  a kill between wrapper steps loses everything (**Amnesiac Loop**, Fig. 4), and
  budget caps could be bypassed by calling the engine directly.

**Decision:** Option A. One engine, one state machine, N thin transports — the
same shape that already keeps the v1 loop agent-agnostic.

---

### Phase 3: Architectural Presentation

#### 1. The Data Model

All schemas live in `src/lib/ai/reflexion/schema.ts` (Zod is the single source
of truth; types are `z.infer` exports).

- **`ReflexionStateV2`** — `{ version: 2, runId (uuid), brief, phase, plan,
  critiques: Critique[], revision, params: LoopParams, usage: { totalTokens,
  costUsd, perPhase[] }, interview?: Interview, stopReason?, createdAt,
  updatedAt }`. Persisted **after every transition**, atomically
  (`state.json.tmp` → `rename`). A v1 output dir (no `state.json`) is
  migrated on first `--resume` by wrapping `plan.md` + `critique.json`.
- **`LoopParams`** — `{ passThreshold (default 8), maxRevisions (3),
  maxCostUsd (default 3), maxTotalTokens, focus? }`. `tune-loop` answers apply a
  Zod-validated `LoopParamsPatch` — unknown keys are a hard error, never a
  silent ignore.
- **`InterviewSchema`** — `{ runId, revision, recommendation: 'approve' |
  'refine-plan' | 'tune-loop' | 'stop', questions: Question[] (max 5) }` where
  `Question = { id, target: 'plan' | 'loop', ref (plan section slug | param
  name), question (answerable in one line), why }`. **Zero-question rule:** if
  all four pillar sub-scores in the latest `Critique` are ≥9, the interviewer
  must emit `recommendation: 'approve'` with `questions: []` — enforced by a
  deterministic post-check, not trusted to the prompt.
- **`AnswersSchema`** — `{ runId, decisions: [{ id, answer }], directive?:
  'approve' | 'stop' }`. Parsed from the fenced ` ```yaml ` block in
  `interview.md` (CLI/WS-7) or a JSON body (web/MCP).
- **`StopReason`** — `'passed' | 'user-approve' | 'user-stop' |
  'budget-exceeded' | 'max-revisions' | 'refine-contract-violation'`.
- **Prisma `ReflexionRun`** — `{ id, userId?, brief, status, stateJson Json,
  latestScore?, revision, costUsd, createdAt, updatedAt }` + index on
  `(userId, updatedAt)`. Backs `DbStateStore` and the WS-6 dashboard table.
  Additive migration only.

#### 2. The Logic

**State machine** (engine-owned; every arrow persists state first):

| From | Event | To |
| :-- | :-- | :-- |
| `INIT` | brief accepted | `GENERATING` |
| `GENERATING` | plan produced | `CRITIQUING` |
| `CRITIQUING` | critique parsed | `ADJUDICATING` |
| `ADJUDICATING` | pass ≥ threshold | `INTERVIEWING` (auto-approve path) |
| `ADJUDICATING` | fail & revision < max | `GENERATING` (revise) |
| `ADJUDICATING` | fail & revision = max | `INTERVIEWING` |
| `INTERVIEWING` | questions > 0 | `AWAITING_ANSWERS` (exit 2, parked) |
| `INTERVIEWING` | zero-question rule | `APPROVED` |
| `AWAITING_ANSWERS` | answers: plan targets | `REFINING_PLAN` → `CRITIQUING` |
| `AWAITING_ANSWERS` | answers: loop targets only | `TUNING_LOOP` → `ADJUDICATING` (re-judge current plan under new params) |
| `AWAITING_ANSWERS` | `directive: approve` | `APPROVED` (writes `ide-prompt.md`) |
| `AWAITING_ANSWERS` | `directive: stop` | `STOPPED('user-stop')` |
| any LLM step | budget gate trips | `STOPPED('budget-exceeded')` |

Mixed answers (plan + loop targets) apply the param patch first, then take the
`REFINING_PLAN` branch — one pass, no double regeneration.

**Deterministic vs. probabilistic step map** (Fig. 5, Stripe Minions:
*"anything rule-bound is kept out of the probabilistic model"*):

| Step | Kind | Where |
| :-- | :-- | :-- |
| Schema validation (every LLM output) | Deterministic | Zod parse, reject+retry once, then hard fail |
| Budget gate before each LLM call | Deterministic | engine; `usage ≥ cap → STOPPED`, model never consulted |
| Router thresholds / max revisions | Deterministic | engine |
| Zero-question rule check | Deterministic | post-parse check on sub-scores |
| Section-diff invariant (below) | Deterministic | byte compare of untouched sections |
| State persistence + atomic rename | Deterministic | StateStore |
| Exit codes / labels / comments | Deterministic | surfaces (CLI, WS-7 runner) |
| Generate / revise plan | LLM | `runner.generate` (Gemini) |
| Critique / adjudicate | LLM | `runner.critique` / `adjudicate` (Claude) |
| Interview question drafting | LLM | new `runner.interview` (Claude) |
| Section rewrite | LLM | `SECTION_REFINE` prompt |

**Section-refine contract:** plan sections are addressed by slugged `##`
headings. `SECTION_REFINE` receives *only* the target section + the answer +
the shared `RUBRIC`, and returns the rewritten section. The engine splices it
in and byte-compares every *other* section against the prior plan; any drift →
`STOPPED('refine-contract-violation')` (exit 4). This is the guardrail that
makes "refine part of the plan" trustworthy rather than a stealth full rewrite.

**Evaluator posture** (Fig. 3 — *evaluator acts, assumes broken*): the critic
judges plan *text*, so "acting" is discharged two ways: (a) the WS-3 defect
library continuously proves the critic still rejects known-bad plans (ERR
calibration); (b) the adjudicator deterministically verifies the plan's
verification commands are present and pasteable (Pillar 3) before a pass can
route to `APPROVED`. Code-level acting belongs to the WS-4 reviewer persona.

**Prompts** (`prompts.ts`, additive): `INTERVIEWER_SYSTEM` — receives brief +
latest plan + latest critique + `LoopParams`; must emit questions answerable in
one line, each mapped to exactly one `target`/`ref`; must prefer the *lowest*
pillar sub-score as the first question's subject. `SECTION_REFINE` — as above.
The shared `RUBRIC` constant remains the one authority for all five prompts
(generator, critic, adjudicator, interviewer, refiner) — the core v1 invariant
is preserved.

**Telemetry contract** (WS-1): one `AnalyticsEvent` per phase transition —
`skillName: 'reflexion-loop'`, `actorType: 'AGENT'`, `autonomy: 'AUTONOMOUS'`
(`'DIRECTED'` only when `--interactive` answers arrive on a live TTY),
`loopRunId: runId`, `loopPhase`, `metadata: { revision, score?, passed?,
stopReason? }`. Human answers are *not* events — the human is visible as the
gap between `AWAITING_ANSWERS` and resume, which is exactly what WS-6's
"human touchpoints per run" counts.

#### 3. The Interface

- **CLI** (`scripts/reflexion-loop.ts`, `rtk run reflexion-loop`): flags
  `--auto` (never park; approve on pass, stop on max-revisions), `--interactive`
  (answer questions inline on TTY), `--resume <runId|dir>`,
  `--answers <file.yaml>`, `--max-cost-usd`, `--max-tokens`, `--focus`.
  **Exit codes:** `0` approved/passed · `2` parked awaiting answers · `3`
  budget/user stop · `4` contract violation/error. Artifacts in
  `.reflexion-out/`: `state.json`, `plan.md`, `critique.json`, `interview.md`
  (human-readable questions + a fenced `yaml` answers template to fill in),
  `ide-prompt.md` on approval.
- **MCP** (`src/mcp-server/index.ts`): existing `reflexion_loop` gains
  `params`/`auto`; new `reflexion_resume { runId, answers }`. This is the IDE
  surface — Antigravity, Cursor, and Continue/VS Code all consume it
  identically; nothing in the engine knows which agent called.
- **Web UI** (read-only posture): `POST /api/orchestrator/reflexion` starts a
  run against `DbStateStore`; `POST /api/orchestrator/reflexion/resume` submits
  answers. `ReflexionClient.tsx` renders the interview as a form (one input per
  question, target badge `plan §slug` / `loop param`), plus Approve / Stop
  buttons mapping to `directive`. The browser never touches the filesystem —
  state lives in `ReflexionRun.stateJson`; the downloadable `ide-prompt.md` is
  generated server-side on approval.
- **Cloud runner (WS-7):** same `state.json`, stored as an Actions artifact;
  `interview.md` posted as an issue comment; your comment reply *is* the
  answers yaml. No new engine code — the runner is a fourth thin transport.

#### 4. The Proof

- **Unit (Jest):** router table above as parameterized cases; budget gate stops
  *before* the call (mock runner asserts zero invocations); Zod round-trip for
  every schema; zero-question rule fires on an all-9s critique;
  `LoopParamsPatch` rejects unknown keys; section splice + byte-diff invariant
  (mutating an untouched section → exit 4); v1 output-dir migration.
- **Integration:** kill/resume drill — run with a mock runner, `SIGKILL` after
  each phase in turn, `--resume` completes every time (this is the
  Amnesiac-Loop regression test and must stay in CI).
- **Eval interplay (WS-3):** after merge, `rtk run reflexion-eval` still
  rejects DL-001..006 and passes DL-007 — proves the prompt additions didn't
  soften the critic.
- **Manual:** one real run per surface: CLI `--interactive`; CLI park → edit
  `interview.md` → `--resume --answers`; MCP from an IDE; web form. Paste all
  four evidence blocks in the PR (Pillar 3).

---

## 📦 Deliverables Validation & Tasks

### Implementation Tasks (Prioritized)

1. **[3h] Schemas + StateStore port:** `ReflexionStateV2`, `Interview`,
   `Answers`, `LoopParamsPatch`, `StopReason`; `StateStore` interface +
   `FileStateStore` (atomic rename) + v1 migration shim.
2. **[5h] Engine phases + router:** `INTERVIEWING`/`AWAITING_ANSWERS`/
   `REFINING_PLAN`/`TUNING_LOOP`; `resumeReflexion`; budget gate; section-diff
   invariant; `runner.interview()` + `runner.getUsage()` on the port.
3. **[2h] Prompts:** `INTERVIEWER_SYSTEM`, `SECTION_REFINE`; wire shared
   `RUBRIC`.
4. **[3h] CLI:** flags, exit codes, `interview.md` writer/parser.
5. **[2h] Telemetry:** per-phase events via WS-1 columns.
6. **[2h] MCP:** `reflexion_resume`, extend `reflexion_loop`.
7. **[4h] Web:** `ReflexionRun` migration, `DbStateStore`, resume route,
   interview form in `ReflexionClient.tsx`.
8. **[4h] Tests:** unit table + kill/resume integration + eval re-run.

### Filing/Testing Strategy

- **New Files:** `src/lib/ai/reflexion/{state-store.ts,interview.ts}`,
  `src/app/api/orchestrator/reflexion/resume/route.ts`,
  `prisma/migrations/*_add_reflexion_run/`,
  `src/lib/ai/reflexion/__tests__/{router,state-store,interview,resume}.test.ts`.
- **Modified:** `engine.ts`, `schema.ts`, `prompts.ts`, `providers-*.ts`,
  `scripts/reflexion-loop.ts`, `src/mcp-server/index.ts`,
  `src/app/reflexion/ReflexionClient.tsx`, `prisma/schema.prisma`,
  `.ai/skills/reflexion-loop.md` (document v2 flags + modes).
- **Testing:** `pnpm check-types && pnpm test && pnpm validate:skills` pasted
  as evidence; kill/resume drill in CI.

### 🔄 Mandatory Rollback Strategy

1. **DB Rollback:** revert the `ReflexionRun` migration (additive-only, so a
   down-migration drops one table and no existing data).
2. **Code Reversal:** revert the feature-branch merge commit; v1 engine
   signatures are untouched (all new phases are additive), so callers of the
   v1 API keep working during any partial revert.
3. **State Hygiene:** `.reflexion-out/` dirs from v2 runs are self-contained;
   delete or keep — v1 ignores `state.json`.
4. **Fallback:** if `DbStateStore` proves problematic, the web route can
   temporarily run `--auto` (no parking) against `FileStateStore` on the
   server while keeping CLI/MCP v2 intact — surfaces degrade independently.

---

## Figure alignment (Loop Engineering, Figs. 1–6)

| Fig. | Claim | Where it lands here |
| :-- | :-- | :-- |
| 1 | Loop eng. automates the "waiting for you" | `AWAITING_ANSWERS` parks; WS-7 answers arrive async |
| 2 | Scheduling feeds unfinished turns into the next run; verification says "no" | resume-from-state; critic + threshold router |
| 3 | Evaluator: different model, assumes broken, acts | Claude critiques Gemini; DL harness + evidence check discharge "acting" |
| 4 | Each anti-pattern = one move skipped | Persistence→state.json per transition · Verification→WS-3 · Scheduling→WS-7 · Handoff→ide-prompt.md · Discovery→Phase-0 rubric line |
| 5 | Deterministic gates interlock with LLM steps | step map in §Logic — gates in engine, never in prompts |
| 6 | Four costs feed each other | budget gate (token blowout) · interview keeps you comprehending (rot) · evidence rule (verification debt) · approve stays yours (surrender) |
