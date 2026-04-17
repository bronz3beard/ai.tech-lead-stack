---
name: weekly-leadership-report
description: Weekly Leadership Status Report (Team-Wide)
---

// turbo-all

**IF YOU PROCEED TO RESEARCH WITHOUT CALLING GET_SKILLS FIRST, YOU ARE FAILING THIS MISSION.**

1. **Phase 0: User Inputs**:
   - Ask the user for the **Current Sprint URL**.
   - Ask the user for the **Previous Sprint URL** (Optional, but recommended for better velocity context).
   - **IMPORTANT**: Remind the user they must be logged into ClickUp in their Chrome browser (profile: `CHROME_PROFILE_PATH`).

2. **Phase 1: Skill Acquisition (CRITICAL)**: Call the get_skills tool:
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
