---
name: design-expert
description: Scan the project for all design-related information and generate a DESIGN.md file to guide future AI agents in UI/UX work.
---

// turbo-all

**IF YOU PROCEED TO RESEARCH WITHOUT CALLING GET_SKILLS FIRST, YOU ARE FAILING THIS MISSION.**

1. **Phase 0: Skill Acquisition (CRITICAL)**: Call the get_skills tool (which may be prefixed by the server name depending on your client):
   - skillName: "design-expert"
   - projectName: "<NAME_FROM_PACKAGE_JSON>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Phase 1: Environment Discovery**: Identify root configuration files (`tailwind.config.*`, `globals.css`, `components.json`, `package.json`) to understand the styling stack and component library in use.

3. Follow its workflow to extract colors, typography, spacing, dark mode strategy, and component patterns into a `DESIGN.md` file at the project root.
