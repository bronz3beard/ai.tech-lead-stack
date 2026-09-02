---
name: hr-candidate-sourcer
description: Passive Candidate Sourcer
modes:
  - write
---

// turbo

**MANDATORY: You MUST call the get_skill tool (which may be prefixed as mcp_tech-lead-stack_get_skill or tech-lead-stack_get_skill) with skillName: "hr-$1" before proceeding.**

1. **Phase 1: Skill Acquisition**: Call the `get_skill` tool:
   - skillName: "hr-candidate-sourcer"
   - projectName: "<PROJECT_NAME>"
   - model: "Gemini"
   - agent: "HR-Assistant"

2. **Phase 2: Sourcing**: Follow the acquired skill's workflow to produce a compliance-checked, match-scored sourcing longlist of passive candidates.
