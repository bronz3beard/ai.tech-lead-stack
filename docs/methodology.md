# 🧠 The Methodology: Four Pillars

[← Back to the README](../README.md)

The "Tech-Lead Stack" is built upon four foundational pillars of modern
engineering excellence:

1.  **G-Stack (Modularity & Diagnosis-First)**: Inspired by the
    [garrytan/gstack](https://github.com/garrytan/gstack) philosophy, this
    pillar mandates **Diagnosis before Advice**. Every skill begins with **Phase
    0: Tech-Stack Discovery**. Agents must understand the project's language,
    framework, and constraints (by inspecting `package.json`, `tsconfig.json`,
    etc.) before proposing a single line of code.
2.  **MinimumCD (Atomic Batches & Continuous Verification)**: This pillar
    prioritizes **small, atomic batches of work** (<100 lines per task) and
    continuous automated verification. It is designed to prevent "Big Bang"
    integrations by enforcing
    [vertical slicing](https://beyond.minimumcd.org/docs/) and early detection
    of regression risks.
3.  **Agent Skills (Production-Grade Ethos)**: Based on Addy Osmani's
    [agent-skills](https://github.com/addyosmani/agent-skills), this pillar
    treats AI agents as disciplined senior engineers rather than shortcut-taking
    assistants.
4.  **Modern Web Guidance**: Based on
    [GoogleChrome/modern-web-guidance-src](https://github.com/GoogleChrome/modern-web-guidance-src),
    this pillar helps coding agents build better web applications using modern,
    high-performance, accessible, and secure APIs instead of legacy workarounds.

## Production-Grade Ethos

Our methodology is reinforced by the
[Agent Skills](https://github.com/addyosmani/agent-skills) ethos, ensuring AI
agents default to high-discipline engineering rather than the shortest path:

- **Process over Prose**: Skills are structured workflows (not vague advice)
  with specific verification gates.
- **Anti-Rationalization**: It uses documented rebuttals to combat common AI
  excuses (e.g., "I'll add tests later" or "The fix seems right").
- **Verification is Non-Negotiable**: Every task must end with hard evidence
  (tests, logs, or screenshots). "Seems right" is never an acceptable exit
  criterion.

> [!NOTE] **G-Stack is a Methodology, not a Stack**: While the name implies a
> specific technology set, the Tech-Lead Stack treats "G-Stack" as an
> engineering philosophy centered on modularity, diagnosis-first planning, and
> robust verification. It is designed to work seamlessly with C#, Python,
> JavaScript, Java, Go, and any other ecosystem.

> [!NOTE] **🧭 The 9-Phase Lifecycle** The orchestrators govern features through
> a strict 9-phase lifecycle (Intent, Specify, Plan, Build, Review, Deploy,
> Scale, Polish, Maintain). Under the "nine-in-metadata" rule, a skill's phase
> lives strictly in its extended markdown frontmatter contract and the compiled
> `skills.graph.json`, never in its directory structure.

## Skill Orchestration & Handoffs

Skills are classified along **kind**, **domain**, and **ownership** axes.
Orchestrator skills use `spans` to run sub-agents. Handoffs between skills are
strictly typed and backed by Knowledge Items. A skill's `consumes` and `emits`
properties map directly to KI slugs, ensuring that a skill only runs when its
prerequisite artifacts exist. The MCP server uses `plan_pipeline` and a
graph-aware `get_skill` tool (which injects requires/suggests footers) to
enforce this graph. The compiled `skills.graph.json` acts as the source of truth
for these relationships; any undocumented drift is blocked in CI by the drift
gate (`npm run generate:registry -- --check`).

## Policies & CI Hooks Enforcer

Dynamic operational rules are injected via `.ai/policies` (e.g., four-pillars,
user-sovereignty, diagnosis-first). The hooks layer (`.ai/hooks`) enforces
ownership gates at MCP call-time and in CI via a dedicated hooks enforcer.

## Execution Targets

Agent tasks are governed by four distinct execution targets depending on budget
and capability constraints:

- **`local`**: Offline execution using the local model tier.
- **`sub-pro`**: Baseline subscription tier ($20/mo) execution.
- **`sub-max`**: Advanced subscription tier ($100/mo) execution.
- **`byo`**: Bring-Your-Own API key execution for full capabilities.

## Analytics

Every telemetry event is written to Postgres (`AnalyticsEvent`), the single
source of truth. There is no external tracing backend. Each row has a `kind`:

| kind               | Recorded by                                   | Carries cost? |
| ------------------ | --------------------------------------------- | ------------- |
| `skill_invocation` | MCP `get_skill(s)`, chat workflow/skill loads | No            |
| `llm_generation`   | Web chat answers, reflexion phases with usage | Yes           |
| `tool_call`        | Skill-editor chat tools                       | No            |
| `loop_step`        | Reflexion phase markers without usage         | No            |

The MCP server never sees the LLM call (it runs on the agent's own
subscription), so MCP rows measure adoption and workflow, not spend. Their
`promptTokens` is the size of the skill text the agent will read. Only
`llm_generation` rows carry a `totalCost`, priced from
`packages/core/src/lib/ai/reflexion/pricing.ts`; `costIsEstimate` is `false`
when the usage came from a provider response.

Rows are grouped into sessions by `sessionId` (chat id, reflexion run id, or an
MCP session that the agent may supply and that otherwise rotates after 30
minutes idle). Rows written under Jest are tagged `environment = 'test'` and are
excluded from the dashboards.

The public home page shows adoption only (no spend). Spend, per-provider and
per-project breakdowns are on `/dashboard`, behind sign-in, scoped to the
projects you can access. Each card states its source and window.

### Beta: task outcomes with AI vs without

When one project is selected, `/dashboard` compares merged pull requests that
were AI-assisted with those that were not. A merged PR is the unit of work. The
project must be linked to a GitHub repository and you must be signed in with
GitHub; the data is read-only and cached for 15 minutes.

A PR is **AI-assisted** if any of these hold: TLS recorded a skill load or LLM
call on its branch or PR number; a commit has a `Co-Authored-By:` trailer naming
an AI tool; its description has an AI "Generated with" marker; or an AI coding
agent (for example Jules) opened it. Dependency and release bots, and revert
PRs, are excluded from both groups.

| Metric                 | Definition                                                     |
| ---------------------- | -------------------------------------------------------------- |
| Cycle time             | First commit → merge (DORA lead-time proxy), median and p75    |
| Coding / pickup/review | First commit → opened / opened → first review / review → merge |
| PR size                | Lines added + deleted, median                                  |
| Revert rate            | Share later reverted by a `Revert "<title>"` PR in the window  |
| Throughput             | Merged PRs per week                                            |

Groups are compared on medians, because cycle times are heavily skewed. No
difference is shown until each group has at least 5 PRs. Because AI-assisted
PRs are often smaller, the panel also reports a **size-adjusted** cycle-time
difference: medians are compared within size buckets (XS < 50, S < 200,
M < 500, L ≥ 500 changed lines), using only buckets with 3+ PRs in both groups,
weighted by PR count. People choose when to use AI, so every difference is a
correlation, not proof that AI caused it.

## ✨ Special Feature: The Reflexion Loop

The Reflexion Loop is a self-correcting plan loop that leverages Gemini as the
creator to draft an implementation plan, and Claude as the critic to grade it
against the Four Pillars and provide fixes.

This feature is exposed via two distinct surfaces:

- **Web & Chat (Read-Only Path)**: Accessible via `/reflexion`. It operates in
  an advisory role, generating a plan and an IDE prompt but never modifying the
  codebase directly.
- **MCP Tool & `/reflexion-loop` Workflow (Developer Path)**: Executed in the
  IDE using `rtk run reflexion-loop` or the MCP server tool `reflexion_loop`. It
  allows the calling agent to change code and logs usage telemetry to Prisma.
