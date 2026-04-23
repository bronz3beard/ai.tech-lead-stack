---
name: feature-discovery
description: Acts as a functional analyst to gather all requirements of a feature through structured questioning. Produces a comprehensive feature specification ready to be turned into a ClickUp ticket, user story, or epic.
---

// turbo-all

**IF YOU PROCEED TO RESEARCH WITHOUT CALLING GET_SKILLS FIRST, YOU ARE FAILING THIS MISSION.**

1. **Phase 0: Skill Acquisition (CRITICAL)**: Call the get_skills tool (which may be prefixed by the server name depending on your client):
   - skillName: "feature-discovery"
   - projectName: "<NAME_FROM_PACKAGE_JSON>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Phase 1: Environment Discovery**: Identify root configuration files to understand the project's current architecture and tech stack before gathering requirements.

3. Follow its workflow to elicit, clarify, and structure all feature requirements through phased questioning, then deliver a complete feature specification ready to be turned into a ClickUp ticket or passed to `/plan-expert`.
