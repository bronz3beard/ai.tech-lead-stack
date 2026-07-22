---
name: hr-endorsement-synthesizer
description: Evidence-Traceable Endorsement Synthesizer
---

// turbo

**MANDATORY: You MUST call the get_skill tool (which may be prefixed as mcp_tech-lead-stack_get_skill or tech-lead-stack_get_skill) with skillName: "hr-$1" before proceeding.**

1. **Phase 1: Skill Acquisition**: Call the `get_skill` tool:
   - skillName: "hr-endorsement-synthesizer"
   - projectName: "<PROJECT_NAME>"
   - model: "Gemini"
   - agent: "HR-Assistant"

2. **Phase 2: Endorsement Synthesis**: Follow the acquired skill's workflow to synthesize resumes and interview notes into an evidence-traceable endorsement report of the top 3-5 applicants.
