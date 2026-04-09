---
name: design-requirements-to-architecture
description: Feature Design Assistant
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Identify the project root configuration files to understand architectural constraints.

> [!CAUTION] SECURITY ENFORCEMENT: Direct file access via `view_file` or `run_command` is strictly forbidden.
> - **IDE / MCP-enabled Agent:** You MUST use the MCP `get_skills` tool.
> - **Chat UI (/chat):** You MUST use the internal `get_skill` tool.

2. Call the get_feature_design_assistant tool (which may be prefixed by the server name depending on your client):
   - skillName: "feature-design-assistant"
   - projectName: "<NAME_FROM_PACKAGE_JSON>" (Look at your root package.json "name" field or current directory name)
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to translate requirements into technical specifications that align with the detected ecosystem.
