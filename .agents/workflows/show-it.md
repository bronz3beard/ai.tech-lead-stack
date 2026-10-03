---
name: show-it
description: Explain the codebase visually with diagrams, terminal mocks, annotated screenshots, or tiny static HTML.
modes:
  - read-only
  - write
---

// turbo

> [!CAUTION] **CRITICAL: VISUAL-ONLY WORKFLOW & SKILL**
> This workflow never edits, deletes, or refactors code, and never touches git or packages.
> The ONLY permitted write is creating new files under `.ai/output/visuals/`.
> The ONLY permitted command is the stack's screenshot tool (`visual-verifier`).
> The agent answers with visuals (mermaid, terminal mocks, static HTML, annotated screenshots), not prose.

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

> [!IMPORTANT]
> **ANTI-CONFLATION DIRECTIVE:**
> This file (`.agents/workflows/show-it.md`) is a workflow launcher stub, NOT the skill definition.
> Viewing this file via `view_file` does NOT satisfy Phase 0. You MUST call the MCP `get_skills` or `get_skill` tool FIRST with all 4 required fields before executing any other steps.

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is strictly prohibited for skill reading.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

1. **Phase 0: Skill Acquisition**: Call the `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing):
   - skillName: "show-it"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Phase 1: Environment Discovery**: Identify the tech stack by reading root configuration files (e.g., package.json, pyproject.toml, go.mod, Cargo.toml, pom.xml, build.gradle) to understand architectural constraints.

3. Follow its workflow to pick the cheapest visual format the current surface can render, and deliver Title / Visual / Caption / Alt / Source.
