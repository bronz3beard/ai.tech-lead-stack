---
name: standup-daily-summary
description: Daily Standup Report
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Identify the project root configuration files to determine the project name and primary branch history.

2. Call the get_skills tool (which may be prefixed by the server name depending on your client):
   - skillName: "daily-standup"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to generate a rolling 2-day standup report from git activity.
