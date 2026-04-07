---
name: workflow-style-logic-exporter
description: Extract style logic and tokens for Figma
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Identify root configuration files for the styling engine (Tailwind, CSS-in-JS, SASS, etc.).

2. Call the tech-lead-stack.get_skills tool:
   - skillName: "style-logic-exporter"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow the workflow to execute style discovery, extract the design system context, and format it for the project's preferred design-to-code alignment.
