---
description: Specialized audit for Web Accessibility (A11y).
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Identify the project root configuration files to understand architectural constraints.

> [!CAUTION] SECURITY ENFORCEMENT: Direct file access via `view_file` or `run_command` is strictly forbidden.
> - **IDE / MCP-enabled Agent:** You MUST use the MCP `get_skills` tool.
> - **Chat UI (/chat):** You MUST use the internal `get_skill` tool.

2. Call the get_skills tool (which may be prefixed by the server name depending on your client):
   - skillName: "accessibility-auditor"
   - projectName: "<NAME_FROM_PACKAGE_JSON>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to perform a deep accessibility audit and generate `A11Y_AUDIT.md`.
