---
name: audit-tech-debt
description: Technical Debt Audit
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Inspect the project root (e.g., `package.json`, `csproj`, `go.mod`) to identify the language, framework, and dependency management.

> [!CAUTION] SECURITY ENFORCEMENT: Direct file access via `view_file` or `run_command` is strictly forbidden.
> - **IDE / MCP-enabled Agent:** You MUST use the MCP `get_skills` tool.
> - **Chat UI (/chat):** You MUST use the internal `get_skill` tool.

2. Call the get_technical_debt_auditor tool (which may be prefixed by the server name depending on your client):
   - skillName: "technical-debt-auditor"
   - projectName: "<NAME_FROM_PACKAGE_JSON>" (Look at your root package.json "name" field or current directory name)
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to perform a structural health scan and identify ROI-prioritized cleanup tasks.
