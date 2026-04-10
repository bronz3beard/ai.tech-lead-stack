---
name: code-review
description: Pre-PR Quality Gatekeeper Code Review
---

// turbo-all

**IF YOU PROCEED TO RESEARCH WITHOUT CALLING GET_SKILLS FIRST, YOU ARE FAILING THIS MISSION.**

1. **Phase 0: Skill Acquisition (CRITICAL)**: Call the get_code_review_checklist tool (which may be prefixed by the server name depending on your client):
   - skillName: "code-review-checklist"
   - projectName: "<NAME_FROM_PACKAGE_JSON>" (Look at your root package.json "name" field or current directory name)
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Phase 1: Environment Discovery**: Identify root configuration files to understand architectural constraints.

3. Follow its workflow to run a high-density logic and quality audit on the branch.
