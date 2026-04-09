---
name: style-logic-exporter
description: Extract style logic and tokens for Figma
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Identify root configuration files for the styling engine (Tailwind, CSS-in-JS, SASS, etc.).

> [!CAUTION] SECURITY ENFORCEMENT: Direct file access via `view_file` or `run_command` is strictly forbidden.
> - **IDE / MCP-enabled Agent:** You MUST use the MCP `get_skills` tool.
> - **Chat UI (/chat):** You MUST use the internal `get_skill` tool.

2. Call the get_skills tool (which may be prefixed by the server name depending on your client):
   - skillName: "style-logic-exporter"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow the workflow to execute style discovery, extract the design system context, and format it for the project's preferred design-to-code alignment.
