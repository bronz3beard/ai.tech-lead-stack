---
name: hr-jd-drafter
description: Inclusive Job Description Drafter
modes:
  - write
---

// turbo

**MANDATORY: You MUST call the get_skill tool (which may be prefixed as mcp_tech-lead-stack_get_skill or tech-lead-stack_get_skill) with skillName: "hr-$1" before proceeding.**

1. **Phase 1: Skill Acquisition**: Call the `get_skill` tool:
   - skillName: "hr-jd-drafter"
   - projectName: "<PROJECT_NAME>"
   - model: "Gemini"
   - agent: "HR-Assistant"

2. **Phase 2: JD Drafting**: Follow the acquired skill's workflow to produce a finalized, inclusive, market-ready Job Description from the intake brief or client-provided draft.
