---
name: weekly-leadership-report
description: Weekly Leadership Status Report (Team-Wide)
modes:
  - write
---

// turbo-all

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

1. **Phase 0: Skill Acquisition**: Call the `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing):
   - skillName: "weekly-leadership-report"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. **Phase 2: Data Extraction (Holistic)**:
   - **DO NOT** output any plans and **DO NOT** use subagents. You must directly gather the data yourself.
   - Use the `mcp_chrome-devtools-mcp_navigate_page` and `mcp_chrome-devtools-mcp_take_screenshot` (or related MCP tools) to view the provided ClickUp URLs using the user's existing authenticated browser session.
   - Run `git log origin/main --since="7 days ago" --oneline` to see the entire team's merged work.
   - Run `git tag --sort=-creatordate` to identify version spans.

4. **Phase 3: Synthesis**:
   - Follow the instructions in the `weekly-leadership-report` skill.
   - Categorize work into DEVS, QA, and DESIGN sections.
   - **DO NOT** output any planning steps or subagent tasks. Only output the final result.
   - **FORCE OUTPUT INTO A MARKDOWN CODE BLOCK** for easy copy-pasting.
