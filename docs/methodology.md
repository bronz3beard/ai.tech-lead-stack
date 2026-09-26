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

We capture per-phase measurement metrics using Langfuse telemetry, which
includes recent accuracy fixes (PROMPTS A and B) to better track agent
progression.

Every skill run is recorded in Postgres (`AnalyticsEvent`). If Langfuse is
configured, it is also sent there as a trace with environment `tls` and tag
`source:tls`. Langfuse is configured with `TLS_`-prefixed variables only:

```bash
TLS_LANGFUSE_PUBLIC_KEY="pk-lf-..."
TLS_LANGFUSE_SECRET_KEY="sk-lf-..."
TLS_LANGFUSE_BASE_URL="https://us.cloud.langfuse.com"
```

The generic `LANGFUSE_*` names are ignored on purpose. A gateway that spawns
this stack (see [Running behind an upstream MCP proxy](mcp-proxy-setup.md))
passes its own environment down, and reading those names sent every run into the
gateway's Langfuse project as a duplicate trace. See
[CHANGELOG.md](../CHANGELOG.md) for the migration.

The web dashboard reads Postgres, not Langfuse. Each card states its source and
window (`Source: TLS store · Latest 1,000 runs`, or the date range you picked),
so its figures should not be compared directly with Langfuse's.

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
