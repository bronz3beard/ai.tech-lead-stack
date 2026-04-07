---
name: workflow-init
description: Master Setup
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Identify root configuration files to define the dev environment and primary commands.

2. Call the tech-lead-stack.get_mission_control tool:
   - skillName: "mission-control"
   - projectName: "<NAME_FROM_PACKAGE_JSON>" (Look at your root package.json "name" field or current directory name)
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to perform a pre-flight diagnostic of the environment and tools.
