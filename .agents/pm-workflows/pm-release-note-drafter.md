---
name: pm-release-note-drafter
description: Automated Feature Release Note Drafter
modes:
  - write
---

// turbo

**MANDATORY: You MUST call the get_skill tool (which may be prefixed as mcp_tech-lead-stack_get_skill or tech-lead-stack_get_skill) with skillName: "pm-$1" before proceeding.**

1. **Phase 1: Skill Acquisition**: Call the `get_skill` tool:
   - skillName: "pm-release-note-drafter"
   - projectName: "<PROJECT_NAME>"
   - model: "Gemini"
   - agent: "PM-Assistant"

2. **Phase 2: Draft Generation**: Follow the acquired skill's workflow to automatically draft release notes from recently merged features.
