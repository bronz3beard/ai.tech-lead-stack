---
name: hr-intake-specifier
description: Requisition Intake Brief Specifier
---

// turbo

**MANDATORY: You MUST call the get_skill tool (which may be prefixed as mcp_tech-lead-stack_get_skill or tech-lead-stack_get_skill) with skillName: "hr-$1" before proceeding.**

1. **Phase 1: Skill Acquisition**: Call the `get_skill` tool:
   - skillName: "hr-intake-specifier"
   - projectName: "<PROJECT_NAME>"
   - model: "Gemini"
   - agent: "HR-Assistant"

2. **Phase 2: Intake Drafting**: Follow the acquired skill's workflow to translate the client kickoff call into a complete, deduplicated requisition intake brief.
