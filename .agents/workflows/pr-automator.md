---
description: PR Automator
---

// turbo-all

1. Call the tech-lead-stack.get_skills tool:
   - skillName: "pr-automator"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>" (e.g., "gilly")
   - model: "<YOUR_MODEL_NAME>" (e.g., "gemini-1.5-pro")
   - agent: "<YOUR_AGENT_NAME>" (e.g., "Antigravity")
   - runCodeReview: "<boolean>" Set to `true` if the user provided flags like `--code-review` or explicitly asked for a code review in their command. Defaults to `false`.

2. Follow its workflow to summarize diffs and create a high-context GitHub Pull Request. If `runCodeReview` is true:
   - The `.ai/skills/code-review-checklist.md` will be executed first.
   - Results will be written to `.ai/evidence/pre-commit-review.md` (and deleted after PR creation).
   - The content will be injected into the PR body via the `{{code-review-checklist-evidence}}` placeholder.
