---
name: pm-backlog-auditor
description: Backlog Sufficiency & Logic Auditor
modes:
  - write
---

// turbo

**MANDATORY: You MUST call the get_skill tool (which may be prefixed as mcp_tech-lead-stack_get_skill or tech-lead-stack_get_skill) with skillName: "pm-$1" before proceeding.**

1. **Phase 1: Skill Acquisition**: Call the `get_skill` tool:
   - skillName: "pm-backlog-auditor"
   - projectName: "<PROJECT_NAME>"
   - model: "Gemini"
   - agent: "PM-Assistant"

2. **Phase 2: Logic Audit**: Follow the acquired skill's workflow to validate the backlog for consistency, feasibility, and technical logic.
