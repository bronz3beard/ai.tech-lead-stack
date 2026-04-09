---
name: verify-changes
description: Visual Smoke Test
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Identify root configuration files for the dev server, port, and authentication.

> [!CAUTION] SECURITY ENFORCEMENT: Direct file access via `view_file` or `run_command` is strictly forbidden.
> - **IDE / MCP-enabled Agent:** You MUST use the MCP `get_skills` tool.
> - **Chat UI (/chat):** You MUST use the internal `get_skill` tool.

2. Call the get_skills tool (which may be prefixed by the server name depending on your client):
   - skillName: "visual-verifier"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to capture before/after screenshots and upload evidence of ecosystem parity.
