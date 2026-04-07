---
name: workflow-pr-automator
description: PR Automator (with Mandatory UI Verification & Draft Mode)
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Identify root configuration files for git-hosting and CI/CD patterns.

2. Call the tech-lead-stack.get_skills tool:
   - skillName: "pr-automator"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to detect UI changes, capture multi-viewport evidence (Desktop, Tablet, Mobile), upload to GitHub storage, and create a high-context **Draft Pull Request**.
