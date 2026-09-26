# How to use in any project

[← Back to the README](../README.md)

## 3. Usage Options

### Option A: The "Context Injection" (Universal)

If using a web-based agent (Claude.ai, ChatGPT) or starting a fresh session
without workspace access:

> "Analyze the skills in /path/to/lead-stack/.ai/skills/. You are now a Tech
> Lead Agent equipped with these workflows. Use `rtk run <tool>` for all tool
> executions."

### Option B: The Symlink (Antigravity, Claude Code, Cline, Continue, Cursor, Gemini)

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
