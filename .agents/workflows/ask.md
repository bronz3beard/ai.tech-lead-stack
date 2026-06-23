---
name: ask
description: A Q&A workflow to chat with the Agent about the codebase.
---

// turbo

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

1. **Phase 0: Skill Acquisition**: Call the `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing):
   - skillName: "ask"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Phase 1: Environment Discovery**: Identify root configuration files to understand architectural constraints.

3. Follow its workflow to provide architectural insights and manually implementable snippets. **CRITICAL: This workflow is READ-ONLY. NEVER make code changes.**
