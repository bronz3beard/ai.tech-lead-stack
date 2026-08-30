---
name: pr-automator
description:
  Automates the creation of Pull Requests with full context. Use this skill
  whenever the user wants to open, draft, raise, or "PR" their current branch —
  including phrasings like "create a PR", "open a draft PR", "raise a pull
  request", or "PR this branch" — even if they don't name the skill. The skill
  reviews git commit history, strictly maps changes to the project's PR
  template, automatically applies repository labels, pushes the branch to remote
  if unpushed, and creates the draft PR via the gh CLI.
cost: ~1800 tokens
modes: [read-only, write, mcp]
surface: public
category: Ship & Communicate
how:
  'Reviews commit history, populates project PR templates, automatically infers
  labels, and creates a draft PR via GitHub CLI.'
useCase:
  'Finalizing a feature branch into a professional, template-compliant PR.'
---

# PR Automator

## The one job of this skill — read this first

The deliverable of this skill is **a created draft PR on GitHub**. Not a drafted
body file. Not a compare link. Not a terminal command for the user to run. A run
is complete **only** when you have executed `gh pr create --draft` and returned
the resulting PR URL to the user.

> [!IMPORTANT] **Drafting a PR body and then asking the user to run `git push`
> or `gh pr create` is a FAILURE of this skill.** When invoked via
> `/pr-automator`, you have explicit permission to inspect history, push
> unpushed commits on the feature branch (`git push -u origin <branch>`), and
> execute `gh pr create --draft`. Do not stop one step short of the finish line.

**Why creating the draft yourself is safe and correct:** Draft mode _is_ the
human checkpoint. Opening a draft PR creates no disruption for reviewers while
automating the mechanical creation. The user reviews and clicks "Ready for
review" on GitHub when satisfied.

---

## 🔐 Git & CLI Command Policy

| Allowed & Mandated in PR Automator                                                | Strictly Forbidden                                                       |
| :-------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| Read history: `git status`, `git log`, `git diff`, `git rev-parse`, `git branch`. | Force-pushing (`--force`, `+ref`) under any circumstances.               |
| Discover GitHub metadata: `gh api user`, `gh label list`, `gh auth status`.       | Deleting, rebasing, or merging any branch.                               |
| **Push feature branch if unpushed:** `git push -u origin <HEAD_BRANCH>`.          | Modifying or pushing directly to `main` / `master` / protected branches. |
| **Create the Draft PR:** `gh pr create --draft ...` non-interactively.            | Creating live (non-draft) PRs without explicit confirmation.             |
| Push screenshots to `pr/evidence-*` only when evidence capture is enabled.        | `git add .` (always path-scope additions).                               |

---

## 🛑 Hard Stops — The ONLY Reasons Not to Create the PR

If and only if one of these is true, pause, explain the blocker, and provide the
remediation step:

1. **`gh` is not authenticated:** `gh auth status` fails completely. Instruct
   the user to authenticate via `gh auth login`.
2. **Repository explicitly rejects draft PRs:** Draft mode is disabled on the
   repository or GitHub organization. Ask the user if they want a live PR
   instead.

_Note on unpushed branches:_ If the local feature branch is not on origin,
**push it automatically** (`git push -u origin <HEAD_BRANCH>`). Do not treat an
unpushed branch as a hard stop.

---

## 🔧 Recoverable Errors — Fix and Retry Autonomously

| Error / Symptom                                | Autonomous Resolution                                                                                                          |
| :--------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| `could not add label: 'X' not found`           | Remove the invalid label and retry `gh pr create` with only confirmed labels.                                                  |
| Assignee could not be added                    | Drop the `--assignee` flag and retry immediately.                                                                              |
| `unknown flag: --body-file`                    | Fall back to `--body "$(cat .github/.pr_body_temp.md)"`.                                                                       |
| Sandbox config access warning (`~/.config/gh`) | Run command with environment bypass or ensure non-interactive flags (`--base`, `--head`, `--title`, `--body-file`) are passed. |
| Missing `.github` temp folder                  | Run `mkdir -p .github` before writing `.github/.pr_body_temp.md`.                                                              |

---

## 🛠 Step-by-Step Workflow

### Step 0: Input & Context Extraction

Extract all parameters provided by the user in their prompt:

- **Base branch:** Target branch (defaults to `main` if not specified).
- **Module / Section / Migration:** User-provided section or feature tag (e.g.
  `part 2 api backend wire up for audit log table`).
- **Sprint:** User-provided sprint number/name (e.g. `44`).
- **Evidence policy:** If the user specifies "DO NOT collect evidence", "skip
  evidence", or "no screenshots", activate the **Evidence Skip Fast-Path** (Step
  4A).
- **Testing & Readiness notes:** User-provided notes regarding manual testing,
  unit testing, or release readiness.

---

### Step 1: Pre-Flight & Branch Synchronization

1. Determine current branch:

   ```bash
   HEAD_BRANCH=$(git rev-parse --abbrev-ref HEAD)
   ```

2. Check remote status and push unpushed commits:

   ```bash
   git push -u origin "$HEAD_BRANCH"
   ```

3. Fetch GitHub username for assignee:

   ```bash
   GH_USER=$(gh api user -q .login 2>/dev/null || echo "")
   ```

---

### Step 2: Mandatory Commit History & Semantic Extraction

Inspect the full commit history between the base branch and the feature branch:

```bash
git log <BASE_BRANCH>...HEAD --pretty=format:"%h %s"
```

Parse and categorize the commits into semantic action items:

- **`- add:`** New features, endpoints, components, utilities, or database
  models.
- **`- update:`** Modifications, enhancements, or state updates to existing
  logic.
- **`- fix:`** Bug fixes, regression resolutions, error handling improvements.
- **`- refactor:`** Structural refactoring, typing improvements, cleanups.
- **`- delete:`** Deleted files, deprecated mocks, removed dead code.

_Ensure the semantic bullets accurately represent the actual commits made on the
branch._

---

### Step 3: Dynamic Template Discovery & Verbatim Preservation

Search the repository for a PR template in the following precedence order:

1. `.github/pull_request_template.md`
2. `.github/PULL_REQUEST_TEMPLATE.md`
3. `.github/PULL_REQUEST_TEMPLATE/*.md`
4. `.gitlab/merge_request_templates/*.md`
5. `pull_request_template.md` (repository root)
6. Fallback Default Template (if no file is found in target repository).

#### Strict Preservation & Field Mapping Rules

- **Load the template verbatim:** Keep all original markdown headings,
  instructions, blockquotes, and checkbox lists.
- **Do not invent generic schemas:** If the repository has custom headings
  (e.g., `## Module`, `## Shared Code Impact`, `## FYI 🙋`, `## Testing`,
  `## Release Readiness`), retain every heading.
- **Inject parsed values:**
  - **`## Description 📝`:** Insert the semantic list (`- add: ...`,
    `- update: ...`, etc.) generated in Step 2.
  - **`## Module` / `Section`:** Map the user's section/module and sprint values
    (e.g., `Migration Number/Section Name: <section>`, `Sprint: <sprint>`).
  - **`## Shared Code Impact`:** Analyze
    `git diff --name-only <BASE_BRANCH>...HEAD` to check if shared core
    directories (e.g. `shared/`, `components/ui/`, `lib/`) were touched; mark
    Yes/No accordingly.
  - **`## Testing`:** Check the user prompt: if manual testing is confirmed
    completed, mark `Manual testing completed: Yes`; otherwise map accurately.
  - **`## Release Readiness`:** If the user stated ready for release, mark
    `Ready for release: Yes` and `Needs additional work: No`.
  - **`## FYI 🙋`:** List relevant team handles (excluding the PR author).

---

### Step 4: Evidence Handling

#### Option A: Evidence Skip Fast-Path (When user requests no evidence)

If the user instructed not to collect evidence:

1. Skip all Playwright runs, visual verification, and branch switching.
2. In the template's `## Screenshots 📸` (or equivalent) section, write:
   `*Evidence collection / UI smoke testing deferred to PR author as per instruction.*`
3. Proceed directly to Step 5.

#### Option B: Automated Evidence Capture (When evidence is enabled and UI is touched)

1. Run `git diff --name-only <BASE_BRANCH>...HEAD` to check for `.tsx`, `.jsx`,
   `.css`, or styling changes.
2. If UI changes are present, capture screenshots using
   `rtk run visual-verifier` (or project test harness).
3. Persist screenshots to `pr/evidence-[project-name]` and switch back to the
   feature branch.
4. Inject table links into the `## Screenshots` section:

   ```markdown
   | Desktop          | Tablet          | Mobile          |
   | :--------------- | :-------------- | :-------------- |
   | ![Desktop](URL1) | ![Tablet](URL2) | ![Mobile](URL3) |
   ```

---

### Step 5: Automatic Label Discovery & Heuristic Tagging

1. Query available repository labels:

   ```bash
   gh label list --json name -q '.[].name'
   ```

2. Automatically match appropriate labels based on:
   - **Branch / commit type:** `feat:` / `feature/` $\rightarrow$ `enhancement`;
     `fix:` / `bug/` $\rightarrow$ `bug`.
   - **Touched paths:** `tests/`, `*.spec.*` $\rightarrow$ `tests`; `app/`,
     `components/` $\rightarrow$ UI label (e.g. `gilly-ui` or generic UI);
     `api/`, `actions/` $\rightarrow$ `api-integration`.
   - **Refactoring:** `refactor:` $\rightarrow$ `refactor`.
   - **Diff size:** Check line changes for `size S`, `size M`, `size L`.
3. Intersect inferred labels with available repository labels to ensure only
   valid labels are passed.

---

### Step 6: PR Creation Execution (Non-Interactive)

1. Write the completed PR description to `.github/.pr_body_temp.md` (plain
   markdown, no surrounding markdown fences).
2. Execute `gh pr create` with all parameters:

   ```bash
   gh pr create \
     --draft \
     --base "<BASE_BRANCH>" \
     --head "$HEAD_BRANCH" \
     --title "<TITLE>" \
     --body-file .github/.pr_body_temp.md \
     ${GH_USER:+--assignee "$GH_USER"} \
     --label "<CONFIRMED_LABEL_1>" \
     --label "<CONFIRMED_LABEL_2>"
   ```

3. Remove temporary files:

   ```bash
   rm -f .github/.pr_body_temp.md
   ```

4. Output the created draft PR URL to the user.

---

## ✅ Definition of Done

1. `gh pr create --draft` executed cleanly.
2. The PR body strictly followed the repository's PR template without missing
   sections.
3. Commit history was reviewed and converted into accurate semantic bullets
   (`- add:`, `- update:`, `- fix:`).
4. Relevant repository labels were automatically confirmed and attached.
5. The live GitHub PR URL is presented to the user.
