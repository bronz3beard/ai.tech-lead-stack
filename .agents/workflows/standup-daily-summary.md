---
name: workflow-standup-daily-summary
description: Daily Standup Report
---

// turbo-all

1. Call the tech-lead-stack.get_skills tool:
   - skillName: "daily-standup"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>" (e.g., "gilly")
   - model: "<YOUR_MODEL_NAME>" (e.g., "gemini-1.5-pro")
   - agent: "<YOUR_AGENT_NAME>" (e.g., "Antigravity")

2. Follow its workflow to generate a rolling 2-day standup report from git activity.
