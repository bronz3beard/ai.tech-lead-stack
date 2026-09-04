# Team Onboarding Guide: The Lead Stack 🤖

<!-- ECOSYSTEM-LINK:START -->

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

<!-- ECOSYSTEM-LINK:END -->

Welcome to our automated engineering workflows! This guide will help you set up
and use the custom agent skills we've developed.

The "Lead Stack" is a set of modular **agent skills** designed to enhance your
day-to-day processes, automate repetitive tasks, and uplevel overall engineering
quality. These skills are built to be **Tech-Stack Agnostic** and
**Agent-Agnostic**, meaning they adapt to your project's specific language (C#,
Python, JS, etc.) and work with various large language model agents.

## 🧠 The Methodology: Four Pillars

The "Lead Stack" is built upon four foundational pillars of modern engineering
excellence:

1.  **G-Stack (Modularity & Diagnosis-First)**: Inspired by the
    [garrytan/gstack](https://github.com/garrytan/gstack) philosophy, this
    pillar mandates **Diagnosis before Advice**. Every skill begins with **Phase
    0: Tech-Stack Discovery**. Agents must understand the project's language,
    framework, and constraints before proposing a single line of code.
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
    - **Process over Prose**: Skills are structured workflows (not vague advice)
      with specific verification gates.
    - **Anti-Rationalization**: It uses documented rebuttals to combat common AI
      excuses (e.g., "I'll add tests later" or "The fix seems right").
    - **Verification is Non-Negotiable**: Every task must end with hard evidence
      (tests, logs, or screenshots). "Seems right" is never an acceptable exit
      criterion.
4.  **Modern Web Guidance**: Based on
    [GoogleChrome/modern-web-guidance-src](https://github.com/GoogleChrome/modern-web-guidance-src),
    this pillar helps coding agents build better web applications using modern,
    high-performance, accessible, and secure APIs instead of legacy workarounds.

---

## 🚀 Setup & Prerequisites

Before you can use these skills, ensure your development environment is
prepared.

### 1. Configure Your Agent

You'll need access to a reasoning-capable agent or AI IDE. Follow the specific
setup instructions for your chosen tool.

### 2. Install Skill Files

The skill files define the automated workflows. For project-specific skills, you
should have an `.ai/skills/` directory in your project root.

#### Cursor

If you use **Cursor**, run the stack installer with **`--ide cursor`** so skills
are registered **globally** under `~/.cursor/skills/`. Your app repository does
not get a `.cursor/` folder. Example:

```bash
/path/to/tech-lead-stack/install.sh --link . --ide cursor
```

The installer also merges the **tech-lead-stack** MCP server into
**`~/.cursor/mcp.json`**.

**Updating an Existing Installation:** If you are pulling new updates for the
`tech-lead-stack`, you don't need to re-run `install.sh` across your projects.
Just update the MCP server bundle by running the following in the
`tech-lead-stack` root directory:

```bash
pnpm install
pnpm run mcp:build
```

The current skills available in the toolbox are:

- **`planning-expert`**
- **`code-review-checklist`**
- **`pr-automator`**
- **`visual-verifier`**
- **`mission-architect`**
- **`clean-code`**
- **`dev-team-orchestrator`**
- **`security-audit`**

### 3. Setup External Integrations

Our automated workflows integrate with several third-party services. Ensure you
have properly configured access for:

- **GitHub:** Agent needs permissions for PRs and analysis. High-density PRs use
  the `gh` CLI.
- **ClickUp:** For bug tracking, the `visual-verifier` skill can post media
  evidence.

---

## 🛠️ How to Use

Invoke a skill by referring to its name or calling the specific MCP tool.

### Core Workflow Principle: "Diagnosis before Advice"

Every skill begins with a **Phase 0: Tech-Stack Discovery**. The agent will
automatically inspect your project root (`package.json`, `csproj`, etc.) to
understand your specific ecosystem before providing recommendations.

### Activating a Specific Workflow

Refer to the skill name in your prompt or use the slash menu in supported IDEs.

---

## 🔄 Lifecycle Model & Pipelines

The agent toolbox is organized around a strict **9-Phase Lifecycle**:

1. **Intent**: Strategic alignment, market analysis, and product requirements.
2. **Specify**: Design system, architecture, and technical specifications.
3. **Plan**: Decomposition, vertical slicing, and execution planning.
4. **Build**: Implementation, refactoring, and feature development.
5. **Review**: Quality assurance, code review, accessibility, and security.
6. **Deploy**: Release notes, changelogs, and environment preparation.
7. **Scale**: Performance budgets, capacity planning, and optimization.
8. **Polish**: Design tokens extraction and final UI refinements.
9. **Maintain**: Technical debt auditing, onboarding, and repo intelligence.

> [!TIP] **Phase Cost & Rework**: In the Global Dashboard's "Cost & time by
> phase" panel, a phase with disproportionate rework cost is the signal to
> revisit its boundary/ownership. This panel is the iteration backlog.

### Ownership Axis & Artifact Contracts

Each skill operates under strict **artifact contracts** (`consumes` and
`emits`). A skill cannot run unless its required upstream artifacts (e.g.,
`intent-brief`, `plan`, `diff`) have been generated. Skills also declare their
**ownership axis**:

- **Drive**: Who drives the execution (`human`, `ai`, or `human-ai`).
- **Approve**: Who approves the final output (`human`, `ai`, or `none`).

### The `plan_pipeline` Tool

You can use the `plan_pipeline` MCP tool to automatically construct a valid
chain of skills from your intent to your goal. The tool will read the skill
graph and propose a pipeline that satisfies all artifact constraints.

**Example**:

```json
{
  "goalPhase": "build",
  "startPhase": "intent",
  "context": "We need to build a new authentication flow starting from a basic product requirement."
}
```

The tool will return an orchestrated path (e.g., `feature-design-assistant`
[Intent] -> `solutioning-facilitator` [Specify] -> `planning-expert` [Plan] ->
`clean-code` [Build]) ensuring all `consumes`/`emits` contracts are met.

---

## 📝 Workflow 1: Implementation & Bug Planning

### The Goal

Transform a task description into a structured, ecosystem-native plan.

### How to Trigger

- "Create a resolution plan using the `planning-expert` skill."
- "Analyze this ticket description and provide a G-Stack compliant plan."

### What to Expect

The agent identifies the root cause, describes the fix, and identifies
regression risks. All plans include **MinimumCD** automated test strategies.

---

## 🔍 Workflow 2: Pre-PR Quality Gatekeeper

### The Goal

Perform a high-density code review before creating a pull request.

### How to Trigger

- "Review my implementation using the `code-review-checklist` skill."
- "Run quality-gatekeeper on my current changes."

### What to Expect

The agent analyzes your `git diff` for architectural alignment, scalability, and
ecosystem-specific best practices. Output includes:

- ✅ Passes
- ⚠️ Suggestions
- 🛑 Blockers

---

## 📇 Workflow 3: PR Template Automation

### The Goal

Automatically summarize commits into a standardized PR template.

### How to Trigger

- "Draft a PR using the `pr-automator` skill."

### What to Expect

The agent reads your `git log` and maps changes to the appropriate sections in
our PR template (Features, Fixes, Breaking Changes).

---

## 📸 Workflow 4: Visual Verification & Smoke Testing

### The Goal

Automate visual confirmation on desktop and mobile viewports.

### How to Trigger

- "Run the `visual-verifier` skill on the current feature."

### What to Expect

The agent executes browser capture (via `rtk run visual-verifier`) and saves
evidence to `.github/evidence/`. If configured, it posts to ClickUp or GitHub
PRs.

---

## 🛠️ Troubleshooting

- **Error while analyzing directory .agents**: This is expected if the project
  hasn't been initialized. Run the `/init` workflow.
- **Wrong detected ecosystem**: Ensure your root configuration files are
  accessible in the agent's context.

Happy automating!
