# Choosing a tier

[← Back to the README](../README.md)

## Tier Decision Guide

- **no keys + $20/mo** -> `reflexion-loop-sub-pro` + `dev-team-sub-pro`; ceiling
  M; Risk-2 refused at intake and escalated if discovered mid-flight
- **no keys + $100/mo** -> `reflexion-loop-sub-max` + `dev-team-sub-max`;
  ceiling XL with a Tech-Lead confirmation gate
- **API keys** -> `reflexion-loop` + `dev-team-orchestrator`

> [!NOTE] **Platform facts (as of August 2026)** — verify current pricing and
> quotas with the vendor.
>
> 1. Google confirmed a $100/month AI Ultra tier at I/O 2026 at roughly 5x Pro
>    quotas, and cut the top tier from $250 to $200.
> 2. On Antigravity, all paid tiers ($20 Pro, $100 Ultra, $200 Ultra Max) run
>    THE SAME MODEL LINEUP with the same context limits. The extra cost buys
>    rate limits and weekly-cap headroom, not better model access.
> 3. Google has not published what a single AI credit buys in tokens, requests
>    or compute time. Budget by observation rather than arithmetic: individual
>    frontier-model sessions have been reported consuming a large share of a
>    monthly allowance, and multi-day lockouts occur when a quota is exhausted.
> 4. The Antigravity CLI routes through the SAME credit pool as the IDE.
>    Switching surfaces does not restore quota.
> 5. Gemini CLI stopped serving Google AI Pro, Ultra and free Gemini Code Assist
>    individual users on 18 June 2026. The consumer replacement is Antigravity
>    CLI (agy). Enterprise Gemini Code Assist licences are the exception.

## Architecture: Harness Independence vs. Model Separation

To choose the right tier for your environment, distinguish between these two
independent axes:

| Axis                     | Description                                                                                                                                               |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HARNESS INDEPENDENCE** | Does the skill run under any agent? `reflexion-loop` does NOT, because `scripts/reflexion-loop.ts` calls model endpoints directly, bypassing the harness. |
| **MODEL SEPARATION**     | Do the writer and the auditor differ? `reflexion-loop` guarantees it in code; the subscription tiers get it from the harness instead.                     |

Subscription tiers obtain model separation FROM THE HARNESS rather than from
direct API calls. Where the harness offers models from more than one vendor, L0
separation matches the API loop's guarantee. Where it does not, the tiers fall
back through L1 to L3 and DISCLOSE the level achieved. The difference is
enforcement location, not assurance level.

The real tradeoff is throughput: the subscription tiers are throughput-limited
(quota, lanes, crew ceiling, critique passes), and they cannot enforce distinct
models in code the way `validateDistinctModels` does — which is why disclosure
is mandatory.

When using subscription tiers that rely on the harness for model separation, the
orchestrator targets specific isolation levels:

| Level                    | Description                                                               |
| :----------------------- | :------------------------------------------------------------------------ |
| **L0 (Cross-Vendor)**    | Writer and reviewer run on models from different vendors.                 |
| **L1 (Cross-Family)**    | Writer and reviewer run on different model families from the same vendor. |
| **L2 (Fresh Sub-Agent)** | Same model, fresh sub-agent context.                                      |
| **L3 (Degraded)**        | Same model, same context.                                                 |

> [!NOTE] **IDE & CLI Model Selection (as of June 2026):** Consumer Google AI
> Pro/Ultra access via legacy standalone `gemini` CLI stopped on 18 June 2026.
> The active consumer CLI is Antigravity CLI (`agy`). When configuring
> cross-vendor model pairing (L0), verify available models via your agent
> harness model picker (e.g. Antigravity Agent Manager, Cursor Composer model
> dropdown, or Claude Code sub-agent configuration).
>
> The subscription tiers resolve their critic with
> `./.ai/rtk-run run resolve-critic --writer <anthropic|google|openai> --writer-model <id>`,
> which smoke-tests and walks: Gemini (`gemini` CLI with `GEMINI_API_KEY`,
> Vertex AI or enterprise Code Assist, then `agy` for consumer Google plans) ->
> `codex` (ChatGPT plan or OpenAI API key) -> Claude (a Claude Code sub-agent,
> else `claude -p` on a Claude plan or `ANTHROPIC_API_KEY`) -> another harness
> model -> same model. The writer's own vendor is skipped, and a Claude writer
> gets a different Claude model. The last rung forces `PROVISIONAL` and writes a
> STRONG `criticAdvisory` into `state.json`. Set `TLS_CRITIC_MODEL` to pin the
> `agy` model.
