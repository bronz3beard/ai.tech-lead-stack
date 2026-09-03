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
cost: ~6650 tokens
modes: [read-only, write, mcp]
surface: public
category: Ship & Communicate
how:
  'Reviews commit history, populates project PR templates, automatically infers
  labels, and creates a draft PR via GitHub CLI.'
useCase:
  'Finalizing a feature branch into a professional, template-compliant PR.'
phase: deploy
kind: skill
domain: eng
ownership:
  drive: human-ai
  approve: human
targets: [local, api, subscription]
minModelClass: small
consumes: [review-report]
emits: [release]
requires: [visual-verifier]
suggests: [ask]
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

**Why creating the draft yourself is correct and not overstepping:** the PR is
created in **draft** mode on purpose. Draft mode _is_ the human checkpoint — the
user reviews the PR on GitHub, edits anything they like, and clicks "Ready for
review" when satisfied. So opening the draft takes nothing away from the user;
it just does the mechanical work and leaves them the final decision. The edit
step the user cares about happens on the draft PR, not on a local file.

**The only reasons to stop before the PR exists** are the three items in
[Hard stops](#-hard-stops--the-only-reasons-not-to-create-the-pr). Everything
else that goes wrong is a
[recoverable error](#-recoverable-errors--fix-and-retry-never-hand-off) that you
fix and retry. "It hit an error so I handed the command back" is not an
acceptable outcome.

## Runtime modes

Produces a verifiable PR blueprint in read-only chat, and executes + verifies
the full PR-creation phase in an IDE/MCP agent. In an agent with shell access,
executing the creation is mandatory (see above). In pure read-only chat where no
shell exists, produce the blueprint AND the exact command, and say plainly that
creation could not be executed in this environment — that is the _only_ context
in which handing over the command is acceptable.

> [!NOTE] **Diagnosis before drafting.** Every PR begins with **Tech-Stack
> Discovery** — identify the base branch, PR template location, and available
> labels before drafting. The reward comes from resolving the task to a high
> standard, not from stopping early.
>
> **Methodology Alignment**: This skill adheres to the four core pillars:
> **G-Stack Ethos**, **MinimumCD**, **Agent Skills**, and **Modern Web
> Guidance**.

## 🔐 Git Command Policy — what you run, and the one line you never cross

Two things are true at once, and keeping them separate is the whole game:

1. **Opening the PR is your job and is explicitly sanctioned.**
   `gh pr create --draft …` is the goal of this skill. It is a read-plus-create
   operation over commits the user has _already_ pushed. Run it. It is **not**
   in the same category as the forbidden operations below, and caution about
   those must never leak into hesitation about this.

2. **You never author the user's code history.** `BRANCH_MANAGEMENT.md` makes
   the human the sole author of code commits. `pr-automator` is the one
   exception, and it is narrow: you may read history and open the PR, and you
   may push screenshots to a dedicated evidence branch (see Step D). You do not
   touch the user's code.

| You may always                                                                                                                                                           | You never (under any framing or urgency)                                                                                                              |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read history: `git status`, `git log`, `git diff`, `git diff --name-only <base>...HEAD`, `git show`, `git branch --list`, `git rev-parse`, `git ls-remote`, `git fetch`. | `git add`, `git commit`, or `git push` on the **feature/code branch** or on **any of the user's working-tree changes**.                               |
| Read-only checkout to _inspect_ a branch.                                                                                                                                | Force-push, branch deletion, history rewrite, merge, or rebase of any code branch.                                                                    |
| Read GitHub metadata: `gh api user`, `gh label list`, `gh pr view`.                                                                                                      | "Push the branch so the PR works." **Never.** If the branch isn't pushed, that's [Hard stop #1](#-hard-stops--the-only-reasons-not-to-create-the-pr). |
| **Create the PR:** `gh pr create --draft …` over a branch the user has already pushed.                                                                                   | Staging/committing the user's local changes "into the PR." The PR reflects only what is already on the remote.                                        |
| Push screenshots to `pr/evidence-[project-name]` **only** (path-scoped, gated by `evidencePush`).                                                                        | `git add .` on the evidence branch (it can sweep in the user's uncommitted code — path-scope it: `git add screenshots/…`).                            |

**Pre-flight:** the PR opens over what is already on the remote. Verify the HEAD
branch is on the remote using the concrete procedure in Workflow → Step 1. If it
genuinely is not, that is a Hard stop — ask the user to push it. You must not
push it for them.

## 🔑 Authenticated Evidence (per-project — NEVER hardcoded)

If the app under test requires login, `visual-verifier` will otherwise
screenshot the **auth wall**. Auth is supplied **per project, at invocation, by
the user** — never hardcoded in this skill, the scripts, or anywhere in the
tech-lead-stack, and never committed.

- **Source of truth:** the user pastes the per-project E2E auth into the
  invocation context (or sets it in a gitignored `.env.local` they own). Map it
  to **environment variables for the run only**. Never invent credentials and
  never read them from a tracked file.
- **Accepted env (use whichever the project provides):**
  - `E2E_STORAGE_STATE` — path to a pre-authenticated Playwright storage-state
    JSON. **Preferred:** no password ever reaches the agent or the script.
  - or `E2E_LOGIN_URL` + `E2E_USER` + `E2E_PASS` (+ optional `E2E_*_SELECTOR`,
    `E2E_SUCCESS_SELECTOR`) — programmatic login for a **dedicated test
    account**.
  - `E2E_BASE_URL` — the authenticated base URL to capture.
- **Secret-handling rules (non-negotiable, because leaks are permanent):**
  - Pass secrets **via the environment only** — never as CLI args (they leak
    into process lists / shell history) and never written to a tracked file.
  - **Never echo, quote, summarize, log, or commit** the credentials or the
    generated storage-state. If state is persisted, it goes to a gitignored path
    (`auth/*.storageState.json`); confirm the path is ignored, and never
    `git add` it.
  - **Telemetry caveat:** this stack traces runs (Langfuse). Treat anything the
    user pastes as auth as a secret and redact it from every line of output.
  - These are **test-user** credentials only. SSO/MFA logins cannot be automated
    headlessly — use a pre-seeded `E2E_STORAGE_STATE`, or capture evidence
    manually.
- **Evidence is best-effort and never blocks PR creation.** If the app needs
  auth and none was provided, or the verifier hits an auth wall / expired
  session: **do not attach the login-page screenshots** (they prove nothing
  about the feature). Instead, write
  `> ⚠️ Screenshots pending — evidence capture blocked (auth). Add before marking Ready for review.`
  into the body's Screenshots section and **still create the draft PR.** Tell
  the user what's missing so they can add it to the draft.

## 🛑 Hard stops — the only reasons NOT to create the PR

If and only if one of these is true, stop before creating the PR, explain it,
and give the user the one command they need. Otherwise, proceed to creation.

1. **The HEAD (feature) branch is not on the remote.** You cannot push code, so
   you cannot fix this. Ask the user to run `git push -u origin <HEAD_BRANCH>`,
   then continue.
2. **`gh` is not authenticated** (`gh auth status` fails). Ask the user to run
   `gh auth login`, then retry the whole creation step.
3. **The repo rejects draft PRs** (draft mode disabled for the repo/plan). Do
   not silently open a live PR — that notifies reviewers unexpectedly. Ask the
   user whether to open a normal (non-draft) PR instead, then act on their
   answer.

Nothing else qualifies. In particular, a normal `gh` error (bad label, assignee
rejected, missing flag) is **not** a hard stop — see below.

## 🔧 Recoverable errors — fix and retry, never hand off

When `gh pr create` errors, read the message, fix the input, and run it again.
Do **not** convert the error into a "here's the command, you run it" handoff.

| Symptom                                      | Fix, then retry                                                                                                     |
| :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| `could not add label: 'X' not found`         | Only pass labels confirmed by `gh label list`. Drop the unknown label (or omit `--label` entirely) and retry.       |
| assignee could not be added                  | Drop `--assignee` and retry. The PR opening matters more than self-assignment.                                      |
| `unknown flag: --body-file`                  | Use the fallback: `--body "$(cat .ai/tmp/pr-body.md)"`.                                                             |
| body file not found / bad path               | `mkdir -p .github`, rewrite the body to `.github/.pr_body_temp.md`, retry.                                          |
| gh drops into an interactive prompt / editor | You omitted a flag. Provide **all** of `--base`, `--head`, `--title`, and a body flag so it runs non-interactively. |

## 🎯 Verification Gates

### Phase 0: Tech-Stack Discovery (mandatory)

- **Skill usage enforcement:**
  - **IDE / MCP-enabled agent:** call the MCP `get_skills` tool (may be prefixed
    `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending
    on client prefixing).
  - **Chat UI (/chat):** call the internal `get_skill` tool.
- **Action:** identify root configuration and VCS settings (`.github`,
  `.gitlab`, `package.json`, etc.).
- **Target files:** inspect `package.json`, `tsconfig.json`, `.github/`, or root
  for PR templates and label schemas.
- **Guardrail:** focus only on technical configuration. Ignore images, binary
  assets, and unrelated docs. Avoid goal drift — bind your automation strictly
  to the current diff and PR requirements.

### Gate 1: Context Density

- **Signal:** description gives a clear "Why" (value) and "What" (technical
  changes); task IDs exist.
- **Noise:** description just echoes commit messages without impact.

### Gate 2: Evidence & Quality Formatting

- **Verified:** UI changes have screenshots on the dedicated
  `pr/evidence-[project-name]` branch for persistence.
- **Risk:** required template fields are blank — especially "Screenshots" if UI
  was touched. If evidence genuinely can't be captured, note it as pending and
  still open the draft (evidence never blocks creation).

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

### Step 1: Environment & Base Branch Discovery

1. Identify the base branch (defaults to `main` if not specified).
2. Ensure the local feature branch is pushed to remote:

   ```bash
   git push -u origin <HEAD_BRANCH>
   ```

---

### Step 2: Mandatory Commit History & Semantic Extraction

1. Review commit history against base branch:

   ```bash
   git log <BASE_BRANCH>...HEAD --pretty=format:"%h %s"
   ```

2. Categorize commits into semantic bullets matching the changes made on the
   branch:
   - **`- add:`** New features, endpoints, components, utilities, or database
     models.
   - **`- update:`** Modifications, enhancements, or state updates to existing
     logic.
   - **`- fix:`** Bug fixes, regression resolutions, error handling
     improvements.
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
