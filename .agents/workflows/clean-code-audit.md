---
name: workflow-clean-code-audit
description: Clean Code Audit
---

// turbo

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Inspect the project root to identify the primary language and framework.

2. Call the tech-lead-stack.get_clean_code tool:
   - skillName: "clean-code"
   - projectName: "<NAME_FROM_PACKAGE_JSON>" (Look at your root package.json "name" field or current directory name)
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to audit architecture and recommend SOLID improvements.