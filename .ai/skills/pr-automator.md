---
name: pr-automator
description: Automates the creation of Pull Requests with full context.
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
- **Goal:** Determine base branch (e.g., `main`, `master`), PR template
  location, and label schema.

### Gate 1: Context Density

- **Positive (Signal):** Description provides a clear "Why" (Value Proposition)
  and "What" (Technical changes). Task IDs exist.
- **Negative (Noise):** Description just echoes commit messages without
  detailing impact.

### Gate 2: Evidence & Quality Formatting

- **Positive (Verified):** UI changes have local screenshots uploaded to GitHub
  storage via `visual-verifier` and `upload-to-github.mjs`.
- **Negative (Risk):** Required fields in the detected PR template are blank,
  especially the "Screenshots" section if UI was touched.
- **Action:** Ensure all checklist items are addressed based on diff data.

---

## 🛠 Workflow

1. **Context & Evidence Gathering**:
   - **Base Branch Discovery**: Determine the correct base branch.
   - **UI Change Detection**: Run `git diff --name-only <base>...HEAD` to check
     for changes in `*.tsx`, `*.jsx`, `*.css`, `*.scss`, `*.html`, or
     `tailwind.config.*`.
   - **MANDATORY**: If UI changes are detected, run `rtk run visual-verifier` to
     capture **Desktop**, **Tablet**, and **Mobile** screenshots.
   - **Upload**: For each captured screenshot, run
     `node scripts/upload-to-github.mjs <REPO_URL> <FILE_PATH>` to get the
     remote GitHub asset URL.
   - **Metadata**:
     - Run `gh label list --json name` to fetch available repository labels.
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

   - **Checklist**: Fill all checkboxes based on metadata.

3. **Action (Draft Mode)**:
   - **MANDATORY**: Create the PR in **Draft Mode** (`gh pr create --draft`).
   - Output the PR link to the user for final manual transition to "Ready for
     Review".

## Requirements

- Use professional, concise language.
- Link the PR to the relevant task ID (ClickUp, Jira, GitHub Issues).
