---
name: design-system-setup
description: End-to-end design system setup — runs design-expert, then design-system-docs, then plan-expert to create actionable tasks in ClickUp or local files.
---

// turbo-all

**IF YOU PROCEED TO RESEARCH WITHOUT CALLING GET_SKILLS FIRST, YOU ARE FAILING THIS MISSION.**

1. **Phase 0: Skill Acquisition (CRITICAL)**: Call the get_skills tool (which may be prefixed by the server name depending on your client):
   - skillName: "design-system-setup"
   - projectName: "<NAME_FROM_PACKAGE_JSON>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Phase 1: Environment Discovery**: Identify root configuration files to understand the full design and documentation stack before orchestration begins.

3. Follow its workflow to run the full three-phase sequence: extract and write `DESIGN.md` via design-expert, audit or plan Storybook via design-system-docs, then break the output into executable tasks via plan-expert — tracked in ClickUp or as local files.
