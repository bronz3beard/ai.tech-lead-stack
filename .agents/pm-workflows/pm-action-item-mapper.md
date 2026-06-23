---
name: pm-action-item-mapper
description: Meeting Note Technical Action-Item Mapper
---

// turbo

**MANDATORY: You MUST call the get_skill tool (which may be prefixed as mcp_tech-lead-stack_get_skill or tech-lead-stack_get_skill) with skillName: "pm-$1" before proceeding.**

1. **Phase 1: Skill Acquisition**: Call the `get_skill` tool:
   - skillName: "pm-action-item-mapper"
   - projectName: "<PROJECT_NAME>"
   - model: "Gemini"
   - agent: "PM-Assistant"

2. **Phase 2: Item Mapping**: Follow the acquired skill's workflow to translate meeting decisions into actionable technical tasks linked to specific parts of the codebase.
