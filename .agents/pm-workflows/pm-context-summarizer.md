---
name: pm-context-summarizer
description: Pre-Meeting Development Context Summarizer
modes:
  - write
---

// turbo

**MANDATORY: You MUST call the get_skill tool (which may be prefixed as mcp_tech-lead-stack_get_skill or tech-lead-stack_get_skill) with skillName: "pm-$1" before proceeding.**

1. **Phase 1: Skill Acquisition**: Call the `get_skill` tool:
   - skillName: "pm-context-summarizer"
   - projectName: "<PROJECT_NAME>"
   - model: "Gemini"
   - agent: "PM-Assistant"

2. **Phase 2: Context Synthesis**: Follow the acquired skill's workflow to summarize recent git activity and blockers into a non-technical meeting briefing.
