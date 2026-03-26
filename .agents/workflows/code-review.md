---
name: workflow-code-review
description: Pre-PR Quality Gatekeeper Code Review
---

// turbo-all

1. Call the tech-lead-stack.get_skills tool:
   - skillName: "code-review-checklist"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>" (e.g., "gilly")
   - model: "<YOUR_MODEL_NAME>" (e.g., "gemini-1.5-pro")
   - agent: "<YOUR_AGENT_NAME>" (e.g., "Antigravity")

2. Follow its workflow to perform a high-density audit of PR diffs before submission.
