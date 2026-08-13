---
name: pr-automator
description:
  Automates the creation of Pull Requests with full context. Use this skill
  whenever the user wants to open, draft, raise, or "PR" their current branch —
  including phrasings like "create a PR", "open a draft PR", "raise a pull
  request", or "PR this branch" — even if they don't name the skill. The skill
  drafts a high-context PR body and then creates the draft PR itself via the gh
  CLI; it does not hand the user a command to run.
parameters:
  - runCodeReview:
      (boolean) If true, performs a code review using the code-review-checklist
      skill before creating the PR. Defaults to false.
  - evidencePush:
      (enum `user` | `agent`) Who pushes the screenshot evidence branch. `user`
      (default) = the agent stages/commits screenshots but hands the user the
      push command. `agent` = the agent may push, but ONLY to the dedicated
      `pr/evidence-*` branch, never the code branch. Defaults to `user`.
cost: ~1800 tokens
modes: [read-only, write, mcp]
surface: public
category: Ship & Communicate
how:
  'Fetches visual proof (screenshots) and maps code changes to the original
  Strategic Mission.'
useCase: 'Finalizing a feature branch into a professional, evidence-backed PR.'
---

# PR Automator

## The one job of this skill — read this first

The deliverable of this skill is **a created draft PR**. Not a drafted body. Not
a link to GitHub's "compare" page. Not a terminal command for the user to paste.
A run is complete **only** when you have actually executed
`gh pr create --draft` yourself and returned the resulting PR URL to the user.

> [!IMPORTANT] **Drafting a beautiful PR body and then handing the user a
> `gh pr create` command to run is a FAILURE of this skill, not a completion of
> it.** If you were able to run discovery commands like `git diff` and
> `gh api user`, you are able to run `gh pr create` — it is the same `git`/`gh`
> tooling. Do not stop one step short of the finish line.

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
| `unknown flag: --body-file`                  | Use the fallback: `--body "$(cat .github/.pr_body_temp.md)"`.                                                       |
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

## 🛠 Workflow

0. **Pre-Review (optional):**
   - If `runCodeReview` is `true`, execute `.ai/skills/code-review-checklist.md`
     FIRST. Ensure all items pass or are being addressed before proceeding.
   - Write the filled-out checklist to `.ai/evidence/pre-commit-review.md` and
     tell the user they can inspect it.
   - If severe issues are found, PAUSE and ask whether to proceed.
   - Keep the filled-out checklist in working memory to inject as PR evidence.

1. **Context & Evidence Gathering:**
   - **Pre-flight push check (concrete procedure — resolves to "proceed" in the
     normal case):**

     ```bash
     HEAD_BRANCH=$(git rev-parse --abbrev-ref HEAD)

     # Is the branch on the remote at all?
     if git ls-remote --exit-code --heads origin "$HEAD_BRANCH" >/dev/null 2>&1; then
       echo "On remote — OK to open the PR over it."
     else
       echo "HARD STOP #1: '$HEAD_BRANCH' is not on origin. Ask the user to push it."
     fi

     # Optional: warn (do not block) if local is ahead of the remote.
     git fetch origin "$HEAD_BRANCH" >/dev/null 2>&1 || true
     if [ "$(git rev-parse HEAD 2>/dev/null)" != "$(git rev-parse FETCH_HEAD 2>/dev/null)" ]; then
       echo "NOTE: local is ahead of origin/$HEAD_BRANCH — newest commits won't be in the PR until pushed."
     fi
     ```

     If the branch is on the remote, **proceed** — do not treat "I should be
     careful" as a reason to hand off. If it is genuinely not on the remote,
     that is Hard stop #1.

   - **Also confirm auth is usable:** `gh auth status` (Hard stop #2 if it
     fails).
   - **Base Branch Discovery:** determine the correct base branch.
   - **Project Name Discovery:** from `package.json` or root folder.
   - **Assignee Discovery:** `gh api user -q .login` → the PR author.
   - **UI Change Detection** — follow these steps **in order**:

     **Step A — Run the diff:**

     ```bash
     git diff --name-only <base>...HEAD
     ```

     Collect changed files matching `*.tsx`, `*.jsx`, `*.css`, `*.scss`,
     `*.html`, or `tailwind.config.*`.

     **Step B — For EVERY `.tsx`/`.jsx` file, run the import check first:**

     ```bash
     # Replace <ComponentName> with the PascalCase export and <file> with the filename
     grep -rl "<ComponentName>" src/ --include="*.tsx" --include="*.ts" \
       | grep -v "<file>" \
       | grep -vE "\.(test|spec)\." \
       | grep -v "index\."
     ```

     - **Empty output** → component is **unrendered**. ✅ Skip visual
       verification for this file, and add to the PR body:
       `> ⚠️ filename added but not yet imported — visual verification skipped.`
     - **Matches** → component is **rendered**. Mark it for capture.

     **Step C — Decision:**

     | Condition                                                                       | Action                                                             |
     | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
     | All `.tsx`/`.jsx` files are unrendered AND no `.css`/`.scss`/`tailwind` changed | **Skip visual verifier. Label PR `no-ui-impact`. Go to Metadata.** |
     | Any `.tsx`/`.jsx` is rendered OR any `.css`/`.scss`/`tailwind` changed          | **Proceed to Step D.**                                             |

     **Step D — Capture (only if Step C says "Proceed"):**
     1. Run `rtk run visual-verifier`. If the app requires login, export the
        per-project auth env first (see Authenticated Evidence), e.g.:

        ```bash
        E2E_BASE_URL=… E2E_STORAGE_STATE=… rtk run visual-verifier
        # or: E2E_LOGIN_URL=… E2E_USER=… E2E_PASS=… rtk run visual-verifier
        ```

        If it exits non-zero (auth wall / expired session) or no auth was
        supplied: do **not** attach login-page screenshots. Note "Screenshots
        pending" in the body and continue — evidence does not block creation.

     2. Identify/create the evidence branch `pr/evidence-[project-name]` (a
        dedicated docs branch — it must NEVER contain code).
     3. Persist the screenshots (per the Git Command Policy carve-out):
        - `git checkout pr/evidence-[project-name]` (create if missing).
        - Move screenshots into `screenshots/<feature-branch>/`.
        - **Stage ONLY the screenshots — never `git add .`:**
          `git add screenshots/<feature-branch>/`
        - `git commit -m "docs(evidence): capture for <feature-branch>"`
        - **Push, gated by `evidencePush`:**
          - `user` (default): do NOT push. Output the exact command and ask the
            user to run it: `git push origin pr/evidence-[project-name]`.
          - `agent`: you MAY run that single push — and only that one, to this
            evidence branch: `git push origin pr/evidence-[project-name]`.
        - **Construct URLs:**
          `https://raw.githubusercontent.com/<OWNER>/<REPO>/pr/evidence-[project-name]/screenshots/<feature-branch>/<viewport>.png`
     4. Switch back to the original feature branch (read-only checkout — no
        staging, no commit, no push).

   - **Metadata:**
     - `gh label list --json name` to fetch available repository labels. Select
       only labels that exist (e.g. `bug`, `enhancement`) based on the diff.
     - Determine appropriate reviewers.
     - Exclude the PR author from the `## FYI 🙋` section.
   - **Template:** search `.github/`, `.gitlab/`, or root for
     `PULL_REQUEST_TEMPLATE`.

2. **Drafting:**
   - **Strict adherence:** use the discovered template as the mandatory schema.
   - **Write RAW markdown to the body file** — no surrounding ` ```markdown `
     fences. Fences end up rendered literally in the PR. The file at
     `.github/.pr_body_temp.md` must contain exactly what should appear in the
     PR description.
   - **Screenshots section:** locate `## Screenshots` (or similar) and inject
     the captured URLs, or the "pending" note if capture was blocked:

     ```markdown
     | Desktop          | Tablet          | Mobile          |
     | :--------------- | :-------------- | :-------------- |
     | ![Desktop](URL1) | ![Tablet](URL2) | ![Mobile](URL3) |
     ```

   - **Summary:** a high-level "Why" and "What," mapped to the template's
     Description section.
   - **Code Review Evidence:** if `runCodeReview` was `true`, replace the
     `{{code-review-checklist-evidence}}` placeholder with a High-Density Audit
     Report containing: (1) the completed checklist from
     `.ai/evidence/pre-commit-review.md`; (2) a clear **🛠 Audit Status:
     PASS/FAIL** section; (3) a brief summary of the audit focus. Exclude the
     raw `## 🛠 Outcome Actions` instruction block.
   - **Technical changes:** use the template's semantics (add/update/fix).
   - **Checklist:** fill all checkboxes based on metadata.

3. **Action (Draft Mode) — this step is mandatory and you execute it:**
   - Pre-flight already confirmed the branch is on the remote and `gh` is
     authenticated. Now **create the PR yourself** with the `gh` CLI. Do not
     wait for a "create-pr" tool — it does not exist. Do not output the command
     for the user instead of running it.

     ```bash
     gh pr create \
       --draft \
       --base "<BASE_BRANCH>" \
       --head "<HEAD_BRANCH>" \
       --title "<TITLE>" \
       --body-file .github/.pr_body_temp.md \
       --assignee "<GH_LOGIN>" \
       --label "<LABEL1>" --label "<LABEL2>"
     ```

   - Include `--head` explicitly so `gh` never prompts. Include only labels
     confirmed by `gh label list`; if none match, omit `--label` entirely.
   - **On error:** consult
     [Recoverable errors](#-recoverable-errors--fix-and-retry-never-hand-off),
     fix the input, and rerun. Only the three
     [Hard stops](#-hard-stops--the-only-reasons-not-to-create-the-pr) justify
     not creating the PR.
   - **Fallback:** if `--body-file` is unsupported, use
     `--body "$(cat .github/.pr_body_temp.md)"`.
   - **After successful creation**, clean up local temp files:

     ```bash
     rm -f .github/.pr_body_temp.md
     rm -f .ai/evidence/pre-commit-review.md   # only if runCodeReview was true
     rm -rf .github/evidence/                  # local screenshot temp, if any
     ```

   - **Report the PR URL** returned by `gh pr create` to the user, and tell them
     to review it and click "Ready for review" when they're happy. That URL is
     the proof the run succeeded.

## ✅ Definition of Done (self-check before you end the turn)

You are done only when ALL of these are true:

1. `gh pr create --draft` executed successfully and returned a PR URL.
2. You have shown that PR URL to the user.
3. Temp files (`.github/.pr_body_temp.md`, and the review/evidence temps) are
   removed.

If #1 isn't true and you're not blocked by a documented Hard stop, you are **not
done** — go back and create the PR. A message that ends with a `gh pr create`
command for the user to run (outside pure read-only chat) means the skill
failed.

## ⚖️ Anti-Rationalization

| Excuse                                                           | Rebuttal                                                                                                                        |
| :--------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| "I drafted the body and gave the user the command to run."       | **Denied.** Running the command _is_ the job. Drafting + handing over is a failed run. Execute `gh pr create` yourself.         |
| "Here's the GitHub compare link / a one-click terminal command." | **Denied.** A link or a command is not a created PR. The deliverable is the PR URL that `gh pr create` returns.                 |
| "A `gh`/git command errored, so I handed it back."               | **Denied.** Errors are recoverable — fix the input and retry. Only the three documented Hard stops justify stopping.            |
| "The branch isn't pushed, I'll just push it so the PR works."    | **Denied.** You never push the code branch. That's Hard stop #1 — ask the user to push, then open the PR over it.               |
| "`git add .` is faster than staging only the screenshots."       | **Denied.** A bare add on the evidence branch can sweep in the user's uncommitted code. Path-scope it: `git add screenshots/…`. |
| "There are local changes; let me commit them into the PR."       | **Denied.** You never stage or commit code. The PR reflects only what the user has already committed and pushed.                |
| "The app needs login, so I can't finish — I'll stop."            | **Denied.** Evidence is best-effort and never blocks creation. Note "Screenshots pending" and still open the draft.             |
| "I'll hardcode the test creds so it repeats."                    | **Denied.** Auth is per-project, supplied at invocation, env-only, never committed. Hardcoding leaks secrets into git + traces. |
| "The login-page screenshot is good enough evidence."             | **Denied.** It proves nothing about the feature. Note it as pending instead of attaching it.                                    |

## Requirements

- Use professional, concise language.
- Link the PR to the relevant task ID (ClickUp, Jira, GitHub Issues).
- **Create the draft PR yourself** whenever a shell is available — never hand
  the user a command as a substitute for running it. Report the returned PR URL.
- Honour the **Git Command Policy** — read history and open the PR; never push
  the user's code.
- Honour **Authenticated Evidence** — auth is per-project, env-only, never
  hardcoded or committed; redact it from all output; evidence never blocks PR
  creation.
