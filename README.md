# The Lead Stack: Agent-Ambiguous Workflows

A high-performance repository of "Skills" and RTK-powered tools designed for
Tech Leads. These workflows are **Agent-Ambiguous**, allowing any LLM agent
(Gemini, Claude, GPT) to assist with implementation planning, code review, and
automated testing.

## Table of Contents

- [🚀 Quick Start](#-quick-start)
- [How to use in any project](#how-to-use-in-any-project)
- [🧹 Resetting a Project](#-resetting-a-project)
- [🧪 CI/CD](#-cicd)
- [Resources 📚](#resources-)
- [Available Skills, what they do, how they do it , and what they cost](#available-skills-what-they-do-how-they-do-it--and-what-they-cost)

> [!IMPORTANT] This stack and its associated skills are currently **only
> configured for macOS and Linux**. Windows users should use WSL2 for full
> compatibility.

### Running Agent Tasks

This stack includes a helper script to run agent-specific tasks defined in
`package.json`.

1. **Set the alias** (one-time per session):

   ```bash
   alias rtk="$(pwd)/scripts/rtk-run.sh"
   ```

2. **Run a task**:
   ```bash
   rtk run mission-control
   rtk list
   ```

## Requirements

- **RTK (Runtime Toolkit)**:
  `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh`
- **GitHub CLI (gh)**: Required for automated PR management.
- **Browsers (Playwright)**: `npx playwright install chromium`
- **Python Deps**: `pip install python-dotenv playwright`
- **System**: Access to your local Chrome User Data Directory.

* **Firecrawl API**: (Optional) For the `planning-expert` to read external
  links.

---

## 🚀 Quick Start

### 1. Installation

Clone this repo and link it globally for easy access:

```bash

# Add this to your ~/.zshrc
alias lead-init='bash /path/to/tech-lead-stack/install.sh --link .'

# Cursor: register skills globally (~/.cursor/skills/) without touching your app repo
alias lead-init-cursor='bash /path/to/tech-lead-stack/install.sh --link . --ide cursor'

```

### 2. Initialize a Project

Navigate to any repository you want to automate and run the new alias:

```bash

lead-init

```

### 🛠 Final Checklist

1. **Permissions**: Run `chmod +x scripts/cleanup.sh` in your toolbox repo.
2. **Execution**: You can now run `lead-init` to build it and `lead-clean` to
   tear it down.
3. **Mission Control**: Your `lead-init` will now automatically run a pre-flight
   check to make sure you didn't miss a step.

---

## How to use in any project

### 3. Usage Options

#### Option A: The "Context Injection" (Universal)

If using a web-based agent (Claude.ai, ChatGPT) or starting a fresh session
without workspace access:

> "Analyze the skills in /path/to/lead-stack/.ai/skills/. You are now a Tech
> Lead Agent equipped with these workflows. Use rtk for all tool executions."

#### Option B: The Symlink (Best for Antigravity/Cursor/Claude Code)

Since lead-init has already linked the instructions to your project, simply
prompt the agent in your workspace:

"Read the instructions in .ai/agents.md and follow the planning-expert workflow
for this ticket."

**Cursor:** use `install.sh --link . --ide cursor` (or `lead-init-cursor` above) so
the same skills appear under your user **`~/.cursor/skills/`** as symlinks into
this repo. Your app repository does not get a `.cursor/` folder from this step.
Invoke skills from Cursor’s skills UI (or the slash menu) like Antigravity workflows.

---

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

---

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
│       ├── daily-standup.md
│       ├── dr-remediation.md
│       ├── mission-control.md
│       ├── planning-expert.md
│       ├── pr-automator.md
│       ├── qa-remediation.md
│       ├── quality-gatekeeper.md
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

- https://skills.sh/
- https://github.com/AgriciDaniel/claude-seo
- https://skills.sh/dammyjay93/interface-design/interface-design
- https://github.com/orgs/firecrawl/repositories?q=sort%3Astars
- https://www.npmjs.com/package/autoevals
- https://github.com/pezzolabs/pezzo
- https://beyond.minimumcd.org/docs/team-chatbot/
- https://substack.com/home/post/p-187289110
- https://github.com/garrytan/gstack
- https://bryanfinster.substack.com/p/ai-broke-your-code-review-heres-how
- https://migration.minimumcd.org/docs/reference/practices/continuous-integration/
- https://agents.md/

---

## Available Skills, what they do, how they do it , and what they cost

| Skill                                  | Description                                                                                                                                                             | How it works                                                                                                                                    | Use Case                                                                                                                                                       | Token Cost  |
| :------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| **`changelog-generator`**              | Transforms Git history into user-facing release notes with strict noise filtering.                                                                                      | Ingests `git log`, groups by semantic commit type, filters noise, translates jargon, and formats to a Markdown template.                        | Automatically generating release notes before deployment.                                                                                                      | ~670 tokens |
| **`clean-code`**                       | Architectural auditor enforcing SOLID principles and pragmatic standards (KISS, DRY, YAGNI).                                                                            | Scans for "God Objects" and tight coupling. Recommends strategy patterns and colocation of code.                                                | Checking a new feature branch before merging to prevent technical debt.                                                                                        | ~880 tokens |
| **`code-review-checklist`**            | High-density code review auditor verifying functionality, security, performance, and G-Stack standards.                                                                 | Analyzes PR diffs against 5 gates (strategic alignment, security, SOLID, performance, tests), outputting a strict pass/fail.                    | Acting as the ultimate automated PR reviewer to block untested merges, great for local instant PR feedback before submitting the PR to github.                 | ~840 tokens |
| **`codebase-onboarding-intelligence`** | Exhaustive discovery auditor for developer onboarding, extracting tech stack and patterns.                                                                              | Scans `.env.example`, `package.json`, `src/`, and `.github/workflows` to map out local vitals.                                                  | Bringing a new developer or agent up to speed on a massive codebase instantly.                                                                                 | ~960 tokens |
| **`daily-standup`**                    | Analyzes local git activity and task progress to generate a daily status update.                                                                                        | Runs `git log` for the last 2 days, categorizes commits, filters trivial noise, and assesses blockers.                                          | Generating a comprehensive 2-day rolling standup report following a strict template.                                                                           | ~500 tokens |
| **`dr-remediation`**                   | Orchestrates UI/UX and Frontend updates based on Design Review feedback.                                                                                                | Categorizes feedback, enforces design token integrity (Tailwind), and triggers `visual-verifier` for visual proof.                              | Fixing layout shifts or color contrast issues flagged by a designer.                                                                                           | ~780 tokens |
| **`feature-design-assistant`**         | Discovery and architectural design engine translating ideas into technical specifications.                                                                              | Discovers existing components, extracts core requirements, and presents architectural options.                                                  | Designing schema, logic, and test strategy for a new feature before coding.                                                                                    | ~700 tokens |
| **`mission-control`**                  | High-integrity pre-flight diagnostic to verify environment, tools, and dependencies.                                                                                    | Validates `.env`, `gh auth`, parses `.ai/skills`, and verifies RTK tool mappings.                                                               | in general only useful to run after intalation and then never again, Running `lead-init` to ensure a workspace is ready for an AI agent to operate.            | ~615 tokens |
| **`planning-expert`**                  | Converts task descriptions into G-Stack optimized implementation plans.                                                                                                 | Ingests tickets, maps schema/logic changes, enforces regression testing, and outputs a plan.                                                    | This is probably going to be the most frequently used skill in this collection. Breaking down a task/ticket into atomic, test-driven steps for a coding agent. | ~475 tokens |
| **`pr-automator`**                     | Automates the creation of GitHub Pull Requests using the pr template if available, with full context.                                                                   | Discovers base branch, synthesizes diffs into a summary, fetches visual proof, and runs `gh pr create`.                                         | Wrapping up a completed feature branch into a professional PR.                                                                                                 | ~875 tokens |
| **`product-strategist`**               | Product strategy and roadmap auditor validating market positioning and prioritization.                                                                                  | Scans metrics, evaluates Impact vs. Effort, and enforces GTM launch readiness.                                                                  | Auditing a roadmap to eliminate low-ROI features and ensure customer alignment.                                                                                | ~750 tokens |
| **`qa-remediation`**                   | Orchestration for resolving QA feedback using G-Stack and MinimumCD principles.                                                                                         | Ingests QA bugs, demands an atomic fix with tests, and forces a visual proof loop.                                                              | Resolving a "login button broken" bug with code fixes, tests, and screenshots.                                                                                 | ~730 tokens |
| **`quality-gatekeeper`**               | AI-driven code review with extreme prejudice focusing on architecture and security.                                                                                     | Detects architectural drift, enforces atomic commits, scans for mundane errors, and requires tests.                                             | Serving as a strict CI step to reject spaghetti code before it reaches `main`.                                                                                 | ~650 tokens |
| **`security-audit`**                   | Cross-platform security scanner detecting malware, prompt injection, and exfiltration.                                                                                  | Scans skills, scripts, and inputs for malicious patterns (`curl \| bash`, `eval()`).                                                            | Running on agent-generated scripts to ensure no backdoors are introduced.                                                                                      | ~495 tokens |
| **`strategy-to-execution`**            | Orchestrator translating Product Strategy into Implementation Plans.                                                                                                    | Extracts Unique Value Propositions, triggers planning, runs security audit, and initializes PR.                                                 | Bridging high-level business goals directly to specific database/API tickets.                                                                                  | ~420 tokens |
| **`technical-debt-auditor`**           | High-density structural and technical debt scanner.                                                                                                                     | Scans for dead code, calculates complexity, checks dependencies, and outputs remediation plan.                                                  | Performing a repo health scan to generate quick-win cleanup tasks.                                                                                             | ~760 tokens |
| **`technical-task-planner`**           | Expert technical task decomposition for developers. Transforms high-level requirements into granular, G-Stack/MinimumCD compliant ClickUp tasks with database analysis. | Ingests context, performs structural analysis, creates logical task batches, details subtasks, and generates high-density AI execution prompts. | Detailed technical task decomposition and ClickUp planning.                                                                                                    | ~925 tokens |
| **`visual-verifier`**                  | Performs smoke testing and uploads media evidence to tracking systems.                                                                                                  | Runs local app, takes precise Desktop/Mobile screenshots, and uploads evidence URLs.                                                            | Automatically capturing before/after screenshots of a CSS fix for a PR.                                                                                        | ~375 tokens |
