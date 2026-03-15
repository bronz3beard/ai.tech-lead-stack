# The Lead Stack: Agent-Ambiguous Workflows

A high-performance repository of "Skills" and RTK-powered tools designed for
Tech Leads. These workflows are **Agent-Ambiguous**, allowing any LLM agent
(Gemini, Claude, GPT) to assist with implementation planning, code review, and
automated testing.

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
