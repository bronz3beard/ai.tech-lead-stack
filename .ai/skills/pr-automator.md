---
name: pr-automator
description: Automates the creation of GitHub Pull Requests with full context.
---
# PR Automator

## Objective
Generate a complete Pull Request description and (optionally) create the PR on GitHub.

## Workflow
1. **Context Gathering**: 
   - Analyze all commits on the current branch compared to `main`.
   - Read `.github/PULL_REQUEST_TEMPLATE.md` (or the one in this toolbox).
2. **Drafting**:
   - **Summary**: A high-level "Why" and "What."
   - **Checklist**: Fill out the template based on the code changes detected.
   - **Visuals**: If `visual-verifier` was run, embed the screenshot links here.
3. **Action (User Preference)**:
   - **Option A (Automated)**: Execute `gh pr create --draft --title "[Title]" --body "[Body]"` using the GitHub CLI.
   - **Option B (Copy/Paste)**: Output the full Markdown for the user to copy.

## Requirements
- Use professional, concise language.
- Link the PR to the ClickUp task ID found in the branch name.