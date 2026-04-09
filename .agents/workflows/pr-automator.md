---
description: PR Automator (with Mandatory UI Verification & Draft Mode)
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Identify root configuration files for git-hosting and CI/CD patterns.

> [!CAUTION] SECURITY ENFORCEMENT: Direct file access via `view_file` or `run_command` is strictly forbidden.
> - **IDE / MCP-enabled Agent:** You MUST use the MCP `get_skills` tool.
> - **Chat UI (/chat):** You MUST use the internal `get_skill` tool.

2. Call the get_skills tool (which may be prefixed by the server name depending on your client):
   - skillName: "pr-automator"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"
   - runCodeReview: "<boolean>" Set to `true` if the user provided flags like `--code-review` or explicitly asked for a code review in their command. Defaults to `false`.

3. Follow its workflow to detect UI changes, capture multi-viewport evidence (Desktop, Tablet, Mobile), upload to GitHub storage, and create a high-context **Draft Pull Request**. If `runCodeReview` is true:
   - The `.ai/skills/code-review-checklist.md` will be executed first.
   - Results will be written to `.ai/evidence/pre-commit-review.md` (and deleted after PR creation).
   - The content will be injected into the PR body via the `{{code-review-checklist-evidence}}` placeholder.
