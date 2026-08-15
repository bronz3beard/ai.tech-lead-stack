# Tokenomics & Model-Routing Implementation Playbook

### For `ai.tech-lead-stack` — to be executed by Antigravity (Gemini 3.1 Pro)

Each work item below has three parts: **What & why**, **What's involved** (exact
files, grounded in the current code), and an **Antigravity prompt** you can
paste straight into the IDE agent. Modification-heavy items also include a
**code sketch**. Four accompanying files ship with this playbook:

- `model-registry.ts` → `src/lib/ai/model-registry.ts` (real, drop-in)
- `calibrate-skill-costs.ts` → `scripts/calibrate-skill-costs.ts` (real,
  drop-in)
- `replay-plan-budgets.ts` → `scripts/replay-plan-budgets.ts` (real, drop-in)
- `skill-variance-harness.ts` → `scripts/skill-variance-harness.ts` (real,
  drop-in)

**Do the phases in order.** Everything cost-related depends on Phase A, and the
routing UI/MCP work depends on Phase B.

---

## The three stacks you're touching (so the agent doesn't re-discover them)

**Cost / telemetry**

- Skill estimates live in frontmatter as `cost: ~N tokens`, regex-enforced in
  `scripts/generate-skill-registry.ts` and `scripts/validate-skills.sh`.
- `src/lib/telemetry-service.ts` logs every skill run to Langfuse **and**
  Postgres (`AnalyticsEvent`), then `enrichEvent()` pulls real Langfuse usage
  back into the row.
- `src/lib/ai/reflexion/pricing.ts` (`PRICE_PER_MTOK`) is the only per-model
  $/MTok table.
- `src/components/dashboard/InsightsTable.tsx` shows
  `hasLangfuseCost ? actual : FALLBACK_TOKEN_COST[skill]`.

- `src/lib/ai/model-resolver.ts` resolves per-responsibility model routing.
  **Note:** `MODEL_*` environment variables (`MODEL_PLANNER`,
  `MODEL_IMPLEMENTER`, `MODEL_AUDITOR`, `MODEL_ADJUDICATOR`) should be left
  **UNSET** so the UI/DB remains authoritative. Environment variables remain
  available as an optional headless override only.

**UI / persistence**

- `src/components/settings/ProfileForm.tsx` → the "Orchestrator Defaults" card
  with two dropdowns (Creator / Auditor), options are provider families only.
- `src/app/api/settings/profile/route.ts` → Zod-validated save into
  `User.requirementsModel/auditModel/preferredModel`.
- `prisma/schema.prisma` → `User` holds per-provider keys + the three model
  prefs; `Project` has a free-form `settings Json?` — the natural home for
  per-project routing.

### Known inconsistencies Phase A fixes

1. **Provider-locking** — SDK chosen by role slot, not by model id (blocks the
   whole feature).
2. **`telemetry-service.recordEvent` hardcodes GPT-4o pricing**
   (`inputCost = tokens/1e6 * 5.0`, output `* 15.0`) regardless of the actual
   model. Cost math is wrong for every non-GPT-4o run.
3. **`FALLBACK_TOKEN_COST` in `InsightsTable.tsx` has drifted** from the
   frontmatter estimates (e.g. `planning-expert` = 475 there vs `~1200 tokens`
   in frontmatter). Two sources of "estimate", disagreeing.

---

# PHASE A — Foundations (ship first)

## A1 · Provider-agnostic model registry

**What & why.** A single factory that takes a _model id_ and returns a client,
inferring the provider from the id. This decouples `(provider, model)` so any
responsibility can point at any model — the precondition for "Opus plans, Flash
implements".

**What's involved.**

- Drop in the provided `src/lib/ai/model-registry.ts` (`providerOf`,
  `createModel`, `MODEL_CATALOG`). It's pure and taxonomy-independent, uses no
  `@/` alias (so tsx scripts can import it), and matches the SDK call style
  already used in `initializeModel`.
- Add a unit test for `providerOf` prefix rules and the Jules-vs-Gemini key-slot
  distinction.

**Antigravity prompt.**

```
Add src/lib/ai/model-registry.ts exactly as provided in this package. Then write
src/lib/ai/__tests__/model-registry.test.ts covering: providerOf() returns
'anthropic' for 'claude-opus-4-6', 'google' for 'gemini-3.5-flash' and the Jules
id 'gemini-3.1-pro', 'openai' for 'gpt-5.4'; providerOf() throws on an unknown id;
createModel() throws when the key is empty. Do NOT use the '@/' path alias in
model-registry.ts — it is imported by tsx CLI scripts. Run the existing test suite
and confirm no regressions.
```

## A2 · One pricing source of truth

**What & why.** Cost math must key off the real model. Unify the scattered
numbers into `PRICE_PER_MTOK` and make everything read from it.

**What's involved.**

- Extend `PRICE_PER_MTOK` (`src/lib/ai/reflexion/pricing.ts`) to cover every id
  in `MODEL_CATALOG` (Opus/Sonnet/Haiku, Gemini Flash/Pro, Jules, GPT-5.4). Keep
  the "operator-maintained, single source of truth" comment.
- In `src/lib/telemetry-service.ts`, delete the hardcoded `5.0 / 15.0` GPT-4o
  block and compute cost via `PRICE_PER_MTOK[resolvedModel]`, falling back to
  `0` **and a one-time warning** when a model is missing (mirror the
  `warnedAboutCost` pattern in `providers-env.ts`). Don't crash on unpriced
  models.
- Make `FALLBACK_TOKEN_COST` in `InsightsTable.tsx` derive from the frontmatter
  estimates instead of a hand-kept map: import a generated `skill-cost-map.json`
  (emit it from `generate-skill-registry.ts`) so the dashboard fallback and the
  frontmatter can never drift again.

**Antigravity prompt.**

```
Unify cost math onto PRICE_PER_MTOK.
1. Extend PRICE_PER_MTOK in src/lib/ai/reflexion/pricing.ts to include every model
   id in MODEL_CATALOG (model-registry.ts). Use placeholder rates with a TODO to
   confirm against provider pricing pages; keep the single-source-of-truth comment.
2. In src/lib/telemetry-service.ts recordEvent(), remove the hardcoded 5.0/15.0
   GPT-4o cost and instead look up PRICE_PER_MTOK[resolvedModel]. If missing, cost
   contribution is 0 with a single console.warn per model (copy the warnedAboutCost
   Set pattern from providers-env.ts). Do not throw.
3. Replace the hand-maintained FALLBACK_TOKEN_COST object in
   src/components/dashboard/InsightsTable.tsx with values loaded from a generated
   map. Extend scripts/generate-skill-registry.ts to also emit
   src/lib/generated/skill-cost-map.json ({ [normalizedSkillName]: estimateTokens })
   parsed from each skill's `cost: ~N tokens`, and import that in InsightsTable.
Add/adjust tests in src/lib/__tests__/telemetry-service.test.ts for the lookup and
the missing-model fallback.
```

---

# PHASE B — Model-agnostic, per-responsibility routing (the feature)

> Goal: a dev sets, per project, which model plays each responsibility — e.g.
> Project A → planner=`claude-opus-4-6`, implementer=`gemini-3.5-flash`,
> auditor=`claude-sonnet-4-6` — via project env vars, with the web app able to
> view/override those defaults.

## B1 · Responsibility taxonomy (ratify this one decision first)

The repo has two role vocabularies today: orchestrator (creator/auditor) and
reflexion (creator/critic/adjudicator). Your example adds a distinct
**implementer**. Proposed unified set:

| Responsibility | Meaning                                        | Back-compat mapping                                                                       |
| -------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `planner`      | Produces the plan/blueprint                    | `User.requirementsModel`, env `REQUIREMENTS_DEVELOPMENT_MODEL`, `REFLEXION_CREATOR_MODEL` |
| `implementer`  | Writes the code in the sandbox                 | _new_ — env `MODEL_IMPLEMENTER`                                                           |
| `auditor`      | Reviews / critiques (must differ from planner) | `User.auditModel`, env `CODE_AUDIT_MODEL`, `REFLEXION_CRITIC_MODEL`                       |
| `adjudicator`  | Final verdict in the reflexion loop            | env `REFLEXION_ADJUDICATOR_MODEL`                                                         |

Keep the existing distinctness guards (`validateDistinctModels`,
`assertDistinct`) applied to planner vs auditor and creator vs critic.

## B2 · Resolution chain + rework the runners

**What & why.** One resolver decides the model id per responsibility, with a
clear precedence, then hands `(id, key)` to `createModel`. The runners stop
choosing SDKs by slot.

**Resolution order (highest wins):** project env var →
`Project.settings.modelRouting[role]` → user preference → system default
(`MODELS`).

**Code sketch — `src/lib/ai/model-resolver.ts`:**

```ts
// NOTE: app-side module — '@/' is fine here (not imported by tsx scripts).
import type { Project, User } from '@prisma/client';
import { MODELS } from '@/app/api/chat/constants';
import { catalogEntry, createModel } from '@/lib/ai/model-registry';
import { decrypt } from '@/lib/crypto';

export type Responsibility =
  | 'planner'
  | 'implementer'
  | 'auditor'
  | 'adjudicator';

const ENV_BY_ROLE: Record<Responsibility, string[]> = {
  planner: [
    'MODEL_PLANNER',
    'REFLEXION_CREATOR_MODEL',
    'REQUIREMENTS_DEVELOPMENT_MODEL',
  ],
  implementer: ['MODEL_IMPLEMENTER'],
  auditor: ['MODEL_AUDITOR', 'REFLEXION_CRITIC_MODEL', 'CODE_AUDIT_MODEL'],
  adjudicator: ['MODEL_ADJUDICATOR', 'REFLEXION_ADJUDICATOR_MODEL'],
};
const SYSTEM_DEFAULT: Record<Responsibility, string> = {
  planner: MODELS.GEMINI,
  implementer: MODELS.GEMINI,
  auditor: MODELS.CLAUDE,
  adjudicator: MODELS.CLAUDE,
};

export function resolveModelId(
  role: Responsibility,
  ctx: { user?: User | null; project?: Project | null }
): string {
  for (const key of ENV_BY_ROLE[role])
    if (process.env[key]?.trim()) return process.env[key]!.trim();
  const routing = (ctx.project?.settings as any)?.modelRouting;
  if (routing?.[role]) return routing[role];
  if (role === 'planner' && ctx.user?.requirementsModel)
    return normalizeLegacy(ctx.user.requirementsModel);
  if (role === 'auditor' && ctx.user?.auditModel)
    return normalizeLegacy(ctx.user.auditModel);
  return SYSTEM_DEFAULT[role];
}

// Pick the right key slot for a model id, then build the client.
export function resolveModel(
  role: Responsibility,
  ctx: { user?: User | null; project?: Project | null }
) {
  const id = resolveModelId(role, ctx);
  const slot = catalogEntry(id)?.keySlot ?? 'gemini';
  const key = keyFor(slot, ctx.user); // reads user.<slot>ApiKey (decrypt) or process.env fallback
  return createModel(id, key);
}
// normalizeLegacy(): map 'gemini'|'claude'|'openai'|'jules' → a concrete MODELS.* id.
// keyFor(): jules → user.julesApiKey, gemini → geminiApiKey, etc. (env fallbacks for headless).
```

**What's involved.**

- Add `model-resolver.ts` (above).
- Rewrite `runnerFromEnv()` and `runnerFromUser()`
  (`src/lib/ai/reflexion/providers-*.ts`) to call
  `resolveModel('planner'|'auditor'|'adjudicator', ctx)` instead of
  `google(...)`/`anthropic(...)`. Keep `buildRunner` and the distinctness guards
  untouched.
- Fold the legacy resolution in `getOrchestratorModels` into the resolver so
  there's one path.

**Antigravity prompt.**

```
Introduce a single model resolver and make the reflexion runners provider-agnostic.
1. Add src/lib/ai/model-resolver.ts per the sketch in the playbook: resolveModelId()
   with precedence env → Project.settings.modelRouting[role] → user pref → MODELS
   default, plus keyFor()/normalizeLegacy() helpers. Responsibilities:
   planner | implementer | auditor | adjudicator.
2. Rewrite runnerFromEnv() and runnerFromUser() in src/lib/ai/reflexion/providers-env.ts
   and providers-user.ts to build creator/critic/adjudicator via
   createModel(resolveModelId(role, ctx), key) — remove the hardcoded google()/anthropic()
   slotting. Preserve buildRunner unchanged and keep assertDistinct/validateDistinctModels
   on planner-vs-auditor and creator-vs-critic.
3. Route getOrchestratorModels(user) through the resolver so there is one resolution path.
Add tests: env override beats project setting beats user pref beats default; a planner
set to 'claude-opus-4-6' actually instantiates the Anthropic client; distinctness guard
still fires when planner == auditor.
```

## B3 · Project-level config: `Project.settings.modelRouting` + env contract

**What & why.** Per-project overrides that also work headless (MCP/CLI) via env
vars.

**What's involved.**

- Define the shape stored in `Project.settings`:
  ```jsonc
  {
    "modelRouting": {
      "planner": "claude-opus-4-6",
      "implementer": "gemini-3.5-flash",
      "auditor": "claude-sonnet-4-6",
      "adjudicator": "claude-sonnet-4-6",
    },
  }
  ```
- Add a Zod schema `ModelRoutingSchema` (validate ids against `MODEL_CATALOG`)
  reused by the API route and the resolver.
- Document the per-project env vars (`MODEL_PLANNER`, `MODEL_IMPLEMENTER`,
  `MODEL_AUDITOR`, `MODEL_ADJUDICATOR`) plus the existing `*_API_KEY` keys in
  `.env.example` / `docs/`.

**Antigravity prompt.**

```
Add project-level model routing. Create a Zod ModelRoutingSchema (record of
responsibility → model id, each id must exist in MODEL_CATALOG) in
src/lib/ai/model-routing-schema.ts. Persist it under Project.settings.modelRouting
(no schema migration needed — settings is Json?). Wire an API route
src/app/api/projects/[id]/model-routing/route.ts (GET + PUT, owner/ADMIN only,
validate with the schema). Update .env.example and docs/using-the-dev-team.md with
the per-project env vars MODEL_PLANNER / MODEL_IMPLEMENTER / MODEL_AUDITOR /
MODEL_ADJUDICATOR and note they override the UI defaults.
```

## B4 · Web-app UI: responsibility matrix + per-project overrides

**What & why.** Turn the two-dropdown "Orchestrator Defaults" into an
N-responsibility matrix, and let options be **concrete model ids** (Opus vs
Flash), not just families — otherwise the granularity you want can't be
expressed. Add a project-scoped override screen.

**What's involved.**

- `ProfileForm.tsx`: replace the two hardcoded `<Select>`s with a loop over
  responsibilities; source options from `MODEL_CATALOG` (label/id). Keep the
  shadcn `Select`, dark-zinc theme, and `grid` layout already in that file.
- Persist the extra roles: either add `implementerModel`/`adjudicatorModel`
  columns to `User`, or store user-level routing in a JSON `User.settings`
  (cheaper; mirrors the project shape). Recommend the JSON approach for symmetry
  with `Project.settings`.
- Extend `src/app/api/settings/profile/route.ts` Zod schema accordingly.
- New component `ProjectModelRouting.tsx` on the project settings surface,
  reading/writing the B3 route; show the effective value and its source (env /
  project / user default) so a dev understands precedence.

**Antigravity prompt.**

```
Expand the model-selection UI to per-responsibility, concrete-model granularity.
1. In src/components/settings/ProfileForm.tsx, replace the two Creator/Auditor
   <Select>s with a matrix over [planner, implementer, auditor, adjudicator]. Build
   options from MODEL_CATALOG (value=id, label=label) with a leading "System Default"
   option (value=""). Keep the existing shadcn Select component, dark zinc styling,
   and grid layout.
2. Store user-level routing as JSON on the user (add User.settings Json? if absent)
   and update the Zod schema + prisma select in
   src/app/api/settings/profile/route.ts.
3. Add src/components/settings/ProjectModelRouting.tsx that GET/PUTs the
   /api/projects/[id]/model-routing route from B3 and, for each responsibility,
   shows the effective model AND its source (env > project > user > default) so
   precedence is visible. Match ProfileForm's styling.
Keep everything type-safe against MODEL_CATALOG so invalid ids can't be selected.
```

## B5 · MCP wiring

**What & why.** Headless agents (Antigravity, CLI, other IDEs) must get the same
routing, and the reflexion MCP tool should accept per-role overrides and expose
the budget knobs that currently exist only in the CLI.

**What's involved.**

- `src/mcp-server/index.ts` → `REFLEXION_LOOP_TOOL` inputSchema currently
  exposes `maxRevisions` + `passThreshold` only. Add optional `models`
  (`{ planner?, auditor?, adjudicator? }`) and `budget`
  (`{ maxCostUsd?, maxTokens? }`).
- `src/mcp-server/handlers.ts` → pass those through to the runner/engine; when
  absent, fall back to the resolver using project + env context
  (`src/mcp-server/user-resolver.ts` already resolves the acting user).
- Ensure `runnerFromEnv` reads project context if the MCP call includes a
  `projectName`.

**Antigravity prompt.**

```
Thread model routing + budgets through MCP. In src/mcp-server/index.ts extend
REFLEXION_LOOP_TOOL.inputSchema with optional `models` {planner?,auditor?,adjudicator?}
and `budget` {maxCostUsd?,maxTokens?}. In src/mcp-server/handlers.ts handleReflexionLoop,
apply per-call model overrides (else resolve via model-resolver using the acting user
from user-resolver.ts plus process.env), and forward budget into the engine's
ReflexionConfig.budget. Keep behaviour identical when the new fields are omitted.
Update src/mcp-server/__tests__/index.test.ts for the new schema.
```

---

# PHASE C — Cost intelligence

## C1 · Skill-cost calibration

**What & why.** The estimate→actual loop is half-built: Langfuse actuals
silently replace estimates in the dashboard, but nothing checks the estimate.
This script pulls observed p50/p95 per skill from Postgres, diffs against the
frontmatter `cost:`, flags drift, and (with `--write`) rewrites the drifting
estimates. This is "we start using Langfuse after enough data" made rigorous.

**What's involved.**

- Drop in `scripts/calibrate-skill-costs.ts` (provided). It self-loads `.env`
  via `src/lib/prisma.ts`, uses `normalizeSkillName` to match rows, requires a
  minimum sample size, and rounds to the nearest 50 tokens to satisfy the strict
  `~N tokens` validator.
- Add an npm script and a CI job that runs it **without** `--write`; it exits
  non-zero when drift exceeds the threshold, turning stale estimates into a
  failing check.

**Antigravity prompt.**

```
Add scripts/calibrate-skill-costs.ts as provided. Add package.json script
"calibrate:skills": "tsx scripts/calibrate-skill-costs.ts". Add a CI step
(mirroring scripts/validate-skills.sh usage) that runs it read-only on a schedule
or in PRs touching .ai/skills/**; the non-zero exit on drift should fail the job.
Do not add --write to CI. Verify it runs against the dev database and prints the
drift table.
```

## C2 · Plan-level budget replay

**What & why.** Per-skill accuracy ≠ plan accuracy. This groups `AnalyticsEvent`
by `loopRunId` (a whole run/plan), sums estimates vs observed totals, and
reports plan-level error — the number that says whether your proceed/warn gate
is trustworthy.

**What's involved.**

- Drop in `scripts/replay-plan-budgets.ts` (provided). Supports
  `--group run|project` and `--top N`.
- Optional: surface the aggregate mean-abs-error on the dashboard next to the
  estimates.

**Antigravity prompt.**

```
Add scripts/replay-plan-budgets.ts as provided and a package.json script
"replay:budgets": "tsx scripts/replay-plan-budgets.ts". Confirm it groups by
loopRunId, prints the worst plans and the aggregate mean |error|. Then, in
src/components/dashboard/InsightsTable.tsx (or a sibling card), display the
plan-level mean |error| so users can see how trustworthy the summed-estimate gate is.
```

## C3 · Cost-per-change as the north-star metric

**What & why.** You said cost per change is the goal — so measure it directly,
not just $/skill-run.

**What's involved.**

- At record time (`telemetry-service.recordEvent` and `withAnalytics`), stamp a
  **change unit** into `metadata`: `prUrl` / `ticketId` / `featureId`. The MCP
  `reflexion_loop` and PR-automation paths already know these — pass them
  through. `loopRunId` already groups a run; the change unit ties runs to a
  shippable change.
- Dashboard: add a `$/change` and `tokens/change` aggregation keyed on the
  change unit (roll up all events sharing a `prUrl`/`ticketId`).
- Let users A/B compositions: same change through `planning-expert` vs
  `planning-expert-quick`, or full `feature-orchestrator` vs the lean path,
  compared on cost-per-change at equal output quality.

**Antigravity prompt.**

```
Add cost-per-change tracking. 1) In src/lib/telemetry-service.ts (recordEvent +
withAnalytics context), accept and persist optional metadata.changeUnit
{ prUrl?, ticketId?, featureId? }. Thread these from the reflexion MCP tool
(src/mcp-server) and the PR automation path (scripts/gh-pr-create.sh /
pr-automator) wherever a PR or ticket id is known. 2) In the dashboard, add a
"Cost per change" view that rolls up AnalyticsEvent by changeUnit and shows
$/change and tokens/change, with a breakdown by skill composition so two workflows
can be compared on the same change.
```

---

# PHASE D — Efficiency

## D1 · Reflexion budget hardening (delta early-stop + MCP budget)

**What & why.** The reflexion loop is the priciest path (2–3 model calls per
revision). The engine already has `checkBudget()` (maxCostUsd / maxTokens) and
stops on `crit.passed || score >= passThreshold`, but it has **no "nodding loop"
guard** — it keeps paying for revisions whose scores no longer improve. (The
repo even seeds a `[Fixture] Nodding Loop Run`, so the failure mode is known but
not coded against.)

**What's involved.**

- In `src/lib/ai/reflexion/engine.ts`, track score deltas across rounds. If the
  improvement between consecutive revisions is `< epsilon` (e.g. 0.5) for 2
  rounds running, stop with `stopReason = 'stalled'`. Keep existing budget/pass
  breaks.
- Surface `maxCostUsd` / `maxTokens` in the MCP tool (done in B5) so headless
  callers can cap spend, not just CLI users.

**Code sketch (inside the revision loop):**

```ts
let prevScore = -Infinity,
  stalls = 0;
const EPSILON = 0.5;
// ...after computing `score` each revision:
if (score - prevScore < EPSILON) stalls++;
else stalls = 0;
prevScore = score;
if (crit.passed || score >= passThreshold) {
  stopReason = 'passed';
  break;
}
if (stalls >= 2) {
  stopReason = 'stalled';
  break;
} // nodding loop — stop paying
if (revision >= maxRevisions) {
  stopReason = 'max-revisions';
  break;
}
```

**Antigravity prompt.**

```
Add a "nodding loop" early-stop to src/lib/ai/reflexion/engine.ts. Track the critic
score across revisions; if improvement < 0.5 for two consecutive revisions, break with
stopReason='stalled' (add it to the stopReason union). Keep the existing passed /
budget-exceeded / max-revisions breaks and the checkBudget() calls. Add a test using
a mocked runner that returns flat scores and asserts the loop stops early with
stopReason='stalled' and fewer model calls than maxRevisions. (MCP budget exposure is
handled in Phase B5.)
```

## D2 · Variance harness + prompt caching

**What & why.** Two levers: know which skills are volatile (budget those with
p95, not mean), and cut the dominant cost — repeated input context — with prompt
caching.

**What's involved.**

- Drop in `scripts/skill-variance-harness.ts` (provided): free
  historical-dispersion mode + an opt-in, capped `--live` fixed-input mode for
  the reflexion generate() call.
- **Prompt caching:** the Anthropic path re-sends a large stable prefix every
  call — `CHAT_GUARD_INSTRUCTION` (a big system block in `constants.ts`), the
  loaded skill body, and repo onboarding context. Add cache breakpoints via
  `@ai-sdk/anthropic` provider options on that stable prefix so it isn't
  re-billed at full input rate each turn. Measure the effect from `usage`
  (cache-read vs input tokens) and surface a cache-hit-rate number.

**Antigravity prompt.**

```
1. Add scripts/skill-variance-harness.ts as provided, plus package.json script
   "variance:skills": "tsx scripts/skill-variance-harness.ts". Confirm the default
   (offline) mode prints CV per skill and flags volatile ones, and that --live is
   capped at 10 runs and prints a cost estimate first.
2. Enable Anthropic prompt caching on the stable system prefix. Where the Anthropic
   client is called with CHAT_GUARD_INSTRUCTION + skill body + onboarding context
   (src/app/api/chat and the reflexion critic/adjudicator calls), mark that prefix
   with cache control via @ai-sdk/anthropic providerOptions so it is cached, not
   re-billed each turn. Record cache-read vs input tokens from the usage object into
   AnalyticsEvent.metadata and add a cache-hit-rate figure to the dashboard.
Verify no behavioural change to outputs — only cost.
```

---

## Suggested sequencing

```
A1 registry ─┬─> A2 pricing ─┬─> C1 calibration
             │               ├─> C2 plan replay
             │               └─> C3 cost/change
             └─> B2 resolver ─┬─> B3 project config ─> B4 UI
                              └─> B5 MCP ─> D1 reflexion budget
                                                       D2 variance + caching (independent)
```

A1 → A2 → B2 are the critical path; everything else can proceed once those land.

## Files touched (inventory)

- **New:** `model-registry.ts`, `model-resolver.ts`, `model-routing-schema.ts`,
  `ProjectModelRouting.tsx`, `calibrate-skill-costs.ts`,
  `replay-plan-budgets.ts`, `skill-variance-harness.ts`, `skill-cost-map.json`
  (generated), API route `projects/[id]/model-routing`.
- **Edited:** `pricing.ts`, `telemetry-service.ts`, `InsightsTable.tsx`,
  `providers-env.ts`, `providers-user.ts`, `orchestrator.ts`, `ProfileForm.tsx`,
  `settings/profile/route.ts`, `generate-skill-registry.ts`,
  `mcp-server/index.ts`, `mcp-server/handlers.ts`, `reflexion/engine.ts`,
  `chat/*` (caching), `prisma/schema.prisma` (optional `User.settings`),
  `.env.example`, `docs/using-the-dev-team.md`.
