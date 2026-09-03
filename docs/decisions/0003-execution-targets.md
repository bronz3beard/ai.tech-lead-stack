# ADR 0003: Execution Targets (Local, Subscription, API)

## Context

The same skills should be runnable in three quite different setups: on a private
model on a developer's own machine (privacy, no per-use cost), on a paid chat
subscription (no API keys, capped usage), and on a pay-per-use API (full power,
cross-vendor). The stack already models the last two as "tiers" in
`packages/core/src/lib/ai/tier-policy.ts` (`byo`, `sub-max`, `sub-pro`). This
decision adds **`local`** as a first-class tier and defines how skills and the
reflexion loop behave across all four.

## Decision

### 1. Four targets

| Concern                      | `local` (new)                                                                                      | `sub-pro` (~$20)    | `sub-max` (~$100)   | `byo` / API                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------- | ------------------- | ------------------- | ------------------------------------------------- |
| Authentication               | none - on-device                                                                                   | vendor subscription | vendor subscription | API keys (`ANTHROPIC_API_KEY` + `GEMINI_API_KEY`) |
| Model wiring                 | OpenAI-compatible endpoint (Ollama / llama.cpp) via a base URL                                     | single vendor       | single vendor       | multiple vendors                                  |
| Reflexion: creator vs critic | same model, two sequential passes with different prompts                                           | same vendor         | same vendor         | must be two distinct vendors                      |
| Budget unit                  | tokens + wall-clock time (no dollars)                                                              | capped turns/lanes  | capped turns/lanes  | dollar ceiling                                    |
| Parallel work lanes          | 1 (single lane)                                                                                    | 1                   | up to 2             | 3+                                                |
| Skill availability           | only skills whose `targets` include `local` **and** whose `minModelClass` the local model can meet | all public          | all public          | all public                                        |
| Privacy                      | fully offline                                                                                      | vendor cloud        | vendor cloud        | vendor cloud                                      |

### 2. How `local` plugs in (three integration points)

These are the only files that need to change to add the tier; each was confirmed
against the current code:

- `packages/core/src/lib/ai/model-registry.ts` - `createModel(modelId, apiKey)`
  already builds provider clients (`createAnthropic` /
  `createGoogleGenerativeAI` / `createOpenAI`). Add a `local` branch that
  returns
  `createOpenAI({ baseURL: LOCAL_MODEL_ENDPOINT, apiKey: 'local' })(modelId)`.
  (Ollama and most local runners expose an OpenAI-compatible `/v1` endpoint, so
  no new SDK is needed.)
- `packages/core/src/lib/ai/tier-policy.ts` - add `'local'` to the `Tier` type
  and a frozen `TIER_POLICY.local` entry (single lane, `maxTaskSize: 'M'`,
  token/wall-clock ceilings, `escalateTo: 'sub-pro'`).
- `packages/core/src/lib/ai/orchestrator.ts` -
  `validateDistinctModels(creator, auditor, tier)` currently throws when the
  creator and auditor are the same model. Add a `local` exemption: allow the
  same model but require two sequential passes with different prompts
  (self-critique), so the "objective second opinion" guarantee degrades
  gracefully offline instead of blocking.

### 3. Skill availability is governed by `targets` and `minModelClass`

- `targets: [local, subscription, api]` - which tiers a skill supports at all.
- `minModelClass: small | mid | large` - the smallest model that can run the
  skill well.

On the `local` tier the loader hides any skill whose `targets` omit `local`, or
whose `minModelClass` exceeds the configured local model's class. When a needed
skill is hidden, the orchestrator reports "requires a larger model or the
sub-pro tier" rather than failing mid-run. (Example: `planning-expert` is
`minModelClass: large`; on a small local model the lighter
`planning-expert-quick` is offered instead.)

### 4. Budgets differ by target

- `api` / `byo`: dollar ceilings (`REFLEXION_MAX_COST_USD`).
- `sub-pro` / `sub-max`: capped turns and lanes (already enforced).
- `local`: token budget plus a wall-clock ceiling
  (`REFLEXION_MAX_WALLCLOCK_MS`); dollar ceilings are ignored because there is
  no per-use cost.

New environment variables for local: `LOCAL_MODEL_ENDPOINT`, `LOCAL_MODEL_NAME`,
`LOCAL_MODEL_CLASS`, `REFLEXION_MAX_WALLCLOCK_MS`.

### 5. Handoffs are the same across all targets

Phase-to-phase handoffs use Knowledge Items (see ADR 0002 §6). Because Knowledge
Items are filesystem-backed, the identical mechanism works offline, in the IDE,
and in the cloud. No target needs a database for handoffs (the cloud dashboard
may additionally record run/analytics state in its database, but the artifact
payloads remain Knowledge Items).

### 6. Governance is target-independent

Ownership rules (ADR 0002 §5) and the hooks that enforce them apply regardless
of target. In particular, an AI actor may never self-approve a `deploy` or
`scale` step, and a `build` step may not start on an unapproved `spec`, whether
the work is running locally, on a subscription, or on the API.

## Consequences

- Positive: one skill library serves privacy-sensitive offline use, low-cost
  subscription use, and full-power API use, with the differences captured
  declaratively rather than forked into separate code paths.
- Cost: three library files change, two new skills are added (a local reflexion
  variant and a degraded local orchestrator), and the reflexion loop must honor
  a wall-clock stop condition.
- Trade-off: on `local`, the creator/critic "second opinion" is weaker (same
  model, sequential) than on `byo` (two vendors). This is an accepted,
  documented degradation for offline use.

## Status

Accepted (proposed for `main`). Implemented in the runbook's Phase 5. Related:
ADR 0002 (Lifecycle Paradigm).
