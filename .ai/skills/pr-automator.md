---
name: pr-automator
description: Automates the creation of GitHub Pull Requests with full context.
parameters:
  - runCodeReview: (boolean) If true, performs a code review using the code-review-checklist skill before creating the PR. Defaults to false.
cost: ~875 tokens
---

# PR Automator

> [!IMPORTANT] **Persistence & Quality Mindset**: There is no reward for
> completion. The reward comes from persistence on resolving the issue to an
> extremely high standard and also by results and consistent iteration on a
> task. Maintaining context and persisting on the task has a much higher
> feedback loop of success than just completing a request.
>
> [!IMPORTANT] **Telemetry Tracking**: To maintain high-integrity metrics, you
> MUST provide accurate `projectName`, `model`, and `agent` when calling
> `get_skills` to retrieve this skill. Failure to provide accurate telemetry
> data degrades our ability to track performance and cost.

## 🎯 Verification Gates

### Gate 1: Context Density

- **Positive (Signal):** Description provides a clear "Why" (Value Proposition)
  and "What" (Technical changes). Task IDs exist.
- **Negative (Noise):** Description just echoes commit messages like "fixes
  typo" without detailing user-impact.
- **Action:** Synthesize a high-level summary. Strip the raw commit log.

### Gate 2: Evidence & Quality Formatting

- **Positive (Verified):** UI features MUST have screenshot links
  (Desktop/Mobile) provided by `visual-verifier`.
- **Negative (Risk):** Required fields in the `PULL_REQUEST_TEMPLATE.md`
  checklist are left completely blank.
- **Action:** RE-RUN `visual-verifier` if screenshots are missing or broken for
  UI-related changes. Ensure the checklist is populated base on diff data, or
  explicitly state "N/A".

## Objective

Generate a complete Pull Request description and (optionally) create the PR on
GitHub.

## Workflow

0. **Pre-Review (Optional)**:
   - If `runCodeReview` is `true`, execute `.ai/skills/code-review-checklist.md`
     FIRST.
   - You MUST ensure all checklist items pass or are being addressed before
     proceeding to PR creation.
   - If severe issues are found, PAUSE and ask the user if they still want to
     proceed with the PR automation.
1. **Context & Evidence Gathering**:
   - **Base Branch Discovery**: Determine the correct base branch (e.g., `main`,
     `develop`, or a release branch like `v24.0.0`) that this feature was
     branched from. Do NOT automatically assume `main`.
   - Analyze all commits on the current branch compared to the discovered base
     branch.
   - **MANDATORY**: Run `./.ai/rtk-run run visual-verifier` if the diff contains
     UI/CSS changes to provide visual proof.
   - **Label & Reviewer Discovery**:
     - Run `gh label list --json name` to fetch available repository labels.
       Determine 1-3 labels that match the technical changes (e.g., `bug`,
       `config`, `migration`).
     - Determine appropriate reviewers (e.g., from `.github/CODEOWNERS` or
       recent committers).
     - **MANDATORY**: Exclude the PR author from the `## FYI 🙋` section. This
       section is only for users NOT already assigned or the author themselves.
   - **Template Discovery**: Search for a PR template in order:
     1. `.github/pull_request_template.md` (any casing)
     2. `pull_request_template.md` (root)
     3. The default template in `templates/PULL_REQUEST_TEMPLATE.md`.
2. **Drafting**:
   - **Strict Template Adherence**: Use the discovered template as the MANDATORY
     schema. Do not omit any sections from the template.
   - **Summary**: A high-level "Why" and "What." Map this to the template's
     "Description" or similar section.
   - **Technical Changes**: Use the template's requested semantics (e.g.,
     add/update/fix) for the technical breakdown.
   - **Checklist**: Fill out all checkboxes and placeholders (e.g., task IDs,
     module numbers) based on git metadata and branch names.
   - **Visuals**: Use `rtk run visual-verifier [URL1] [URL2] ...` to capture
     full-page screenshots for **ALL** modified UI routes.
     - **MANDATORY**: The app must be running locally AND authenticated for
       `visual-verifier` to succeed.
     - **MANDATORY**: Do not skip any modified pages. If the PR affects 5 pages,
       capture all 5.
     - **IMPORTANT**: Convert local screenshot paths (e.g.,
       `.github/evidence/signin-desktop.png`) to remote GitHub URLs to ensure
       they render in the PR:
       `https://github.com/[OWNER]/[REPO]/blob/[BRANCH]/.github/evidence/[FILENAME].png?raw=true`
   - **File Export**: Write the fully drafted Markdown body to
     `.github/.pr_body_temp.md`.
3. **Action (User Preference)**:
   - **Option A (Automated)**: Execute the GitHub CLI with the generated
     metadata:
     `gh pr create --draft --title "[Title]" --body-file ".github/.pr_body_temp.md" --base "[Discovered Base Branch]" --assignee "@me" --label "[Comma-separated labels]" --reviewer "[Comma-separated reviewers if found]"`
     _After successful creation, delete the temporary file:_
     `rm .github/.pr_body_temp.md`
   - **Option B (Copy/Paste)**: Output the full Markdown for the user to copy.

## Requirements

- Use professional, concise language.
- Link the PR to the ClickUp task ID found in the branch name.
