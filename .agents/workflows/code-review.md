---
name: code-review
description: Pre-PR Quality Gatekeeper Code Review
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Identify root configuration and architectural patterns to ensure ecosystem compliance.

2. Call the tech-lead-stack.get_code_review_checklist tool:
   - skillName: "code-review-checklist"
   - projectName: "<NAME_FROM_PACKAGE_JSON>" (Look at your root package.json "name" field or current directory name)
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to run a high-density logic and quality audit on the branch.
