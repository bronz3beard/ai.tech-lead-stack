---
name: ask
description: A Q&A workflow to chat with the Agent about the codebase.
---

// turbo

> [!CAUTION] **CRITICAL: MANDATORY READ-ONLY WORKFLOW & SKILL**
> This workflow and the associated skill are strictly **READ-ONLY**.
> Under **NO** circumstances may the agent edit, update, delete, or create any code files in the IDE, workspace, or web app.
> All codebase modifications, file writes, and mutating commands are **STRICTLY PROHIBITED**.
> The agent is strictly prohibited from using the following tools under this workflow:
> - `write_to_file`
> - `replace_file_content`
> - `multi_replace_file_content`
> - `run_command` (except for purely read-only commands like `git log`, `cat`, etc., with no side-effects)
> - `browser_subagent` (except for purely read-only viewing of web app without clicking mutating actions)
>
> The agent must act ONLY as a **READ-ONLY ADVISORY ORACLE** and may only output explanation, guidelines, and copy-pasteable code snippets to the chat for manual implementation by the developer.

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

1. **Phase 0: Skill Acquisition**: Call the `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing):
   - skillName: "ask"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Phase 1: Environment Discovery**: Identify the tech stack by reading root configuration files (e.g., package.json, pyproject.toml, go.mod, Cargo.toml, pom.xml, build.gradle) to understand architectural constraints.

3. Follow its workflow to provide architectural insights and manually implementable snippets. **CRITICAL: This workflow is strictly READ-ONLY. The agent is forbidden from updating or altering code in any way.**
