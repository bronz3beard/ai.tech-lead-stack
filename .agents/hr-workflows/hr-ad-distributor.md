---
name: hr-ad-distributor
description: Multi-Channel Job Ad Distributor
modes:
  - write
---

// turbo

**MANDATORY: You MUST call the get_skill tool (which may be prefixed as mcp_tech-lead-stack_get_skill or tech-lead-stack_get_skill) with skillName: "hr-$1" before proceeding.**

1. **Phase 1: Skill Acquisition**: Call the `get_skill` tool:
   - skillName: "hr-ad-distributor"
   - projectName: "<PROJECT_NAME>"
   - model: "Gemini"
   - agent: "HR-Assistant"

2. **Phase 2: Distribution**: Follow the acquired skill's workflow to prepare a parity-checked distribution manifest for the approved JD across LinkedIn and Ashby.
