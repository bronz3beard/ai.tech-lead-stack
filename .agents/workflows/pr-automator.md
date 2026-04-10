---
description: PR Automator (with Mandatory UI Verification & Draft Mode)
---

// turbo-all

**IF YOU PROCEED TO RESEARCH WITHOUT CALLING GET_SKILLS FIRST, YOU ARE FAILING THIS MISSION.**

1. **Phase 0: Skill Acquisition (CRITICAL)**: Call the get_skills tool (which may be prefixed by the server name depending on your client):
   - skillName: "pr-automator"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"
   - runCodeReview: "<boolean>" Set to `true` if the user provided flags like `--code-review` or explicitly asked for a code review in their command. Defaults to `false`.

2. **Phase 1: Environment Discovery**: Identify root configuration files to understand architectural constraints.

3. Follow its workflow to detect UI changes, capture multi-viewport evidence (Desktop, Tablet, Mobile), upload to GitHub storage, and create a high-context **Draft Pull Request**. If `runCodeReview` is true:
   - The `.ai/skills/code-review-checklist.md` will be executed first.
   - Results will be written to `.ai/evidence/pre-commit-review.md` (and deleted after PR creation).
   - The content will be injected into the PR body via the `{{code-review-checklist-evidence}}` placeholder.
