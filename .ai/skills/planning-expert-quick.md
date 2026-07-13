---
name: planning-expert-quick
description: >
  Ultra-lean strategic planning. Optimized for speed, token efficiency, and
  rapid MVC delivery. Now PR-batch aware — it ingests vertical slices handed off
  from `vertical-slice-decomposer` as well as freeform slices a developer writes
  by hand, keeps every PR batch <=15-20 changed files, and on reaching that
  ceiling hands off to `pr-automator` and escalates multi-batch sequencing to
  `planning-expert`. Use for common, lightweight tasks (1-2 files) where
  velocity is the priority.
cost: ~750 tokens
modes: [read-only, write, mcp]
surface: public
---

# Planning Expert (The G-Stack Runner)

## Runtime modes

Produces a verifiable quick plan blueprint in read-only chat, and executes +
verifies the planning phase in an IDE/MCP agent.

> [!NOTE] **Invoke** with `@planning-expert-quick` / `/planning-expert-quick` /
> context-injection, then paste the work. Input is loose — a
> `vertical-slice-decomposer` block, a **freeform slice typed by a developer**,
> or a small raw task all work (see the input note below).

<!-- -->

> [!TIP] **Ethos**: "No commentary. Just the output." Focus on the **Minimal
> Viable Change** (MVC) to keep velocity high. A plan ships as
> **forward-independent PR batches** — working code only, no dependency on a
> later PR.
>
> **Methodology Alignment**: This skill strictly adheres to the four core
> pillars: **G-Stack Ethos**, **MinimumCD**, **Agent Skills**, and **Modern Web
> Guidance**.

<!-- -->

> [!IMPORTANT] **Input may be a vertical slice** — either a
> `vertical-slice-decomposer` block (carry forward, do not re-decide, its
> **GWT** acceptance criteria, **Dark release** `beta_*` flag, **Data source**
> mock/real, and **Design reference**) **or a freeform slice a developer typed
> by hand** (e.g. "as an admin I can see an audit-log row when an export
> finishes"). Detect freeform on an "As a … I can …" / acceptance-criteria
> signal, normalize it to those same fields, and **fill any missing Dark release
> / Data source from Phase-0 discovery, stating the assumption** (ask only if
> high-stakes). Otherwise slice the raw task yourself.

<!-- -->

> [!CAUTION] **Runtime mode (one skill, env-adaptive).** Identical in the web
> chat UI, the IDE/MCP agent, and the e2b sandbox. In **read-only `/chat`** you
> cannot run git/exec — deliver the plan + the PR-boundary hand-off as
> instructions; the pause is conversational and does **not** block the chat
> workflow. In the **IDE / e2b sandbox** you run the live diff check and the
> real boundary gate. Never claim a file was changed or a PR created in chat.

## 🎯 Strategic Workflow

### Phase 0: Rapid Discovery (MANDATORY)

- **Stack ID:** Call `get_skill`. Inspect manifest files (`package.json`,
  `go.mod`, etc.) to anchor the tech stack.
- **Pattern Match:** Quickly identify core naming and folder conventions.
- **Flag infra:** Note the dark-release gate (`beta_*` / `x-beta-flags`) in case
  an incomplete change must ship hidden behind a flag.
- **Habit:** Turn off Search and Extended Thinking if the task scope is obvious.

### Phase 1: Minimalist Blueprint

- **Framework:** Provide a condensed **W/W/H** (What/Why/How).
- **Strategy:** Reference file paths; DO NOT duplicate existing code logic in
  the plan.

### Phase 2: Atomic Execution Cycle

- **Sizing:** XS/S tasks only (1-2 files).
- **The Cycle:** **Implement → Test → Verify → Commit**.

## 📦 PR Boundary Rule (condensed)

- **Ceiling:** soft **15** / hard **20** counted changed files per PR batch. The
  count is a **proxy** — the real cut is the deployable seam; pair it with the
  line signals. **Count only functional/UI/reviewable changes** (logic, UI,
  `next.config`/`tailwind.config`, helpers); **do not count** mechanical-only
  diffs (Prettier/formatting, import-only, lockfiles, generated, snapshots). A
  quick-plan task should rarely approach this.
- **Escalation:** if the work is clearly going to cross the ceiling, it is no
  longer a quick-plan task — **STOP and escalate to `planning-expert`**, which
  owns the full multi-batch PR Ledger and sequencing.
- **If a batch does reach the ceiling here**, run the blocking hand-off (same as
  `planning-expert`):
  1. Confirm the batch is **forward-independent** (working code • no dependency
     on a later PR • incomplete UI flag-gated).
  2. Recommend the user run the **`pr-automator`** workflow now (`/pr-automator`
     / `rtk run create-pr` — their "/pr-automation"). **PAUSE.**
  3. **WAIT** for the user to confirm the **draft PR** exists.
  4. Ask the user to create the continuation branch (you never run git — the
     stack forbids agent `git add`/`push`):
     `git checkout <current> && git checkout -b <next>` to keep momentum
     (stacked), or branch from refreshed `main` after the squash-merge lands.
  5. **WAIT** for branch confirmation, then resume the next batch.

## 🛠 Outcome Actions

- **Deliver:** `task.md` handoff.
- **Constraint:** NO conversational preamble or filler. (The PR-boundary
  announcement and branch request are protocol control messages, not filler —
  those are required.)

## ⚖️ Anti-Rationalization (MANDATORY)

| Excuse                                | Rebuttal                                                                                                                                                                                             |
| :------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "This is too simple for tests."       | **Denied.** Simple logic often hides complex edge cases.                                                                                                                                             |
| "I'll just skip Phase 0."             | **Denied.** Skipping discovery is the #1 cause of broken builds.                                                                                                                                     |
| "It grew past 20 files, ship it all." | **Denied.** Escalate to `planning-expert` and split into forward-independent PRs at the deployable seam.                                                                                             |
| "I'll open the PR / push for you."    | **Denied for the planner.** It never runs git — hand off. `pr-automator` is the scoped exception (reads history + `gh pr create`; never pushes your code). Instruct the user; wait for confirmation. |

## 🚩 Red Flags (STOP & Pivot)

- **Bloat**: Plan exceeds 2 files or 50 lines (quick-plan threshold) — reassess
  scope.
- **Ambiguity**: Unclear file paths or missing line ranges.
- **Ceiling approach**: Heading toward 15+ files — escalate to `planning-expert`
  rather than forcing it through here.
- **Forward dependency**: A batch needs code from a not-yet-created PR.

## ✅ Verification Gate (Hard Evidence)

- **MANDATORY**: Minimal evidence (build logs, `rtk run validate`) is required.
- **Per batch**: forward-independent (working code • no forward dep • flag-gated
  if incomplete) and within the file ceiling.
