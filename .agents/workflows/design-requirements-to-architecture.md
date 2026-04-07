---
name: workflow-design-requirements-to-architecture
description: Feature Design Assistant
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Identify the project root configuration files to understand architectural constraints.

2. Call the tech-lead-stack.get_feature_design_assistant tool:
   - skillName: "feature-design-assistant"
   - projectName: "<NAME_FROM_PACKAGE_JSON>" (Look at your root package.json "name" field or current directory name)
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to translate requirements into technical specifications that align with the detected ecosystem.
