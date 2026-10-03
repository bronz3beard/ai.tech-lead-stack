---
name: show-it-deep
description: Interactive, explorable diagrams of the codebase using archify (optional, installed separately). Higher token cost; IDE only.
modes:
  - read-only
  - write
---

// turbo

> [!CAUTION] **CRITICAL: VISUAL-ONLY WORKFLOW & SKILL**
> This workflow never edits, deletes, or refactors code, and never touches git or packages.
> The ONLY permitted write is creating new files under `.ai/output/visuals/`.
> The ONLY permitted commands are the skill's archify guard check, `node -v`, and archify's `doctor`, `guide`, and `finalize` (the last three prefixed with `ARCHIFY_UPDATE_CHECK_DISABLED=1`).
> The agent never installs or updates archify. If archify or a shell is missing, it STOPS immediately and explains why, with a link to https://github.com/tt-a1i/archify.

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

> [!IMPORTANT]
> **ANTI-CONFLATION DIRECTIVE:**
> This file (`.agents/workflows/show-it-deep.md`) is a workflow launcher stub, NOT the skill definition.
> Viewing this file via `view_file` does NOT satisfy Phase 0. You MUST call the MCP `get_skills` or `get_skill` tool FIRST with all 4 required fields before executing any other steps.

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is strictly prohibited for skill reading.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

1. **Phase 0: Skill Acquisition**: Call the `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing):
   - skillName: "show-it-deep"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **archify guard (BEFORE anything else)**: Run the skill's archify guard check straight after loading it. If archify is not found, or you cannot run commands, STOP: reply with the skill's stop message (why it stopped, the archify GitHub link, and `/show-it` as the cheaper option) and do nothing more.

3. **Phase 1: Environment Discovery** (only if the guard passed): Identify the tech stack by reading root configuration files (e.g., package.json, pyproject.toml, go.mod, Cargo.toml, pom.xml, build.gradle) to understand architectural constraints.

4. Follow its workflow: cost check against `show-it`, health check, build one verified interactive diagram, and deliver Title / File / Caption / Alt / Source / Checks.
