# Team Onboarding Guide: The Lead Stack 🤖

Welcome to our automated engineering workflows! This guide will help you set up and use the custom agent skills we've developed.

The "Lead Stack" is a set of modular **agent skills** designed to enhance your day-to-day processes, automate repetitive tasks, and uplevel overall engineering quality. These skills are built to be **agent ambiguous**, meaning you can use them with various large language model agents and AI-integrated IDEs like **Google Antigravity**, **Claude Code**, or **Cursor**.

By leveraging these workflows, we aim to free up your time from the mundane, allowing you to focus on complex problem-solving, code analysis, and team mentorship. We are also preparing for the future of AI-driven engineering.

---

## 🚀 Setup & Prerequisites

Before you can use these skills, ensure your development environment is prepared.

### 1. Configure Your Agent

You'll need access to a reasoning-capable agent or AI IDE. Follow the specific setup instructions for your chosen tool.

### 2. Install Skill Files

The skill files define the automated workflows. For project-specific skills, you should have an `.agents/skills/` directory in your project root. If these aren't present, you'll need to create them. For global availability, place them in `~/.gemini/antigravity/skills/` (for Antigravity).

You'll need to populate this directory with the specific skill folders. The current skills are:

- **`planning-expert/`**
- **`quality-gatekeeper/`**
- **`pr-automation/`**
- **`visual-verification/`**

Make sure each folder contains its corresponding `SKILL.md` file. You can download these files from our internal repository.

### 3. Setup External Integrations

Our automated workflows integrate with several third-party services. Ensure you have properly configured access for:

- **GitHub:** Your agent will need permissions to interact with repositories, read/write PRs, and analyze commits. Consider logging in via the `gh` CLI for best results with automated PR creation.
- **ClickUp:** For bug tracking and task reporting, the `visual-verification` skill posts media evidence as task comments. You'll need to configure your agent with appropriate access tokens or API keys as defined within the skill.

**Note:** For ClickUp, task IDs are typically extracted from your Git branch name or directly from your prompt. Make sure you use the required naming convention.

---

## 🛠️ How to Use

Once your skill files are installed and integrations configured, you can engage your agent.

### Core Workflow Principle: Composable Skills

Think of these as powerful, on-demand capabilities for your AI assistant. You tell the agent _what_ you want to achieve, and it "equips" the necessary skill to guide the process. You invoke a skill by referring to its name or description in your prompt.

### Activating a Specific Workflow

You interact with the stack primarily through conversational prompts within your agent's interface. Be direct and clear about your goal, referencing the relevant skill.

Let's break down the key workflows.

---

## 📝 Workflow 1: Implementation & Bug Planning

### The Goal

Automatically transform a task description, requirement document, or bug report into a structured, actionable plan.

### How to Trigger

Simply copy the task description or bug report into your agent's context window.

**Example Prompts:**

- "Analyze this task description from ClickUp and provide an implementation plan based on the `planning-expert` skill."
- "Create a resolution plan for this bug report, using the approach defined in the `planning-expert` skill."

### What to Expect

The agent will provide a "Task List" for implementation or fix, followed by a detailed "Technical Implementation Plan."

- **Features:** Will outline necessary architecture changes, new files to create, and any dependency updates.
- **Bugs:** Will identify the root cause area, describe the fix, and list potential regression risks.

All plans will follow **MinimumCD** principles, ensuring automated test strategies are included. If a bug is complex, the agent may suggest a "Spike" task.

---

## 🔍 Workflow 2: Pre-PR Quality Gatekeeper

### The Goal

Perform a tech-lead-level code review of your implementation _before_ you create a pull request on GitHub. This helps identify common errors and alignment with architectural standards.

### How to Trigger

After writing your code, prompt the agent to perform a review.

**Example Prompts:**

- "Review my implementation for feature X before I create a PR, using the `quality-gatekeeper` skill."
- "Run the `quality-gatekeeper` check on my current changes against the `main` branch."

### What to Expect

The agent will analyze the `git diff` of your current branch against `main`. It will look for architectural alignment, scalability, and "mundane errors" like missing error handling, leftover console logs, or unoptimized loops.

Crucially, this skill integrates with `autoevals` to objectively score your changes against our defined coding standards (located in `resources/coding-standards.md`).

The agent will output a "Review Summary" with:

- ✅ Passes
- ⚠️ Suggestions
- 🛑 Blockers

You must resolve all Blockers before proceeding to create a PR.

---

## 📇 Workflow 3: PR Template Automation

### The Goal

Automatically analyze your commits and fill out the standardized `.github/PULL_REQUEST_TEMPLATE.md` for GitHub.

### How to Trigger

Once you have made all necessary commits for a feature or fix, prompt the agent to generate the PR.

**Example Prompts:**

- "Use the `pr-automation` skill to analyze my commits and fill out the pull request template for me."
- "Draft a PR description based on the `.github/PULL_REQUEST_TEMPLATE.md` using the changes on this branch."

### What to Expect

The agent will read your commits on the current branch using `git log`. It will then map these changes to the appropriate sections in our PR template (e.g., Features, Fixes, Breaking Changes).

The final output will be a well-structured Markdown draft that you can copy into your GitHub PR. If configured, the agent can also create a draft PR using the `gh` CLI.

---

## 📸 Workflow 4: Visual Verification & Smoke Testing

### The Goal

Automate the process of visual confirmation by taking screenshots/video of a new feature or bug fix on both desktop and mobile views. This media is then automatically posted as smoke testing evidence.

### How to Trigger

After completing a feature or bug fix, prompt the agent to perform visual verification.

**Example Prompts:**

- "Run the `visual-smoke-tester` skill on the current feature and upload desktop and mobile screenshots."
- "Take video evidence of the bug fix using the `visual-verification` skill and upload it as a comment to the ClickUp task."

### What to Expect

The agent will execute browser automation (potentially using Playwright via the `scripts/` directory). It will:

1.  Launch a browser and navigate to the modified feature/bug fix.
2.  Capture a desktop screenshot (1920x1080).
3.  Capture a mobile screenshot (375x812 - iPhone 13 dimensions).
4.  Temporarily save this media to `.tmp/evidence/`.
5.  **ClickUp Integration:** Locate the target ClickUp task ID from the branch name or your prompt. It then uses an integration script to post the media as a comment on that task.
6.  **GitHub Integration:** Upload this visual evidence to the pull request description (based on the PR number), integrating seamlessly with the **PR Automation** skill.

---

---

## 🛠️ Troubleshooting

### "Error while analyzing directory: Cannot list directory .agents..."
You may see this error message when your agent first starts in a new repository that hasn't been initialized yet.

- **Why it happens**: Some agents automatically search for an `.agents` directory to understand the project's workflows. If the directory doesn't exist, the search tool reports an error.
- **The fix**: This is expected behavior. Simply run the `/init` workflow to set up the necessary directory and symlinks. The error will disappear in future sessions.

Happy automating!
