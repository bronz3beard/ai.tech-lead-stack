---
name: hr-interview-auditor
description: Structured Interview Evaluator
---

// turbo

**MANDATORY: You MUST call the get_skill tool (which may be prefixed as mcp_tech-lead-stack_get_skill or tech-lead-stack_get_skill) with skillName: "hr-$1" before proceeding.**

1. **Phase 1: Skill Acquisition**: Call the `get_skill` tool:
   - skillName: "hr-interview-auditor"
   - projectName: "<PROJECT_NAME>"
   - model: "Gemini"
   - agent: "HR-Assistant"

2. **Phase 2: Interview Evaluation**: Follow the acquired skill's workflow to evaluate the applicant against the requisition scorecard and capture evidence-backed interview notes.
