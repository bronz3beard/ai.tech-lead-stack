# Team Onboarding Guide: The Lead Stack 🤖

Welcome to our automated engineering workflows! This guide will help you set up
and use the custom agent skills we've developed.

The "Lead Stack" is a set of modular **agent skills** designed to enhance your
day-to-day processes, automate repetitive tasks, and uplevel overall engineering
quality. These skills are built to be **Tech-Stack Agnostic** and
**Agent-Ambiguous**, meaning they adapt to your project's specific language (C#,
Python, JS, etc.) and work with various large language model agents like
**Google Antigravity**, **Claude Code**, or **Cursor**.

By leveraging these workflows, we follow the **G-Stack Methodology** — a
framework inspired by the **garrytan/gstack** ethos and **MinimumCD**
principles, focusing on "Diagnosis before Advice" and "User Sovereignty."

> [!NOTE] **G-Stack is a Methodology, not a Stack**: The Tech-Lead Stack treats
> "G-Stack" as an engineering philosophy. It is designed to work seamlessly with
> C#, Python, JavaScript, Java, Go, and any other ecosystem by performing a
> **Phase 0: Tech-Stack Discovery** before any action.

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

The current skills available in the toolbox are:

- **`planning-expert`**
- **`code-review-checklist`**
- **`pr-automator`**
- **`visual-verifier`**
- **`mission-architect`**
- **`clean-code`**
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
