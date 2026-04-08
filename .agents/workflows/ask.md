---
name: ask
description: A Q&A workflow to chat with the Agent about the codebase.
---

// turbo

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Identify root configuration files to understand the project architecture and constraints.

2. Call the tech-lead-stack.get_skills tool:
   - skillName: "ask"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to provide architectural insights and manually implementable snippets.
