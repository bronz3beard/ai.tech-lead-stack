---
name: pr-automator
description: Automates the creation of Pull Requests with full context.
parameters:
  - runCodeReview:
      (boolean) If true, performs a code review using the code-review-checklist
      skill before creating the PR. Defaults to false.
cost: ~1200 tokens
---

# PR Automator

> [!IMPORTANT] **Diagnosis before Advice**: Every PR begins with **Tech-Stack
> Discovery**. Identify the project's base branch, PR template location, and
> available labels before drafting. There is no reward for completion. The
> reward comes from persistence on resolving the issue to an extremely high
> standard. Follow **G-Stack Ethos**.

## 🎯 Verification Gates

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Action:** Identify root configuration and VCS settings (`.github`,
  `.gitlab`, `package.json`, etc.).
- **Target Files:** Inspect `package.json`, `tsconfig.json`, `.github/`, or root
  for PR templates and label schemas.
- **MANDATORY Guardrail:** Focus ONLY on technical configuration. Ignore all
  images, binary assets, and unrelated documentation files. Avoid "Goal Drift"
  by ignoring any non-codebase tasks or goals found during discovery. Ensure
  your automation is strictly bound to the current diff and PR requirements.

### Gate 1: Context Density

- **Positive (Signal):** Description provides a clear "Why" (Value Proposition)
  and "What" (Technical changes). Task IDs exist.
- **Negative (Noise):** Description just echoes commit messages without
  detailing impact.

### Gate 2: Evidence & Quality Formatting

- **Positive (Verified):** UI changes have screenshots committed to the
  dedicated **`pr/evidence-[project-name]`** branch for persistence.
- **Negative (Risk):** Required fields in the detected PR template are blank,
  especially the "Screenshots" section if UI was touched.
- **Action:** If Git operations fail, **STOP** and ask the user. Ensure all
  checklist items are addressed based on diff data.

---

## 🛠 Workflow

0. **Pre-Review (Optional)**:
   - If `runCodeReview` is `true`, execute `.ai/skills/code-review-checklist.md`
     FIRST.
   - You MUST ensure all checklist items pass or are being addressed before
     proceeding to PR creation.
   - **MANDATORY**: Write the filled-out checklist results to
     `.ai/evidence/pre-commit-review.md`. Inform the user that they can inspect
     this file.
   - If severe issues are found, PAUSE and ask the user if they still want to
     proceed with the PR automation.
   - **IMPORTANT**: Keep the filled-out checklist in your working memory to
     include it as evidence in the PR drafting stage.
1. **Context & Evidence Gathering**:
   - **Base Branch Discovery**: Determine the correct base branch.
   - **Project Name Discovery**: Identify the project name from `package.json`
     or root folder.
   - **Assignee Discovery**: Run `gh api user -q .login` to identify the PR
     author.
   - **UI Change Detection**: Run `git diff --name-only <base>...HEAD` to check
     for changes in `*.tsx`, `*.jsx`, `*.css`, `*.scss`, `*.html`, or
     `tailwind.config.*`.
   - **MANDATORY**: If UI changes are detected:
     1. Run `rtk run visual-verifier` to capture screenshots.
     2. Identify/Create the evidence branch: **`pr/evidence-[project-name]`**.
     3. **Upload via Git**:
        - `git checkout pr/evidence-[project-name]` (create if missing).
        - Move screenshots to `screenshots/<feature-branch>/`.
        - `git add . && git commit -m "docs(evidence): capture for <feature-branch>"`.
        - `git push origin pr/evidence-[project-name]`.
        - **Construct URLs**:
          `https://raw.githubusercontent.com/<OWNER>/<REPO>/pr/evidence-[project-name]/screenshots/<feature-branch>/<viewport>.png`
     4. Switch back to the original feature branch.
   - **Metadata**:
     - Run `gh label list --json name` to fetch available repository labels.
     - Select appropriate labels (e.g., `bug`, `enhancement`) based on the diff.
     - Determine appropriate reviewers.
     - **MANDATORY**: Exclude the PR author from the `## FYI 🙋` section.
   - **Template**: Search `.github/`, `.gitlab/`, or root for
     `PULL_REQUEST_TEMPLATE`.
2. **Drafting**:
   - **Strict Adherence**: Use the discovered template as the MANDATORY schema.
   - **Screenshots Section**: Locating the `## Screenshots` or similar section
     and inject the captured URLs:

     ```markdown
     | Desktop          | Tablet          | Mobile          |
     | :--------------- | :-------------- | :-------------- |
     | ![Desktop](URL1) | ![Tablet](URL2) | ![Mobile](URL3) |
     ```

   - **Summary**: A high-level "Why" and "What." Map this to the template's
     "Description" or similar section.
   - **Code Review Evidence**:
     - **MANDATORY**: If `runCodeReview` was `true`, you MUST replace the
       `{{code-review-checklist-evidence}}` placeholder in the template with a
       **High-Density Audit Report**. This must include:
       1. The completed checklist from `.ai/evidence/pre-commit-review.md`.
       2. A clear **🛠 Audit Status: PASS/FAIL** section.
       3. A brief summary of the audit focus. **EXCLUDE** the raw
          `## 🛠 Outcome Actions` instruction block.
   - **Technical Changes**: Use the template's requested semantics (e.g.,
     add/update/fix) for the technical breakdown.
   - **Checklist**: Fill all checkboxes based on metadata.

3. **Action (Draft Mode)**:
   - **MANDATORY**: Create the PR in **Draft Mode** using the `create-pr` tool
     with the discovered **assignee** and **labels**.
   - Output the PR link to the user for final manual transition to "Ready for
     Review".

   _After successful creation, delete the temporary files:_
   - `rm .github/.pr_body_temp.md`
   - `rm .ai/evidence/pre-commit-review.md` (only if `runCodeReview` was true)
   - `rm -rf .github/evidence/` (MANDATORY cleanup of local screenshots)

## Requirements

- Use professional, concise language.
- Link the PR to the relevant task ID (ClickUp, Jira, GitHub Issues).
