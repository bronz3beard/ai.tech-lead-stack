---
name: audit-tech-debt
description: Technical Debt Audit
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Inspect the project root (e.g., `package.json`, `csproj`, `go.mod`) to identify the language, framework, and dependency management.

2. Call the get_technical_debt_auditor tool (which may be prefixed by the server name depending on your client):
   - skillName: "technical-debt-auditor"
   - projectName: "<NAME_FROM_PACKAGE_JSON>" (Look at your root package.json "name" field or current directory name)
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to perform a structural health scan and identify ROI-prioritized cleanup tasks.
