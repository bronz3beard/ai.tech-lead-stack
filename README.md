# The Lead Stack: Agent-Agnostic Workflows

![CI Status](https://github.com/bronz3beard/tech-lead-stack/actions/workflows/agent-ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

A high-performance repository of "Skills" and RTK-powered tools designed for
Tech Leads. These workflows are **Agent-Agnostic**, allowing any LLM agent
(Gemini, Claude, GPT) to assist with implementation planning, code review, and
automated testing.

Live Web App:
[https://ai-tech-lead-stack.vercel.app](https://ai-tech-lead-stack.vercel.app)

> [!NOTE] **Related project — **SML Gate** (`small-language-model-gate`, CLI
> `slm-gate`) — a local AI routing and pre-processing layer that uses a small,
> free local model via Ollama to intercept, compress, and answer easy or
> repetitive prompts before they reach your paid subscription or API cloud
> model, cutting token spend and protecting your monthly quota. Its `mcp-gate`
> layer can sit in front of this stack's MCP server (`TLS_ADAPTER=on` +
> `DOWNSTREAM_MCP` pointing at `dist/mcp-server.mjs`) to condense tool and skill
> payloads before they hit your editor's context window.**
>
> <a href="https://github.com/zenithfoundry/sml-gate" target="_blank" rel="noopener noreferrer">Explore
> SML Gate on GitHub →</a>

## Table of Contents

- [Commands Quick Reference](#commands-quick-reference)
- [Which tier am I on?](#which-tier-am-i-on)
  - [Tier Decision Guide](#tier-decision-guide)
  - [Architecture: Harness Independence vs. Model Separation](#architecture-harness-independence-vs-model-separation)
- [🚀 Quick Start](#-quick-start)
- [Antigravity Setup](#antigravity-setup)
- [Cursor Setup](#cursor-setup)
- [Continue Setup](#continue-setup)
- [Workflow Catalogue](#workflow-catalogue)
- [The Web App](#the-web-app)
- [Docs](#docs)
- [Available Skills](#available-skills)
  - [Orchestrators](#orchestrators)
  - [Discover & Define](#discover-define)
  - [Plan & Harden](#plan-harden)
  - [Build & Fix](#build-fix)
  - [Review & Verify](#review-verify)
  - [Design & UI](#design-ui)
  - [Ship & Communicate](#ship-communicate)
  - [Internal Skills](#internal-skills)
- [🧠 The Methodology: Four Pillars](#-the-methodology-four-pillars)
- [🛠 Technical Architecture: RTK & MCP Synergy](#-technical-architecture-rtk-mcp-synergy)
- [🛠 Technical Overview: Skill Discovery & Priority](#-technical-overview-skill-discovery-priority)
- [How to use in any project](#how-to-use-in-any-project)
- [Branching Strategy](#branching-strategy)
- [Requirements](#requirements)
- [🧹 Resetting a Project](#-resetting-a-project)
- [🧪 CI/CD](#-cicd)
- [Resources 📚](#resources-)

## Commands Quick Reference

| What you're doing                 | Call this               | Key principle                                |
| :-------------------------------- | :---------------------- | :------------------------------------------- |
| **Leading a multi-agent team**    | `/dev-team`             | Orchestrates sub-agents safely in parallel.  |
| **Deep architecture planning**    | `/plan`                 | Full codebase audit, solid vertical slices.  |
| **Fast lean tasks**               | `/plan-quick`           | High velocity for smaller changes.           |
| **Breaking down tickets**         | `/vertical-slice`       | Creates ClickUp-ready tasks (<= 2d).         |
| **Local pre-commit check**        | `/code-review`          | 4 gates (Spec, SOLID, A11y, Evidence).       |
| **Visual testing**                | `/verify-changes`       | Playwright-powered before/after screenshots. |
| **Fixing QA/Regression feedback** | `/regression-bug-fix`   | Maps impact and remediates safely.           |
| **Merging to main**               | `/pr-automator`         | Synthesized diffs with visual proof.         |
| **Full feature loop (Sandbox)**   | `/feature-orchestrator` | End-to-end implementation from idea.         |
| **Asking codebase questions**     | `/ask`                  | High-density technical advice.               |

## Which tier am I on?

| Your plan                       | Loop to call             | Dev-team to call        | Capabilities & Isolation                                                                      |
| :------------------------------ | :----------------------- | :---------------------- | :-------------------------------------------------------------------------------------------- |
| **API keys (Gemini+Anthropic)** | `reflexion-loop`         | `dev-team-orchestrator` | Dual-model SDK enforcement (`validateDistinctModels`), 3+ parallel lanes, uncapped.           |
| **$100-a-month subscription**   | `reflexion-loop-sub-max` | `dev-team-sub-max`      | Max 2 parallel lanes, git worktrees, L0–L3 cross-vendor verify, 60 turn budget.               |
| **$20-a-month subscription**    | `reflexion-loop-sub-pro` | `dev-team-sub-pro`      | Single-lane pair (no worktrees), L0–L3 cross-vendor verify, 20 turn budget, capped at M size. |

### Tier Decision Guide

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

### Architecture: Harness Independence vs. Model Separation

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

## 🚀 Quick Start

### Three Ways to Run the Tech-Lead-Stack MCP

The MCP server is built as a **standalone artifact** (`dist/mcp-server.mjs`),
which is why it can be reached in more than one way. There are three paths. Two
of them — **Direct** and **`install.sh`** — reach the _same_ MCP server
(install.sh just automates the setup); the **SLM Gate** path puts a gateway _in
front_ of it.

**Prerequisite for every path:** build the artifact once.

```bash
pnpm run mcp:build   # bundles src/mcp-server + src/lib/ai into dist/mcp-server.mjs
```

(`install.sh` runs this for you — see Path C.)

---

**Path A — Direct MCP** Point your IDE's MCP config straight at the stack's
`mcp:start`:

```json
{
  "mcpServers": {
    "tech-lead-stack": {
      "command": "npm",
      "args": [
        "--prefix",
        "/path/to/tech-lead-stack",
        "--silent",
        "run",
        "mcp:start"
      ]
    }
  }
}
```

Best when: you use one IDE you configure by hand, working against the stack's
own repo. The server automatically falls back to the stack's own skills, so
nothing else is required.

---

**Path B — Through the SLM Gate (`mcp-gate`)** Instead of pointing your IDE at
the stack directly, run the SLM Gate's `mcp-gate` and set its `DOWNSTREAM_MCP`
env var to the stack's MCP artifact. The gate becomes the front door and
forwards tool calls _downstream_ to the tech-lead-stack MCP.

Best when: you want the gate's layer in front of the stack —
small-language-model / model routing, request filtering, or aggregating several
MCP servers behind a single endpoint — rather than talking to the stack in
isolation. The `mcp-gate` configuration (flags beyond `DOWNSTREAM_MCP`) lives in
the `@zenithfoundry/slm-gate` repo's own docs. (The stack is consumable by other
tools the same way — e.g. voice-relay via `STACK_REPO` — because it is just a
standalone artifact.)

---

**Path C — `install.sh` (turnkey setup of Path A + the full dev experience)**
Run `install.sh` if you want any of the following. It builds the artifact for
you and then wires the direct MCP config, so it is the automated form of Path A
plus extras:

1. **Skills on other repos** — symlinks `AGENTS.md` and `.agents/` into the
   target repo. Crucial for non-MCP agents (Copilot, Jules, simple
   rules-readers) and per-project skill overrides; also drops in the PR template
   and GitHub Actions.
2. **Terminal CLI or CI** — installs the `rtk` CLI, wires your shell alias,
   checks `gh` auth.
3. **Multi-IDE setup** — zero-touch MCP merges and workflow symlinking across
   Cursor, Continue, and Claude Desktop.
4. **First-time build** — runs `mcp:build` automatically.

---

**How they relate**

- Path A and Path C both give you the **direct** MCP server; Path C is just the
  turnkey installer (build + config + CLI + CI + cross-repo context) for it.
- Path B is the only one that changes the **topology**: the SLM Gate sits in
  front and the stack's MCP runs downstream of it.

> **Bottom line:** Talking to the stack in one IDE against this repo → **Path
> A**. Want the terminal tools, CI templates, multi-IDE support, or context
> files in other repos → **Path C** (`install.sh`). Want a gateway in front for
> routing/filtering/aggregation → **Path B** (SLM Gate). All three run the same
> built artifact underneath.

### 1. Installation

Clone this repo and link it globally for easy access:

```bash

# Add this to your ~/.zshrc
alias lead-init='bash /path/to/tech-lead-stack/install.sh --link .'

# Cursor: register skills globally (~/.cursor/skills/) without touching your app repo
alias lead-init-cursor='bash /path/to/tech-lead-stack/install.sh --link . --ide cursor'

# Continue: register skills and MCP globally (~/.continue/config.yaml) without touching your app repo
alias lead-init-continue='bash /path/to/tech-lead-stack/install.sh --link . --ide continue'

```

### 2. Initialize a Project

Navigate to any repository you want to automate and run the new alias:

```bash

lead-init

```

### 🤖 AI Model Routing & Precedence

Model choices for AI responsibilities (`planner`, `implementer`, `auditor`,
`adjudicator`) are configured directly in the web UI at `/settings` (User
default routing) and on the Project settings surface (Per-project model
routing).

- **UI & DB Authoritative**: `MODEL_*` environment variables (`MODEL_PLANNER`,
  `MODEL_IMPLEMENTER`, `MODEL_AUDITOR`, `MODEL_ADJUDICATOR`) should be left
  **UNSET** so the UI and database remain the source of truth.
- **Precedence Chain**: `Project.settings.modelRouting` →
  `User.settings.modelRouting` → `System Default`. Environment variables remain
  available as an optional headless override only.

### Local Execution Tier

To use the fully offline `local` execution tier, set the following environment
variables:

- `LOCAL_MODEL_ENDPOINT`: The baseURL of the OpenAI-compatible local model
  server (e.g., `http://localhost:11434/v1` for Ollama).
- `LOCAL_MODEL_NAME`: The ID of the local model (e.g., `qwen2.5-coder:3b`,
  `llama-3.1:8b`).
- `LOCAL_MODEL_CLASS`: (Optional) The class of the local model (`small`, `mid`,
  `large`) used for filtering skills that require a minimum model size. As a
  rule of thumb:
  - `small`: < 10B parameters (e.g., `qwen2.5-coder:3b`, `qwen2.5-coder:7b`)
  - `mid`: 10B - 35B parameters (e.g., `qwen2.5-coder:32b`)
  - `large`: > 35B parameters (e.g., `qwen2.5-coder:72b`, `llama-3.1:70b`)
- `REFLEXION_MAX_WALLCLOCK_MS`: (Optional) The maximum wall-clock time in
  milliseconds allowed for the Reflexion loop when running locally.

### 🔌 Consuming the MCP server

The MCP server logic is built as a standalone artifact that can be consumed by
other tools (e.g., SLM Gate's `mcp-gate` via the `DOWNSTREAM_MCP` env var, or
the voice-relay via `STACK_REPO`). To build it, run:

```bash
pnpm run mcp:build
```

This will bundle the core logic (`src/mcp-server` and `src/lib/ai`) into
`dist/mcp-server.mjs`.

## Antigravity Setup

### Step 1: Clone the Repository

Open your terminal and clone the `tech-lead-stack` repository to a permanent
location on your machine.

```bash
git clone https://github.com/your-username/tech-lead-stack.git ~/tech-lead-stack
cd ~/tech-lead-stack
```

### Step 2: Run the Installer

Run the `install.sh` script to set up dependencies and link the stack to your
current working directory.

```bash
./install.sh --link .
```

_Note: This will also output a JSON snippet for MCP configuration. Keep this
handy for Step 6._

**Updating an Existing Installation:** If you already use the `tech-lead-stack`
in your projects and are pulling the latest updates, you don't need to re-run
`install.sh` in every project. Just run the following in the `tech-lead-stack`
root directory to update the MCP server bundle:

```bash
pnpm install
pnpm run mcp:build
```

### Step 3: Access Antigravity Customizations

Open the **Agent** panel in Antigravity. Click the **"Open Agent Manager"**
button at the top to find the **Customizations** menu.

### Step 4: Navigate to Workflows

In the Customizations panel, select the **Workflows** tab.

### Step 5: Register Global Workflows

To make workflows available across all projects:

1. Click the **+ Global** button.
2. Open any workflow file from `.agents/workflows/` in your IDE (e.g.,
   `audit-tech-debt.md`).
3. Copy the entire content of the markdown file.
4. Paste it into the Antigravity workflow editor.
5. Give it a name (e.g., `audit-tech-debt`). You can optionally add a suffix
   like `-tls` if you want to distinguish them.
6. Repeat for other workflows you wish to use globally.

### Step 6: Configure the MCP Server

Antigravity requires the MCP server to execute tools (like `rtk`).

1. Go to **Settings** (Gear icon) -> **MCP**.
2. Add a new MCP server named `tech-lead-stack`.
3. Use the following configuration (replacing `/path/to/tech-lead-stack` with
   your actual absolute path):

```json
{
  "mcpServers": {
    "tech-lead-stack": {
      "command": "npm",
      "args": [
        "--prefix",
        "/path/to/tech-lead-stack",
        "--silent",
        "run",
        "mcp:start"
      ]
    }
  }
}
```

### Step 7: Usage

You can now invoke these workflows in the Agent chat by typing `/` followed by
the workflow name.

---

name: workflow-clean-code-audit description: Clean Code Audit

---

// turbo

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Inspect the project root to
   identify the primary language and framework.

2. Call the tech-lead-stack.get_skills tool:
   - skillName: "clean-code"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to audit architecture and recommend SOLID improvements.

---

## Cursor Setup

### Step 1: Clone the Repository

Open your terminal and clone the `tech-lead-stack` repository to a permanent
location on your machine.

```bash
git clone https://github.com/your-username/tech-lead-stack.git ~/tech-lead-stack
cd ~/tech-lead-stack
```

### Step 2: Run the Installer with Cursor Flag

Run the `install.sh` script to set up dependencies and link the stack to your
current working directory.

```bash
./install.sh --link . --ide cursor
```

_Note: This will also output a JSON snippet for MCP configuration. Keep this
handy for Step 4._

### Step 3: Verify Symlinked Skills

The `install.sh` script will automatically symlink the skills into your global
`~/.cursor/skills/` directory. You can verify this by running:

```bash
ls -la ~/.cursor/skills/
```

You should see symlinks to the `.ai/skills/` directory of the `tech-lead-stack`
repo.

### Step 4: Configure the MCP Server in Cursor

Cursor requires the MCP server to execute tools (like `rtk`).

1. Open **Cursor Settings** (Gear icon) -> **Cursor Settings**.
2. Select **MCP** from the sidebar.
3. Click **+ Add New MCP Server**.
4. Name the server `tech-lead-stack`.
5. Set the **Type** to `command`.
6. Use the following configuration (replacing `/path/to/tech-lead-stack` with
   your actual absolute path):

```json
{
  "command": "npm",
  "args": [
    "--prefix",
    "/path/to/tech-lead-stack",
    "--silent",
    "run",
    "mcp:start"
  ]
}
```

### Step 5: Usage

You can now invoke these skills in the Cursor chat by typing `@` followed by the
skill name (e.g., `@planning-expert`). Cursor will suggest the skill from the
list of available global skills.

## Continue Setup

Continue support requires your Continue extension to have the MCP server
installed and the commands bound.

> [!NOTE] Continue's OSS release is frozen at v2.0.0 (following the Cursor
> acquisition). The installer targets this frozen schema. For a maintained,
> local-first alternative, we recommend using Cline.

### Step 1: Clone the Repository

Clone the `tech-lead-stack` repository to a permanent location on your machine.

```bash
git clone https://github.com/your-username/tech-lead-stack.git ~/tech-lead-stack
cd ~/tech-lead-stack
```

### Step 2: Run the Installer with Continue Flag

Run the installer with the `--ide continue` flag. The installer merges the setup
globally into `~/.continue/config.yaml` to make MCP and slash commands available
across all projects.

```bash
./install.sh --link . --ide continue
```

### Step 3: Verify the Global Config

The installer safely merges `tech-lead-stack` into the `mcpServers` list in your
global `~/.continue/config.yaml` and embeds all `.agents/workflows` as `prompts`
entries.

You can verify this by checking your config:

```bash
cat ~/.continue/config.yaml
```

### Step 4: Invoke Workflows

Open Continue in VS Code. You can now use the `/` command prefix in the chat to
see the newly imported workflows (e.g. `/plan-quick`). By putting the IDE agent
in "Agent" mode, it will have access to the Stack's MCP tools to execute
commands like `get_skills` natively!

## Workflow Catalogue

There are 45 workflows available. Note that `pm-` and `hr-` workflows are
currently NOT symlinked by `install.sh` (only `.agents/workflows/` is). For
these suites, you will need to copy-paste or manually register them.

### Engineering (`.agents/workflows/`)

| Workflow                                | Description                                                                               |
| :-------------------------------------- | :---------------------------------------------------------------------------------------- |
| **accessibility-audit**                 | Specialized audit for Web Accessibility (A11y).                                           |
| **ask**                                 | A Q&A workflow to chat with the Agent about the codebase.                                 |
| **audit-tech-debt**                     | Technical Debt Audit                                                                      |
| **changelog**                           | Generate Changelog                                                                        |
| **clean-code-audit**                    | Clean Code Audit                                                                          |
| **code-review**                         | Pre-PR Quality Gatekeeper Code Review                                                     |
| **competitive-analysis**                | Port of the blog's /competitive-analysis - compare this stack against external sources.   |
| **design-requirements-to-architecture** | Feature Design Assistant                                                                  |
| **design-system-review**                | AI-augmented design review with a 2-iteration guard.                                      |
| **dev-team**                            | The flagship orchestration workflow for an agentic dev team                               |
| **feature-orchestrator**                | Three-Phase Feature Engine (Research -> Plan -> Implement)                                |
| **init**                                | Master Setup                                                                              |
| **mission-architect**                   | Master Feature Orchestration                                                              |
| **onboard-dev**                         | Codebase Onboarding Intelligence                                                          |
| **plan**                                | Implementation & Bug Planning                                                             |
| **plan-quick**                          | Ultra-lean strategic planning.                                                            |
| **pr-automator**                        | PR Automator (with Mandatory UI Verification & Draft Mode)                                |
| **pr-design-review-init**               | Start an AI-powered design review from an existing GitHub PR URL.                         |
| **qa-handover**                         | Generate a QA handover + universal smoke-test criteria document and deliver it to ClickUp |
| **reflexion-loop**                      | ✨ Special feature Requires API keys - run the two-model self-correcting plan loop        |
| **regression-bug-fix**                  | Unified Feedback & Regression Fix                                                         |
| **security-audit**                      | Security Audit                                                                            |
| **standup-daily-summary**               | Daily Standup Report                                                                      |
| **strategy-target-evaluation**          | Product Strategy Audit                                                                    |
| **style-logic-exporter**                | Export Tailwind v3.4 design tokens to Figma                                               |
| **ui-spec-generator**                   | AI-Powered UI Spec Generator                                                              |
| **verify-changes**                      | Visual Smoke Test                                                                         |
| **vertical-slice**                      | Decompose user stories into ClickUp-ready vertical slices                                 |
| **weekly-leadership-report**            | Weekly Leadership Status Report (Team-Wide)                                               |

### Product Management (`.agents/pm-workflows/`)

| Workflow                     | Description                                                  |
| :--------------------------- | :----------------------------------------------------------- |
| **pm-action-item-mapper**    | Maps meeting notes into actionable items.                    |
| **pm-backlog-auditor**       | Audits backlog for stale or blocked tickets.                 |
| **pm-context-summarizer**    | Summarizes project context for stakeholders.                 |
| **pm-design-system-auditor** | Reviews designs against the established system.              |
| **pm-effort-estimator**      | Estimates developer effort for new features.                 |
| **pm-newsletter-generator**  | Generates an internal product update newsletter.             |
| **pm-progress-translator**   | Translates dev progress to business value.                   |
| **pm-release-note-drafter**  | Drafts comprehensive release notes.                          |
| **pm-risk-detector**         | Identifies potential risks in the roadmap.                   |
| **pm-story-augmenter**       | Augments basic user stories with acceptance criteria.        |
| **pm-task-specifier**        | Creates detailed technical specifications from requirements. |

### Human Resources (`.agents/hr-workflows/`)

| Workflow                       | Description                                       |
| :----------------------------- | :------------------------------------------------ |
| **hr-ad-distributor**          | Distributes job ads across channels.              |
| **hr-candidate-sourcer**       | Sources candidates based on job requirements.     |
| **hr-endorsement-synthesizer** | Synthesizes feedback into candidate endorsements. |
| **hr-intake-specifier**        | Gathers hiring manager requirements.              |
| **hr-interview-auditor**       | Audits interview feedback for consistency.        |
| **hr-jd-drafter**              | Drafts comprehensive job descriptions.            |
| **hr-pipeline-translator**     | Translates pipeline metrics into hiring reports.  |

## The Web App

The repo provides a hosted web surface at
[https://ai-tech-lead-stack.vercel.app](https://ai-tech-lead-stack.vercel.app).
**Note:** The website/chat surface is READ-ONLY and returns a plan plus a
copy-paste IDE prompt; only the IDE/MCP surface edits code.

| Route                              | Purpose                                  |
| :--------------------------------- | :--------------------------------------- |
| `/chat`                            | Read-only advisory interface             |
| `/dashboard`                       | Agentic Health telemetry                 |
| `/reflexion`                       | Web frontend for the Reflexion loop      |
| `/skills/roles`                    | Role definitions                         |
| `/skills/solutioning`              | Collaborative solutioning interface      |
| `/skills/new`                      | New skill scaffolding                    |
| `/feature-development/discovery`   | Phase 0 Discovery interface              |
| `/feature-development/in-progress` | Implementation tracker                   |
| `/design-review`                   | Design system and PR review interface    |
| `/onboarding`                      | Onboarding interface for new devs        |
| `/settings`                        | API keys and Agent routing configuration |

## Peripherals & Sibling Apps

- **[Voice Relay Service](peripherals/voice-relay/README.md)**: A local node
  service that parses spoken transcripts and executes them via keyless agent
  CLIs (`agy`, `claude`, `codex`, `cursor-agent`).
- **[Voice Assistant App](../../../voice-assistant-app)**: A mobile client
  (iOS/Android) that acts as a hands-free voice interface for the Tech Lead
  Stack. It connects to the local `voice-relay` peripheral to execute codebase
  changes via voice commands.

## Docs

| Document                                                                                                                       | Purpose                                       |
| :----------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- |
| [`docs/IMPLEMENTATION_PLAYBOOK.md`](./docs/IMPLEMENTATION_PLAYBOOK.md)                                                         | The definitive guide on implementation.       |
| [`docs/using-the-dev-team.md`](./docs/using-the-dev-team.md)                                                                   | Guide to operating the dev-team orchestrator. |
| [`docs/skill-readiness.md`](./docs/skill-readiness.md)                                                                         | Status of skill readiness.                    |
| [`docs/reflexion-issue-runner.md`](./docs/reflexion-issue-runner.md)                                                           | Running reflexion as a GitHub issue loop.     |
| [`docs/github-action-example.yml`](./docs/github-action-example.yml)                                                           | Reference for CI automation.                  |
| [`docs/designs/2026-07-08-agentic-dev-team-design.md`](./docs/designs/2026-07-08-agentic-dev-team-design.md)                   | Design doc for the dev team orchestrator.     |
| [`docs/designs/2026-07-08-reflexion-loop-v2-interview-gate.md`](./docs/designs/2026-07-08-reflexion-loop-v2-interview-gate.md) | Design doc for the reflexion loop.            |

## Available Skills

<!-- SKILLS_TABLE:START -->

### Intent

Strategic alignment, market analysis, and product requirements.

| Skill                          | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                       | How it works                                                                                         | Use Case                                                          | Modes                 | Est. Context Footprint |
| :----------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------- | :-------------------- | :--------------------- |
| **`ask`**                      | Expert technical advisor providing architectural insights and precise code snippets for MANUAL implementation. STRICTLY READ-ONLY / advisory: it explains, diagnoses, and hands back copy-pasteable snippets, but never edits files, runs mutating commands, or implements changes itself. Use for "how does this work?", "where should this change go?", or "how would I change this?" questions about a codebase, in read-only chat or inside an IDE/MCP agent. | Diagnostic research via Phase 0 discovery, followed by high-density technical advice and snippets.   | Q&A about the codebase or "How would I change this?" queries.     | read-only, mcp        | ~3050 tokens           |
| **`competitive-analysis`**     | Port of the blog's /competitive-analysis: compare this stack against external sources (blog posts, other agent stacks/plugins, papers, vendor docs), produce a Four-Pillars gap report grounded in OUR actual artifacts, and queue accepted ideas as GitHub issues + reflexion briefs — the self-improvement flywheel.                                                                                                                                            | -                                                                                                    | -                                                                 | read-only, write, mcp | ~850 tokens            |
| **`feature-design-assistant`** | High-density discovery and architectural design engine. Use to translate vague ideas into methodology-compliant technical specifications.                                                                                                                                                                                                                                                                                                                         | Discovers existing patterns and generates technical specs before the first line of code is written.  | High-level ideation for a new service or module.                  | read-only, write, mcp | ~800 tokens            |
| **`product-strategist`**       | High-density product strategy and roadmap auditor. Use to validate market positioning, feature prioritization, and GTM strategy against business objectives.                                                                                                                                                                                                                                                                                                      | Scans metrics and positioning to ensure current implementation work maps to high-ROI customer goals. | Auditing a proposed feature list against the core product vision. | read-only, write, mcp | ~850 tokens            |

### Specify

Design system, architecture, and technical specifications.

| Skill                         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | How it works | Use Case | Modes          | Est. Context Footprint |
| :---------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------- | :------- | :------------- | :--------------------- |
| **`solutioning-facilitator`** | Facilitates a live, multi-role "solutioning" session (PM, Design, QA, Frontend, Backend) for when a team discovers mid-flight that a feature is missing something and needs to propose, compare, and converge on a fix. Runs inside a code-connected agent (an IDE agent or the Agent Chat), anchors the session on a real user story/task, and keeps a precise, always-current running memory of every option, objection, spike, and decision so nothing is lost or re-litigated. | -            | -        | read-only      | ~800 tokens            |
| **`ui-spec-generator`**       | Architectural discovery engine for generating base skeleton UI components aligned with G-Stack modularity.                                                                                                                                                                                                                                                                                                                                                                         | -            | -        | read-only, mcp | ~850 tokens            |

### Plan

Decomposition, vertical slicing, and execution planning.

| Skill                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | How it works                                                                                                                                                                                                        | Use Case                                                                                                            | Modes                 | Est. Context Footprint |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------ | :-------------------- | :--------------------- |
| **`planning-expert`**           | The complete Planning Expert Zenith. Orchestrates deep pattern discovery, vertical slicing, and safe incremental delivery. Now PR-batch aware — it ingests vertical slices handed off from `vertical-slice-decomposer` (the `/plan` target) as well as freeform slices a developer writes by hand, caps every PR batch at <=15-20 changed files, and breaks oversized plans into forward-independent, individually deployable PRs with a blocking hand-off to `pr-automator`. Use for complex or heavy tasks, architectural refactors, multi-file features, or whenever a plan will touch more than ~15 files and must be split into stacked PRs under Trunk-Based Development. | Deep codebase audit followed by an atomic G-Stack blueprint and commit-ready task list.                                                                                                                             | Breaking down complex Jira tickets or architectural refactors into test-driven steps.                               | read-only, write, mcp | ~5900 tokens           |
| **`planning-expert-quick`**     | Ultra-lean strategic planning. Optimized for speed, token efficiency, and rapid MVC delivery. Now PR-batch aware — it ingests vertical slices handed off from `vertical-slice-decomposer` as well as freeform slices a developer writes by hand, keeps every PR batch <=15-20 changed files, and on reaching that ceiling hands off to `pr-automator` and escalates multi-batch sequencing to `planning-expert`. Use for common, lightweight tasks (1-2 files) where velocity is the priority.                                                                                                                                                                                  | Anchors tech stack followed by a condensed W/W/H blueprint and rapid execution cycle.                                                                                                                               | Common, less complex, lite-weight tasks where velocity is the priority.                                             | read-only, write, mcp | ~2300 tokens           |
| **`reflexion-loop`**            | [LOOP · DUAL-MODEL · API KEYS] ✨ SPECIAL FEATURE (not agent-agnostic — requires API keys). A self-correcting generator–critic–adjudicator loop that turns a brief into a Four-Pillars-graded implementation plan. Gemini drafts the plan, Claude grades it 0–10 on each pillar and returns ONE actionable fix, the router rewrites or stops, and Claude writes the final verdict. Runs the real two-model loop via `rtk run reflexion-loop` or the `reflexion_loop` MCP tool. Use when you want a plan hardened by an independent critic before committing engineering time. (Note: The stated token cost is per loop/run).                                                    | -                                                                                                                                                                                                                   | -                                                                                                                   | read-only, write, mcp | ~1000 tokens           |
| **`reflexion-loop-local`**      | [LOOP · LOCAL · SAME-MODEL] Fully offline model loop with same-model sequential self-critique, governed by a token and wall-clock budget.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | -                                                                                                                                                                                                                   | -                                                                                                                   | read-only, write, mcp | ~0 tokens              |
| **`reflexion-loop-sub-max`**    | [LOOP · SUB-MAX · NO API KEYS · CROSS-MODEL VERIFY] $100/mo tier context-isolated plan hardening loop. Manages multi-vendor model isolation (L0-L3) and exhaustion limits without losing work, delivering cross-model verified plans without requiring API keys. (Note: The stated token cost is per loop/run).                                                                                                                                                                                                                                                                                                                                                                 | Multi-vendor model contract, Findings Ledger, and context-firewalled critic isolation                                                                                                                               | Plan hardening on a $100/mo subscription without requiring external API keys                                        | read-only, write, mcp | ~1400 tokens           |
| **`reflexion-loop-sub-pro`**    | [LOOP · SUB-PRO · NO API KEYS · CROSS-MODEL VERIFY] $20/mo tier context-isolated loop. Single-pass cross-model plan check enforcing Mode B quota handling and mandatory disclosure without requiring API keys.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Single-pass Generator/Critic model contract, Mode B consolidate-and-park, and mandatory three-state end-state disclosure                                                                                            | Frugal single-pass plan verification on a standard ($20/mo) subscription without API keys                           | read-only, write, mcp | ~1300 tokens           |
| **`vertical-slice-decomposer`** | Decomposes one or more user stories — optionally with design screenshots or Figma URLs — into thin, independently deployable vertical slices (<=2 days) and emits ClickUp-ready tasks. Each task carries a technical-details section, a developer technical prompt, a dark-release (beta-flag) decision, and a mock-vs-real-backend decision. Built for greenfield and (primarily) brownfield features under Trunk-Based Development.                                                                                                                                                                                                                                           | Phase 0 stack + domain-boundary + design-input discovery, then a deployability-test + BDD + design-state slicing engine, a persistent Slice Ledger for multi-turn anti-drift, and a fixed Output Contract per task. | Turning brownfield/greenfield stories and designs into 2-day, dark-releasable slices under Trunk-Based Development. | read-only, write, mcp | ~2000 tokens           |

### Build

Implementation, refactoring, and feature development.

| Skill                    | Description                                                                                                                                           | How it works                                                                                                    | Use Case                                                                 | Modes                 | Est. Context Footprint |
| :----------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- | :-------------------- | :--------------------- |
| **`clean-code`**         | High-density architectural auditor. Enforces SOLID as the primary structural framework and pragmatic standards (KISS, DRY, YAGNI) for implementation. | Scans for "God Objects" and tight coupling. Recommends strategy patterns and colocation of code.                | Checking a new feature branch before merging to prevent technical debt.  | read-only, write, mcp | ~950 tokens            |
| **`regression-bug-fix`** | Unified Remediation Engine for resolving Design Review (DR), QA, and Regression feedback.                                                             | Maps feedback to code impact, generates a localized remediation plan, and verifies the fix against regressions. | Fixing "Login button misaligned" or "API returning 500" after a QA pass. | read-only, mcp        | ~1350 tokens           |

### Review

Quality assurance, code review, accessibility, and security.

| Skill                       | Description                                                                                                                                                                                                                         | How it works                                                                                                  | Use Case                                                                  | Modes                 | Est. Context Footprint |
| :-------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------ | :-------------------- | :--------------------- |
| **`accessibility-auditor`** | Specialized audit for Web Accessibility (A11y). Scans for contrast issues, missing semantics, ARIA debt, and keyboard navigation barriers. Uses static analysis (grep/read) and read-only runtime inspection — no script injection. | Static analysis via `grep`, visual scrutiny of CSS, and read-only runtime DOM inspection.                     | Ensuring WCAG 2.1 compliance and multi-viewport accessibility.            | read-only, write, mcp | ~650 tokens            |
| **`code-review-checklist`** | Lightweight Pre-Commit Review Checklist. Focuses on Spec Compliance and Rapid Verification before GitHub submission.                                                                                                                | Analyzes local diffs against 4 gates (Spec, SOLID, A11y, Evidence), ensuring zero `any` types and compliance. | Rapid local verification before running `rtk run create-pr`.              | read-only, write, mcp | ~650 tokens            |
| **`design-system-review`**  | AI-augmented design review with a strict 2-iteration guard, sequential memory persistence, and KI creation. Enforces Shadcn/Radix token alignment, layout fidelity against the Figma frame, and coordinates designer quality gates. | -                                                                                                             | -                                                                         | read-only, write, mcp | ~1400 tokens           |
| **`security-audit`**        | Cross-platform security scanner for AI Agent configurations to detect malware, prompt injection, and exfiltration.                                                                                                                  | Scans skills, scripts, and inputs for malicious patterns (`curl \| bash`, `eval()`).                          | Running on agent-generated scripts to ensure no backdoors are introduced. | read-only, mcp        | ~550 tokens            |

### Deploy

Release notes, changelogs, and environment preparation.

| Skill                       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | How it works                                                                                                                                                                  | Use Case                                                                                                     | Modes                 | Est. Context Footprint |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- | :-------------------- | :--------------------- |
| **`changelog-generator`**   | High-density semantic changelog processor. Transforms Git history into user-facing release notes.                                                                                                                                                                                                                                                                                                                                                                                                                         | Ingests `git log`, groups by semantic commit type, filters noise, and formats to Markdown.                                                                                    | Generating clean release notes for stakeholders.                                                             | read-only, write, mcp | ~750 tokens            |
| **`pr-automator`**          | Automates the creation of Pull Requests with full context. Use this skill whenever the user wants to open, draft, raise, or "PR" their current branch — including phrasings like "create a PR", "open a draft PR", "raise a pull request", or "PR this branch" — even if they don't name the skill. The skill reviews git commit history, strictly maps changes to the project's PR template, automatically applies repository labels, pushes the branch to remote if unpushed, and creates the draft PR via the gh CLI.  | Reviews commit history, populates project PR templates, automatically infers labels, and creates a draft PR via GitHub CLI.                                                   | Finalizing a feature branch into a professional, template-compliant PR.                                      | read-only, write, mcp | ~6650 tokens           |
| **`qa-handover-generator`** | Produces a QA handover + universal smoke-test criteria document for a changed feature and delivers it to ClickUp. Splits behaviour by architecture/state pattern, states the single source of truth per pattern (from real code), and emits smoke-test acceptance criteria that are both agent-ingestible (for generating formal acceptance criteria) and directly followable by a human tester. All ClickUp output is rendered through the shared clickup-format module (single source of truth for ClickUp formatting). | Performs Phase 0 G-Stack discovery of state architecture, maps components to server-driven vs client-side patterns, and renders ClickUp markup via the clickup-format module. | Generating high-fidelity QA handovers and smoke test checklists for developers and automated testing agents. | read-only, write, mcp | ~950 tokens            |

### Scale

Performance budgets, capacity planning, and optimization.

| Skill                  | Description                                                                                 | How it works                                                           | Use Case                                                           | Modes     | Est. Context Footprint |
| :--------------------- | :------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------- | :----------------------------------------------------------------- | :-------- | :--------------------- |
| **`capacity-planner`** | Evaluates production capacity and defines performance budgets for a newly deployed release. | Analyzes system architecture and load metrics against target capacity. | Planning infrastructure scale-out before a major marketing launch. | read-only | ~750 tokens            |

### Polish

Design tokens extraction and final UI refinements.

| Skill                      | Description                                                                                                                    | How it works                                                                                      | Use Case                                                                  | Modes                 | Est. Context Footprint |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------ | :-------------------- | :--------------------- |
| **`style-logic-exporter`** | Extracts design tokens and style logic from code for design-to-code alignment.                                                 | Scans style sheets and theme configurations to extract variables, colors, and typography metrics. | Syncing code-based styling with design systems or external documentation. | read-only, mcp        | ~550 tokens            |
| **`visual-verifier`**      | Performs smoke testing, captures media evidence, and compares renders against the Figma design source for any web environment. | Runs local app via Playwright and captures Desktop/Mobile screenshots for the PR body.            | Proving that a CSS fix works as intended across different viewports.      | read-only, write, mcp | ~450 tokens            |

### Maintain

Technical debt auditing, onboarding, and repo intelligence.

| Skill                                  | Description                                                                                                                                      | How it works                                                                               | Use Case                                                 | Modes                 | Est. Context Footprint |
| :------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- | :------------------------------------------------------- | :-------------------- | :--------------------- |
| **`codebase-onboarding-intelligence`** | Exhaustive discovery auditor for developer onboarding. Extracts tech stack, environment setup, and implementation patterns.                      | -                                                                                          | -                                                        | read-only, write, mcp | ~1100 tokens           |
| **`technical-debt-auditor`**           | High-density structural and technical debt scanner. Produces quantified, prioritized remediation plans based on G-Stack and MinimumCD standards. | Metrics-driven analysis combined with G-Stack methodology to prioritize refactoring tasks. | Routine codebase maintenance and pre-refactoring audits. | read-only, write, mcp | ~850 tokens            |

### Orchestrators

| Skill                       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | How it works                                                                                                                                        | Use Case                                                                                            | Modes                 | Est. Context Footprint |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- | :-------------------- | :--------------------- |
| **`dev-team-local`**        | [DEV-TEAM · LOCAL] Orchestrator for fully offline, single-lane execution.                                                                                                                                                                                                                                                                                                                                                                                                                                | -                                                                                                                                                   | -                                                                                                   | read-only, write, mcp | ~0 tokens              |
| **`dev-team-orchestrator`** | [DEV-TEAM · FULL · MCP] The flagship orchestration skill: an agent-agnostic "dev team" you manage as a technical product manager. Sizes the crew to the task, runs multiple task lanes in parallel without collision, interviews the human only at gates, and files friction defects automatically on its own repo.                                                                                                                                                                                      | -                                                                                                                                                   | -                                                                                                   | read-only, write, mcp | ~2600 tokens           |
| **`dev-team-sub-max`**      | [DEV-TEAM · SUB-MAX · NO API KEYS · CROSS-MODEL VERIFY] Subscription-tier ($100/mo) dev team orchestrator. Runs up to 2 parallel lanes with git worktrees, enforces turn budgets and quota ledger checkpoints, hardens plans via reflexion-loop-sub-max, manages multi-vendor model isolation (L0-L3) and exhaustion limits without losing work, and keeps the full visual fidelity gate intact without requiring API keys.                                                                              | Multi-vendor model contract, Quota Ledger with active model tracking, Findings Ledger, and context-firewalled reviewer isolation                    | Multi-lane parallel feature orchestration on a high-tier ($100/mo) subscription without API keys    | read-only, write, mcp | ~3100 tokens           |
| **`dev-team-sub-pro`**      | [DEV-TEAM · SUB-PRO · NO API KEYS · CROSS-MODEL VERIFY] Subscription-tier ($20/mo) dev pair orchestrator. Single-lane, branch-based execution without worktrees, enforcing turn budgets, builder/checker roles, cross-vendor model isolation, Mode B quota handling, and tier-ceiling enforcement without requiring API keys.                                                                                                                                                                            | Single-lane Builder/Checker model contract, compressed Findings Ledger, Mode B consolidate-and-park, and mandatory three-state end-state disclosure | Frugal single-lane feature orchestration on a standard ($20/mo) subscription without API keys       | read-only, write, mcp | ~2500 tokens           |
| **`feature-orchestrator`**  | The Three-Phase Engine. Orchestrates the full Research -> Plan -> Implement sequence for a single feature by chaining the specialist skills (feature-design-assistant, planning-expert / vertical-slice-decomposer, verification-auditor) into one governed loop. Runtime-aware: produces a verifiable implementation blueprint in read-only chat, and executes + verifies the implement phase in an IDE/MCP agent. Use from the feature-discovery chat to drive a change end-to-end in the sandbox app. | Chains specialist skills (design assistant, planning expert/decomposer, verification auditor) into a governed, runtime-aware loop.                  | Use from the feature-discovery chat to drive a single-feature change end-to-end in the sandbox app. | read-only, write, mcp | ~1400 tokens           |
| **`mission-architect`**     | Master Blueprint Engine. Orchestrates Strategy -> Research -> Plan -> Deliver for complex, multi-component features.                                                                                                                                                                                                                                                                                                                                                                                     | Strategic extraction from roadmaps, deep codebase audit, and multi-stage planning via `planning-expert`.                                            | Designing and executing a major architectural change or multi-file feature.                         | read-only, mcp        | ~1300 tokens           |

### Reports

| Skill                          | Description                                                                                                                               | How it works                                                                                                | Use Case                                                             | Modes            | Est. Context Footprint |
| :----------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------- | :--------------- | :--------------------- |
| **`daily-standup`**            | Analyzes local git activity and task progress to generate a comprehensive 2-day rolling standup report following a strict template.       | Categorizes commits, assess blockers, and generates a rolling report using a professional standup template. | Automating your daily update or summarizing work for a sync meeting. | read-only, mcp   | ~550 tokens            |
| **`weekly-leadership-report`** | Extracts technical progress from Git history and ClickUp sprints using browser automation to synthesize high-fidelity leadership reports. | -                                                                                                           | -                                                                    | read-only, write | ~1200 tokens           |

### Internal Skills

| Skill                        | Description                                                                                                                                      | Modes                 | Est. Context Footprint |
| :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- | :--------------------- |
| **`agent-optimizer`**        | Precision tool for Token-Efficiency, Context Density Management, and Noise Reduction. Enforces the RTK (Rust Token Killer) methodology.          | read-only, write, mcp | ~550 tokens            |
| **`Dummy Skill`**            | A dummy skill for testing purposes.                                                                                                              | read-only, mcp        | ~50 tokens             |
| **`knowledge-manager`**      | Manage project-specific knowledge items to maintain persistent context and architectural memory.                                                 | read-only, write, mcp | ~450 tokens            |
| **`mission-control`**        | High-integrity pre-flight diagnostic to verify environment, tools, and skill dependencies.                                                       | read-only, write, mcp | ~650 tokens            |
| **`operational-boundaries`** | Global behavioral guardrails to prevent agent deviation and context hijacking.                                                                   | read-only, mcp        | ~400 tokens            |
| **`verification-auditor`**   | Internal support logic for verifying local environments and evidence capture. Security, Performance, and Accessibility with "Extreme Prejudice." | read-only, mcp        | ~1500 tokens           |

<!-- SKILLS_TABLE:END -->

> [!NOTE] **Est. Context Footprint**
>
> The token estimations represent the **base prompt size** of the skill itself.
> When the MCP server injects the skill into your LLM’s context window, it
> consumes this base amount.

## 🧠 The Methodology: Four Pillars

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

### Production-Grade Ethos

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

> [!NOTE] **🧭 The Three-Phase Engine** The **Feature Orchestrator** governs a
> single feature's lifecycle through a disciplined three-phase loop:
>
> 1. **Research (Research Phase)**: Prototypes domain models, data structures,
>    and contract boundaries using `feature-design-assistant` (optionally
>    chaining `ui-spec-generator` and `design-system-review` when design inputs
>    are available).
> 2. **Plan (Planning Phase)**: Decomposes the requirements into thin,
>    independently deployable vertical slices using `vertical-slice-decomposer`
>    (or `planning-expert` for backend/architectural tasks).
> 3. **Implement (Implementation Phase)**: Sandbox execution and continuous
>    verification using `verification-auditor` and `regression-bug-fix` to
>    ensure that every slice satisfies all compilation, type-safety, and visual
>    design requirements.

### ✨ Special Feature: The Reflexion Loop

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

## 🛠 Technical Architecture: RTK & MCP Synergy

To maintain high performance and auditability, the Tech-Lead Stack uses a
dual-layered architecture:

### 1. The Human-CLI Registry (`package.json`)

The `rtk.tools` section in `package.json` acts as the **Single Source of Truth**
for tool execution.

- **The Human Side**: When you run `rtk run <tool>`, the
  [rtk-run.sh](scripts/rtk-run.sh) script specifically looks for that key in
  your local (or linked) `package.json`.
- **The Synergy**: This ensures that even if you aren't using an AI agent, you
  can manually audit or trigger any skill logic via the terminal. It guarantees
  that the Agent and the Human are always working from the same operational
  registry.

### 2. The Agent-Knowledge Broker (MCP Server)

The **MCP Server** serves as the **Intelligence Layer** for your IDE.

- **Skill Discovery**: The server dynamically reads `.ai/skills/*.md` files and
  exposes them as tools. It uses the `internal: true` flag to hide support-only
  skills from primary discovery while keeping them available for implementation.
- **Telemetry & Metrics**: Unlike the CLI, executions via the MCP are
  instrumented via **Langfuse**. This captures token usage, project attribution,
  and agentic decision-making for enterprise-grade analytics.

### 3. Agent Skills vs. Dev Workflows

| Category          | Storage              | Purpose                                                                                   |
| :---------------- | :------------------- | :---------------------------------------------------------------------------------------- |
| **Agent Skills**  | `.ai/skills/`        | **Core Brains**: High-density instructions for the AI. Some are "Internal" support logic. |
| **Dev Workflows** | `.agents/workflows/` | **User Orchestrations**: Antigravity `/slash` commands or manual starting prompts.        |

## 🛠 Technical Overview: Skill Discovery & Priority

To maintain **User Sovereignty** and ensure **Context Hygiene**, the Tech-Lead
Stack does not simply read static files. Access to all skills is brokered
through the **MCP Server**, which enforces a strict priority of discovery:

1.  **Project-Local Override**: `.ai/skills/` in your current working directory.
2.  **Global Fallback**: `.ai/skills/` in the `tech-lead-stack` repository.

### Why Go Through the MCP?

- **Customization**: Teams can "fork" a skill for a specific project without
  modifying the global repository.
- **Auditability**: Every skill retrieval is wrapped in a **Langfuse Trace**
  (Telemetry) to track which model, agent, and project are executing specific
  logic.
- **Cost Control**: The server captures and reports the "Budgeted Cost" of each
  skill to prevent uncontrolled LLM spend.

### Priority Logic Snippet:

```typescript
// src/mcp-server/fs-service.ts

async readSkill(safeSkillName: string) {
  // Define Search Paths: Local Project has priority over Global Repo
  const localSkillsDir = path.join(process.cwd(), ".ai/skills");
  const searchDirs = [localSkillsDir, this.repoSkillsDir];

  for (const dir of searchDirs) {
    const skillPath = path.join(dir, `${safeSkillName}.md`);
    try {
      // Returns the first match found (Local Override logic)
      const content = await fs.readFile(skillPath, "utf-8");
      return { content, path: skillPath };
    } catch {
      // Continue to Fallback
    }
  }
}
```

## How to use in any project

### 3. Usage Options

#### Option A: The "Context Injection" (Universal)

If using a web-based agent (Claude.ai, ChatGPT) or starting a fresh session
without workspace access:

> "Analyze the skills in /path/to/lead-stack/.ai/skills/. You are now a Tech
> Lead Agent equipped with these workflows. Use `rtk run <tool>` for all tool
> executions."

#### Option B: The Symlink (Best for Antigravity/Cursor/Continue/Claude Code)

Since lead-init has already linked the instructions to your project, simply
prompt the agent in your workspace:

"Read the instructions in .ai/agents.md and follow the planning-expert workflow
for this ticket."

**Cursor:** use `install.sh --link . --ide cursor` (or `lead-init-cursor` above)
so the same skills appear under your user **`~/.cursor/skills/`** as symlinks
into this repo. Your app repository does not get a `.cursor/` folder from this
step. Invoke skills from Cursor’s skills UI (or the slash menu) like Antigravity
workflows.

**Continue:** use `install.sh --link . --ide continue` (or `lead-init-continue`
above). This globally configures `~/.continue/config.yaml` to include the
`tech-lead-stack` MCP server and exposes the stack's workflows as Continue slash
commands. Note: OSS Continue is frozen at v2.0.0 (Cursor acquisition). For a
maintained local-first alternative, consider Cline.

## Branching Strategy

This repository enforces **Trunk Based Development** with a rebase-first
workflow and squash-and-merge PRs.

For detailed day-to-day workflow examples and guidelines for both developers and
AI agents, please refer to the
[Branch Management Strategy](./BRANCH_MANAGEMENT.md) document.

## Requirements

- **RTK (Runtime Toolkit)**:
  `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh`
- **GitHub CLI (gh)**: Required for automated PR management.
- **Browsers (Playwright)**: `npx playwright install chromium`
- **Python Deps**: `pip install python-dotenv playwright`
- **System**: Access to your local Chrome User Data Directory.

* **Firecrawl API**: (Optional) For the `planning-expert` to read external
  links.

## 🧹 Resetting a Project

# Tech-Lead Stack Cleanup Alias

```bash

# Add this to your ~/.zshrc
alias lead-clean='bash /path/to/tech-lead-stack/scripts/cleanup.sh .'

```

If you want to remove the AI workflows and symlinks from a repository:

```bash

lead-clean

```

## 🧪 CI/CD

This repository uses **GitHub Actions** to validate:

1. **Skill Integrity**: Ensures all `.md` files in `.ai/skills/` have valid YAML
   frontmatter.
2. **Markdown Linting**: Prevents malformed instructions that could confuse
   agents.
3. **Script Permissions**: Ensures all tools in `scripts/` remain executable.

### Pro-Tip: The "Profile Locked" Error

If you get an error that the browser profile is "already in use," close your
active Chrome window or create a dedicated Profile for the Agent and update your
`.env` accordingly.

```bash

tech-lead-stack/
├── .ai/
│   ├── agents.md
│   └── skills/
│       ├── agent-optimizer.md
│       ├── code-review-checklist.md
│       ├── mission-architect.md
│       ├── planning-expert.md
│       ├── regression-bug-fix.md
│       ├── verification-auditor.md (Internal)
│       └── visual-verifier.md
├── .github/
│   └── workflows/
│       └── agent-ci.yml
├── scripts/
│   ├── autoeval-check.js
│   ├── cleanup.sh
│   ├── gh-pr-create.sh
│   └── upload-evidence.py
├── templates/
│   └── PULL_REQUEST_TEMPLATE.md
├── .env
├── .env.example
├── .gitignore
├── ONBOARDING.md
├── install.sh
├── package.json
├── README.md
└── requirements.txt

```

## Resources 📚

### Methodology

- [Agent Skills (Addy Osmani)](https://github.com/addyosmani/agent-skills)
- [MinimumCD Team Chatbot](https://beyond.minimumcd.org/docs/team-chatbot/)
- [MinimumCD Core Docs](https://minimumcd.org/)
- [MinimumCD Vertical Slicing](https://beyond.minimumcd.org/docs/)
- [G-Stack (Garry Tan)](https://github.com/garrytan/gstack)
- [Modern Web Guidance (GoogleChrome)](https://github.com/GoogleChrome/modern-web-guidance-src)
- [AI Broke Your Code Review](https://bryanfinster.substack.com/p/ai-broke-your-code-review-heres-how)
- [Migration to MinimumCD](https://migration.minimumcd.org/docs/reference/practices/continuous-integration/)
- [Agents.md Specification](https://agents.md/)
- [Substack: Managing AI Dev Teams](https://substack.com/home/post/p-187289110)

### Tooling

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [RTK (Runtime Toolkit)](https://github.com/rtk-ai/rtk)
- [Langfuse (Telemetry)](https://langfuse.com/)
- [Playwright (Visual Verifier)](https://playwright.dev/)
- [GitHub CLI (gh)](https://cli.github.com/)
- [Autoevals](https://www.npmjs.com/package/autoevals)
- [Pezzo](https://github.com/pezzolabs/pezzo)
- [Agentic Dev Team](https://github.com/bdfinst/agentic-dev-team?tab=readme-ov-file#review-agents)
- [Skills.sh](https://skills.sh/)
- [Claude SEO Skills](https://github.com/AgriciDaniel/claude-seo)
- [Interface Design Skills](https://skills.sh/dammyjay93/interface-design/interface-design)
- [Firecrawl Repositories](https://github.com/orgs/firecrawl/repositories?q=sort%3Astars)

### IDE & Agent Surfaces

- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Cursor Documentation](https://docs.cursor.com/)
- [Continue Documentation](https://docs.continue.dev/)

---

Questions or feature requests?
[Open an issue or join the discussion on GitHub](https://github.com/bronz3beard/tech-lead-stack/issues).
