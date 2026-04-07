# The Lead Stack: Agent-Ambiguous Workflows

A high-performance repository of "Skills" and RTK-powered tools designed for
Tech Leads. These workflows are **Agent-Ambiguous**, allowing any LLM agent
(Gemini, Claude, GPT) to assist with implementation planning, code review, and
automated testing.

## Table of Contents

- [🚀 Quick Start](#-quick-start)
- [How to use in any project](#how-to-use-in-any-project)
- [Antigravity Setup](#antigravity-setup)
- [Cursor Setup](#cursor-setup)
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

## 🧠 The G-Stack Methodology

The "Tech-Lead Stack" is built upon the **G-Stack Methodology**, a
technology-agnostic engineering framework inspired by the **garrytan/gstack**
ethos and **MinimumCD** principles.

### Core Tenets:

1. **Diagnosis before Advice**: Every skill begins with a **Tech-Stack Discovery
   (Phase 0)** phase. The agent must understand the project's language,
   framework, and constraints (by inspecting `package.json`, `pyproject.toml`,
   `csproj`, etc.) before proposing a plan.
2. **User Sovereignty**: The AI provides high-fidelity recommendations, but the
   human is the final decision-maker. We favor "AI Recommends, User Decides"
   over black-box automation.
3. **MinimumCD Alignment**: We prioritize small, atomic batches of work (<100
   lines per task), continuous automated verification, and early detection of
   regression risks.
4. **Clean Context & RTK Execution**: We use dedicated RTK tools to maintain
   "Context Hygiene" and ensure every action is repeatable and auditable.

> [!NOTE] **G-Stack is a Methodology, not a Stack**: While the name implies a
> specific technology set, the Tech-Lead Stack treats "G-Stack" as an
> engineering philosophy centered on modularity, diagnosis-first planning, and
> robust verification. It is designed to work seamlessly with C#, Python,
> JavaScript, Java, Go, and any other ecosystem.

---

## How to use in any project

### 3. Usage Options

#### Option A: The "Context Injection" (Universal)

If using a web-based agent (Claude.ai, ChatGPT) or starting a fresh session
without workspace access:

> "Analyze the skills in /path/to/lead-stack/.ai/skills/. You are now a Tech
> Lead Agent equipped with these workflows. Use ./.ai/rtk-run run <tool> for all
> tool executions."

#### Option B: The Symlink (Best for Antigravity/Cursor/Claude Code)

Since lead-init has already linked the instructions to your project, simply
prompt the agent in your workspace:

"Read the instructions in .ai/agents.md and follow the planning-expert workflow
for this ticket."

**Cursor:** use `install.sh --link . --ide cursor` (or `lead-init-cursor` above)
so the same skills appear under your user **`~/.cursor/skills/`** as symlinks
into this repo. Your app repository does not get a `.cursor/` folder from this
step. Invoke skills from Cursor’s skills UI (or the slash menu) like Antigravity
workflows.

---

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
- https://github.com/bdfinst/agentic-dev-team?tab=readme-ov-file#review-agents

---

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

---

## Available Skills, what they do, how they do it , and what they cost

## Available Skills, what they do, how they do it , and what they cost

| Skill                          | Description                                                                                         | How it works                                                                                                    | Use Case                                                                                       | Est. Context Footprint |
| :----------------------------- | :-------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- | :--------------------- |
| **`mission-architect`**        | Master Blueprint Engine. Orchestrates Strategy -> Research -> Plan -> Deliver for complex features. | Strategic extraction from roadmaps, deep codebase audit, and multi-stage planning via `planning-expert`.        | Designing and executing a major architectural change or multi-file feature.                    | ~1300 tokens           |
| **`planning-expert`**          | Lightweight Research, Strategic Planning, and Task Decomposition for daily coding tasks.            | Rapid codebase scan followed by an atomic G-Stack blueprint and commit-ready task list.                         | Breaking down a standard Jira ticket or bug fix into test-driven steps.                        | ~550 tokens            |
| **`regression-bug-fix`**       | Unified remediation engine for resolving QA, Design Review (DR), and Regression feedback.           | Maps feedback to code impact, generates a localized remediation plan, and verifies the fix against regressions. | Fixing "Login button misaligned" or "API returning 500" after a QA pass.                       | ~1350 tokens           |
| **`code-review-checklist`**    | High-density pre-commit quality auditor for verifying functionality and G-Stack standards.          | Analyzes local diffs against 3 gates (Spec, SOLID, A11y), ensuring zero `any` types and strict compliance.      | Rapid local verification before running `./.ai/rtk-run run create-pr`.                         | ~650 tokens            |
| **`agent-optimizer`**          | Precision tool for maintaining maximum Token-Efficiency and Context Density.                        | Enforces `./.ai/rtk-run` wrappers and maintains context hygiene to ensure peak agent performance.               | Optimizing your active session when context becomes noisy or token usage spans multiple files. | ~550 tokens            |
| **`clean-code`**               | Architectural auditor enforcing SOLID principles and programmatic standards (KISS, DRY, YAGNI).     | Scans for "God Objects" and tight coupling. Recommends strategy patterns and colocation of code.                | Checking a new feature branch before merging to prevent technical debt.                        | ~950 tokens            |
| **`security-audit`**           | Cross-platform security scanner detecting malware, prompt injection, and exfiltration.              | Scans skills, scripts, and inputs for malicious patterns (`curl \| bash`, `eval()`).                            | Running on agent-generated scripts to ensure no backdoors are introduced.                      | ~550 tokens            |
| **`pr-automator`**             | Automates G-Stack Pull Requests with synthesized diffs and verification evidence.                   | Fetches visual proof (screenshots) and maps code changes to the original Strategic Mission.                     | Finalizing a feature branch into a professional, evidence-backed PR.                           | ~950 tokens            |
| **`visual-verifier`**          | Captures before/after screen evidence for visual smoke testing.                                     | Runs local app via Playwright and captures Desktop/Mobile screenshots for the PR body.                          | Proving that a CSS fix works as intended across different viewports.                           | ~450 tokens            |
| **`changelog-generator`**      | Transforms Git history into user-facing release notes with strict noise filtering.                  | Ingests `git log`, groups by semantic commit type, filters noise, and formats to Markdown.                      | Generating clean release notes for stakeholders.                                               | ~750 tokens            |
| **`daily-standup`**            | Generates a daily status update by analyzing 48h of git activity and task progress.                 | Categorizes commits, assess blockers, and generates a rolling report using a professional standup template.     | Automating your daily update or summarizing work for a sync meeting.                           | ~550 tokens            |
| **`product-strategist`**       | Strategic roadmap auditor validating market positioning and Impact vs. Effort.                      | Scans metrics and positioning to ensure current implementation work maps to high-ROI customer goals.            | Auditing a proposed feature list against the core product vision.                              | ~850 tokens            |
| **`feature-design-assistant`** | Architectural discovery engine for pre-implementation prototyping.                                  | Discovers existing patterns and generates technical specs before the first line of code is written.             | High-level ideation for a new service or module.                                               | ~800 tokens            |

> [!NOTE] The **Est. Context Footprint** listed above refers to the budgeted
> tokens required to load the skill's instructions into the agent's context.
> Live execution costs may vary depending on the LLM model and project size, but
> are tracked accurately via Langfuse telemetry to provide baseline reliability
> across the entire developer workforce.
