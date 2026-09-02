---
name: hr-pipeline-translator
description: Client-Facing Pipeline Status Translator
modes:
  - write
---

// turbo

**MANDATORY: You MUST call the get_skill tool (which may be prefixed as mcp_tech-lead-stack_get_skill or tech-lead-stack_get_skill) with skillName: "hr-$1" before proceeding.**

1. **Phase 1: Skill Acquisition**: Call the `get_skill` tool:
   - skillName: "hr-pipeline-translator"
   - projectName: "<PROJECT_NAME>"
   - model: "Gemini"
   - agent: "HR-Assistant"

2. **Phase 2: Update Translation**: Follow the acquired skill's workflow to translate recent ATS pipeline movement into a clear, client-facing recruitment status update.
