---
name: weekly-leadership-report
description: >
  Extracts technical progress from Git history and ClickUp sprints using browser
  automation to synthesize high-fidelity leadership reports.
cost: ~1200 tokens
modes: [read-only, write]
surface: public
category: Ship & Communicate
phase: deploy
kind: report
domain: eng
ownership:
  drive: human-ai
  approve: human
targets: [local, api, subscription]
minModelClass: small
consumes: [review-report]
emits: [release]
suggests: [ask]
---

# Weekly Leadership Report

## Runtime modes

Produces a verifiable report blueprint in read-only chat, and executes +
verifies the generation phase in an IDE/MCP agent.

> [!IMPORTANT] **G-Stack Ethos**: Diagnosis before Advice. Perform a silent
> environmental audit before data extraction. **Silent Execution Rule**: Do NOT
> output intermediate plans, thoughts, or tool-call reasoning. Perform all
> gathering silently and ONLY output the final markdown code block.
>
> **Methodology Alignment**: This skill strictly adheres to the four core
> pillars: **G-Stack Ethos**, **MinimumCD**, **Agent Skills**, and **Modern Web
> Guidance**.

## Inputs

- **Previous sprint URL** and **current sprint URL** (ClickUp). Both are
  required: the report compares the two sprints to show what shipped, what
  carried over, and what is newly in flight.
- If either URL is missing, ask for it once, then proceed silently.

## Sign-in (ClickUp via chrome-devtools-mcp)

ClickUp is reviewed through `chrome-devtools-mcp`, which may run headless — no
visible browser is needed. The happy path is a browser session that already
holds the ClickUp auth: open a sprint URL and you land on the board. If a login
screen appears, complete sign-in through the MCP browser. Sign-in is normally
**Google SSO** ("Continue with Google"), so drive that flow rather than
expecting a native ClickUp email/password form.

Two environment variables are available as sign-in credentials **if** a form
prompts for them:

- `CLICKUP_USER` — login email (typically the Google account email).
- `CLICKUP_PASSWORD` — password.

Never echo or print these values. If sign-in cannot be completed and no active
session exists, halt per the Authentication Gate rather than emitting a
session-less report.

## Phase 0: Discovery & Diagnosis (Silent)

Ground every decision in what actually exists here (Pillar 1). Before any data
extraction, verify the environment:

1. **Git Audit**: Confirm the working directory is a git repository:
   `git rev-parse --is-inside-work-tree`.
2. **Sync Remote State**: Fetch branches and tags so enumeration is current.
   These are read-only operations; never push, add, merge, or force-push.

   ```bash
   git fetch origin
   git fetch origin --tags
   ```

3. **Version Enumeration**: Version identifiers follow `vMAJOR.MINOR.PATCH`
   (e.g. `v25.0.0`, `v25.3.0`, `v27.1.5`). Capture both in-flight branches and
   the released timeline:

   ```bash
   # Running version branches (in-flight work):
   git branch -r | grep -E 'origin/v[0-9]+\.[0-9]+\.[0-9]+$'
   # Released versions in lineal order:
   git tag --sort=taggerdate
   ```

4. **Frontend/Backend Topology**: From `package.json`, `tsconfig.json`,
   `prisma/schema.prisma`, and the folder layout, determine what counts as
   frontend vs backend in THIS repo so both can be reported separately. For a
   Next.js App Router codebase this is typically frontend = `src/app/**` pages
   and layouts, `src/components/`, client components, styles, `public/`; backend
   = `prisma/` (schema + migrations), `src/app/api/` route handlers, server
   actions, `src/lib/` services, and auth. Confirm against the repo; do not
   assume.
5. **ClickUp Auth Audit**: Via `chrome-devtools-mcp`, check whether an
   authenticated ClickUp session exists (page title, or a quick screenshot of a
   known URL). If not, plan to sign in during Phase 1 (usually Google SSO).
6. **Project Identification**: Derive the project name from the root directory
   or `package.json`.

## Phase 1: Action (Data Intelligence)

### 1. Git Intelligence — main AND every running version branch

`main` alone is not sufficient. Report on `main` PLUS every version branch
enumerated in Phase 0.

- **Trunk (`main`)** — recently merged, team-wide work:
  `git log origin/main --since="7 days ago" --oneline`.
- **Each version branch `vX.Y.Z`** — the in-flight work not yet on trunk:
  `git log origin/main..origin/vX.Y.Z --oneline` (scope with
  `--since="7 days ago"` if noisy). Summarise each version separately.
- **Version timeline** — use `git tag --sort=taggerdate` to order versions and
  distinguish shipped from still-in-flight.
- **Task linkage** — branch names usually embed the ClickUp task ID as `CU-<ID>`
  (e.g. `feature/CU-abc123-inspector-ui`). Extract `CU-<ID>` from each branch so
  its commits can be tied back to a ClickUp task during synthesis:
  `git branch -r | grep -oE 'CU-[a-zA-Z0-9]+'`.

### 2. Role + Surface Analysis (Frontend AND Backend)

For `main` and each version branch, classify activity by role and by surface,
using the topology detected in Phase 0. Both surfaces must appear in the final
report.

- **DEVS — Frontend**: components, pages/routes (Server/Client Components),
  forms, styling, `public/` assets.
- **DEVS — Backend**: `prisma/` schema + migrations, `src/app/api/` route
  handlers, server actions, `src/lib/` services, auth/data layer.
- **QA**: `*.test.ts`, `tests/`, snapshot/E2E specs, and PR titles containing
  "QA".
- **DESIGN**: UI components, design tokens/CSS, and visual assets.
- **Milestone Filter**: group changes into "MIGRATIONS", "FEATURES", and
  "UI/UX".

If one surface has no activity, say so explicitly rather than omitting it (see
Content Audit).

### 3. ClickUp Review — chrome-devtools-mcp, high level, both sprints

The previous-sprint and current-sprint URLs are provided when the skill is
called. Review BOTH so status movement is visible. This is a **high-level
context pass, not a task audit** — do NOT open individual task detail screens.
The goal is just enough board context to relate code changes (branches, by
`CU-<ID>`) to tasks and their status.

- **Open each sprint**: `mcp_chrome-devtools-mcp_navigate_page` to each sprint
  URL. The MCP browser may run headless. If a login screen appears, complete
  sign-in (usually Google SSO) as described in Sign-in above.
- **Read the board quickly**: either capture a screenshot with
  `mcp_chrome-devtools-mcp_take_screenshot` and analyse the image, or read the
  rendered HTML (e.g. `mcp_chrome-devtools-mcp_take_snapshot`). Do not drill
  into tasks. Collect only board-level signal per card: task name, ClickUp ID
  (`CU-<ID>`), status / column (`DONE`, `READY FOR QA`, `CODE REVIEW`,
  `IN PROGRESS`, staging/regression, etc.), `Target version`, and assignees.
- **Movement**: compare previous vs current sprint — what closed, what carried
  over, what is newly started.

### 4. Synthesis

- **Link code to tasks**: match `CU-<ID>` from branch names to the ClickUp task
  IDs seen on the boards, and group commits/branches under the task and version
  they belong to. Where a branch has no `CU-<ID>`, fall back to `Target version`
  and commit messages.
- Consolidate git evidence (main + version branches) with ClickUp task statuses.
- ClickUp status is the source of the human-readable state ("in QA and DR",
  "development in progress", "deployed to staging, regression testing"). Map
  each running version to that status, per surface (frontend/backend).
- Anchor achievements to the version timeline from Phase 0.

## MinimumCD & Quality Verification

1. **Integrity Gate**: Verify the git log is not empty. If empty, alert the user
   about the date range.
2. **ClickUp Authentication Gate (HARD)**: A report without ClickUp sprint
   context is a FAILED run. If sign-in via `chrome-devtools-mcp` cannot be
   completed, or the boards cannot be read, **HALT and state the failure** — do
   NOT fall back to a git-only report. Anti-Rationalization: "git-only is close
   enough" is never an acceptable exit.
3. **Version Coverage Gate**: Every running version branch (and the relevant
   tags) from Phase 0 is represented, or explicitly noted as no-activity.
4. **Surface Coverage Gate**: Both frontend and backend are addressed.
5. **Format Gate**: The final output is a **single Markdown code block** for
   copy-paste. This skill emits a terminal report for a human, not a ClickUp
   doc, so `scripts/clickup-format.ts` rendering is not applicable.
6. **Content Audit**: "Minor Concerns" captures roles or surfaces that look
   inactive in the evidence (e.g. no QA commits, or backend untouched all sprint
   = potential bottleneck).

## 📝 Report Template (FORCE OUTPUT INTO CODE BLOCK)

\`\`\`markdown

## Weekly Leadership Report - [Project Name]

[Project Name] [Date]

~ Status [🟢🟡🔴] [Brief high-level health summary]

~ Brief MIGRATIONS

- [vX.Y.Z] [module] — [FE/BE] — [in progress | QA + DR | ready for QA | starting
  soon | deployed to staging, regression testing | DONE]
- [vX.Y.Z] [module] — [FE/BE] — [status]

OTHER FEATURES

- [vX.Y.Z] [feature] — [FE/BE] — [status]

~ Minor Concerns ‼️ [Honest, sprint-grounded bottlenecks, team fatigue, or
role/surface-specific challenges (e.g. QA falling behind, backend idle).
Grounded in ClickUp sprint movement and git evidence, not the commit log alone.]

~ Achievements & fails 🥇🥈🥉 [Major milestones, migration progress across
versions, and notable failures/learnings, split by frontend/backend where
useful.]

\`\`\`
