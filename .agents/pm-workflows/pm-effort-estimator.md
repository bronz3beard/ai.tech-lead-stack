---
name: pm-effort-estimator
description: Historical Complexity & Effort Estimator
---

// turbo

**MANDATORY: You MUST call the get_skill tool (which may be prefixed as mcp_tech-lead-stack_get_skill or tech-lead-stack_get_skill) with skillName: "pm-$1" before proceeding.**

1. **Phase 1: Skill Acquisition**: Call the `get_skill` tool:
   - skillName: "pm-effort-estimator"
   - projectName: "<PROJECT_NAME>"
   - model: "Gemini"
   - agent: "PM-Assistant"

2. **Phase 2: Estimate Generation**: Follow the acquired skill's workflow to provide a data-driven effort estimation based on the codebase's historical churn and complexity.
