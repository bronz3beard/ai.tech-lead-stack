---
description: PR Automator (with Mandatory Dynamic Template Adherence, Commit History Review, Label Matching, & Draft Mode)
---

// turbo-all

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

1. **Phase 0: Skill Acquisition**: Call the `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing):
   - skillName: "pr-automator"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"
   - runCodeReview: "<boolean>" Set to `true` if the user provided flags like `--code-review` or explicitly asked for a code review in their command. Defaults to `false`.

2. **Phase 1: Environment & Template Discovery**:
   - Identify base branch (e.g. from prompt `base branch: <name>` or `main`).
   - Discover host project's PR template (`.github/pull_request_template.md` or variants). Retain its exact headings and sections.
   - Sync branch to remote if unpushed: `git push -u origin <HEAD_BRANCH>`.

3. **Phase 2: Review Commit History & Semantic Extraction**:
   - Run `git log <base>...HEAD --pretty=format:"%h %s"` to review all commits on the branch.
   - Formulate semantic change lists (`- add:`, `- update:`, `- fix:`, `- refactor:`, `- delete:`) matching the real commit work.

4. **Phase 3: Populate Template, Match Labels, & Create Draft PR**:
   - Map user-provided inputs (`section` / `module`, `sprint`, testing / release readiness status) into template fields.
   - If user requests no evidence, activate the **Evidence Skip Fast-Path** immediately.
   - Match available repository labels (`gh label list`) based on branch, commits, and diff.
   - Execute `gh pr create --draft` non-interactively with `--body-file` and return the resulting PR URL to the user.
