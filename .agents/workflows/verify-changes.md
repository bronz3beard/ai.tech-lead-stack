---
name: workflow-verify-changes
description: Visual Smoke Test
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Identify root configuration files for the dev server, port, and authentication.

2. Call the tech-lead-stack.get_skills tool:
   - skillName: "visual-verifier"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to capture before/after screenshots and upload evidence of ecosystem parity.
