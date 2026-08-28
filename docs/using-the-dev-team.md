# Using the Dev Team — A Practical Guide

> **File location:** `docs/using-the-dev-team.md` How to delegate work to the
> `dev-team-orchestrator` skill: when to use it, what to hand it, how it sizes
> itself to the task, what the gates mean, and what to do at each one. Written
> for the person acting as Tech Lead — you manage the team, you never write the
> code, and you are the only one who merges.

---

## Table of Contents

1. [The one-sentence mental model](#1-the-one-sentence-mental-model)
2. [When to use it — and when not to](#2-when-to-use-it--and-when-not-to)
3. [Which tier to choose](#3-which-tier-to-choose)
4. [The two runtime modes (this determines everything)](#4-the-two-runtime-modes-this-determines-everything)
5. [Choosing models](#5-choosing-models)
6. [How the team sizes itself to the task](#6-how-the-team-sizes-itself-to-the-task)
7. [What a good task hand-off contains](#7-what-a-good-task-hand-off-contains)
8. [The five phases, from your seat](#8-the-five-phases-from-your-seat)
9. [Working the gates: the interview inbox](#9-working-the-gates-the-interview-inbox)
10. [Parallel lanes: running several tasks at once](#10-parallel-lanes-running-several-tasks-at-once)
11. [Friction defects: when the team tells on itself](#11-friction-defects-when-the-team-tells-on-itself)
12. [Worked example: a small task (XS/S)](#12-worked-example-a-small-task-xss)
13. [Worked example: a large task (L/XL)](#13-worked-example-a-large-task-lxl)
14. [Edge cases and gotchas](#14-edge-cases-and-gotchas)
15. [Pre-flight checklist before any run](#15-pre-flight-checklist-before-any-run)
16. [Closing the outer loop](#16-closing-the-outer-loop)

---

## 1. The one-sentence mental model

You are a technical product manager with a team of AI agents; you hand them a
goal and the standards it must meet, they self-organise into the right size for
the job, they stop and ask you only at defined checkpoints, and you review and
merge the result — you never write the code and you never let them push it.

The skill's own litmus test states it directly: _personas receive goals plus
gates, never line-by-line instructions; the human appears only at gates; we
advise, the User Tech-Lead decides._ If you find yourself telling the team
exactly which lines to write, you are using it wrong — that is what the
anti-micromanagement rule exists to prevent.

### The Three-Loop Orientation

To orient this skill within Andrew Ng's three-loop AI workflow model:

| Loop | Cycle Time | Actor | Scope |
| :--- | :--- | :--- | :--- |
| **INNER** | Minutes | Agent-driven | Execution lanes (`dev-team-*`) and autonomous revisions (`reflexion-loop-*`). |
| **MIDDLE** | Hours | Developer-driven | Strategic gates, PARKs, the interview inbox, plan approvals, and design waivers. |
| **OUTER** | Days to weeks | Users and market | End-user feedback, analytics, and business impact. See [Closing the outer loop](#16-closing-the-outer-loop). <!-- Note: renumbering sections above will break this anchor --> |

The dev team and its loop engines automate the INNER loop, intentionally surfacing to you at the MIDDLE loop for steering and approval.

---

## 2. When to use it — and when not to

**Use the dev team when:**

- The task is a real unit of feature work — something you would otherwise hand
  to a developer, not something you would type in ten seconds yourself.
- The task benefits from separation of roles: someone plans, someone builds,
  someone reviews with fresh eyes. Anything touching auth, payments, data
  migrations, or multiple files gains the most from this.
- You want the work to run while you are away and only pull you back at decision
  points.
- You have several independent tasks and want them progressing in parallel
  without stepping on each other.

**Do not use the dev team when:**

- The task is a one-line fix you can make faster than writing the hand-off. The
  team will correctly size it XS and hand it to a solo developer, but you have
  spent more effort delegating than doing.
- You already know exactly the change and just want it typed. Use a plain agent
  session or make the edit yourself. The orchestrator's value is in sizing, role
  separation, and gates — none of which help when there is nothing to decide.
- The task is pure research or a question with no code output. Use `ask` or
  `planning-expert` directly.
- You are not able to be reachable for gate interviews and the task has open
  questions. The lane will simply park and wait, which wastes the run.

The rule of thumb: the dev team earns its overhead when there is genuine
uncertainty, risk, or breadth. For anything trivial, it is heavier than the job
needs.

---

## 3. Which tier to choose

The stack provides three tier-aligned dev team orchestrators to fit your
available model budget and subscription level:

| Tier / Skill                | Target Account / Budget                 | Parallel Lanes       | Worktree Isolation      | Hardening Engine                    | Tier Ceiling / Refusal                            |
| --------------------------- | --------------------------------------- | -------------------- | ----------------------- | ----------------------------------- | ------------------------------------------------- |
| **`dev-team-orchestrator`** | Full / Enterprise (API Keys configured) | 3+ parallel lanes    | Yes (Git Worktrees)     | `reflexion-loop` (Dual-model)       | Uncapped (XS to XL)                               |
| **`dev-team-sub-max`**      | ~$100/mo Subscriptions (No API Keys)    | Max 2 parallel lanes | Yes (Git Worktrees)     | `reflexion-loop-sub-max`            | Uncapped (XL requires confirmation gate)          |
| **`dev-team-sub-pro`**      | ~$20/mo Subscriptions (No API Keys)     | 1 lane (Single pair) | No (Branch on checkout) | `reflexion-loop-sub-pro` (Optional) | Capped at M size / Risk 1 (Refuses L/XL & Risk 2) |

**Rule of thumb:**

- Use **`dev-team-orchestrator`** if `GEMINI_API_KEY` and `ANTHROPIC_API_KEY`
  are configured for maximum adversarial plan hardening.
- Use **`dev-team-sub-max`** if you are running on a higher-tier subscription
  (e.g. Max / Team plan) without external API keys and want multi-lane parallel
  execution.
- Use **`dev-team-sub-pro`** for standard subscription runs ($20/mo). It
  enforces a disciplined Builder+Checker pair directly on your branch without
  burning turn budget on worktree setup.

> [!NOTE]
> For platform limits, pricing changes, and CLI quota behaviors as of August 2026, see the Platform Facts in the [README](../README.md#which-tier-am-i-on).

### What happens when you hit a model limit

Subscription runs operate under rolling-window quota limits. The subscription
orchestrators handle quota exhaustion seamlessly without losing work:

1. **Three Exhaustion Modes:**
   - **Mode A (Model-scoped):** Quota for one model is exhausted. The
     orchestrator runs the fallback ladder laterally or downward to switch
     models and continues.
   - **Mode B (Account-wide):** Session or weekly limit reached across models.
     The orchestrator compacts work into the Findings Ledger
     (`.dev-team/analysis/<lane-id>.md`), PARKs, and reports the reset window.
   - **Mode C (Silent downgrade):** The harness auto-swaps models mid-session
     without error. The orchestrator polls model identity at phase boundaries
     and records any change as a swap event.

2. **The Fallback Ladder (Tier-Dependent):**
   - On `$100+` `sub-max` runs, the orchestrator walks this ladder laterally or downward:
     - **Rung 1:** Same model class, different vendor (isolation preserved).
     - **Rung 2:** Same vendor, lower model class (recomputes isolation level).
     - **Rung 3:** Small/fast class (THROUGHPUT roles only; assurance roles never fall here).
     - **Rung 4:** No capacity anywhere -> Consolidate into Findings Ledger, PARK, report reset window.
   - On `$20` `sub-pro` runs, there is no headroom to spend probing fallback rungs. The ladder is **COMPRESSED**, and model exhaustion triggers Mode B (consolidate-and-park) immediately.
   - *Note:* A **SURFACE swap** is not a rung. The CLI and IDE share one quota pool; switching between them does not restore capacity.

3. **UNREVIEWED vs PROVISIONAL Slices:**
   - **PROVISIONAL Slices:** Work where an audit _completed_, but under a
     degraded assurance role (same model or L2/L3 isolation). PROVISIONAL slices
     are re-reviewed when capacity returns or require an explicit Tech-Lead
     waiver at a gate.
   - **UNREVIEWED Slices:** Work where the run _stopped before the audit
     finished_ (Mode B account-wide limit). UNREVIEWED work has received NO
     verification pass.
   - **Risk-2 Work Rule:** Auth, payments, data, and infrastructure changes MAY
     NOT close on a PROVISIONAL or UNREVIEWED approval — the lane PARKs instead.

4. **Three Mandatory End-State Disclosures:**
   - The FIRST line of the final report explicitly states one of three end
     states:
     - **State 1 (Separation Held):**
       `Model separation held: written by <model-a>, audited by <model-b>.`
     - **State 2 (Separation Lost):**
       `MODEL SEPARATION LOST: <writer-model> wrote this work and also audited it. <exhausted-model> hit its usage limit at <phase/step>, so the audit fell back to the same model that produced the work. This audit was not independent.`
       (Requires audit ran to completion).
     - **State 3 (Audit Incomplete):**
       `AUDIT NOT COMPLETED: the run stopped at <phase/step> before the audit finished. <exhausted-model> hit an account-wide usage limit, so no model was available to continue. The work below is UNREVIEWED, not approved. Quota resets <window>.`
   - **Selection Rule:** State 2 requires an audit _completed_ on the writer's
     model. If the audit did not complete, State 3 applies — never State 2. An
     unfinished audit is an absent one.
   - A full Provenance Table beneath the first line details each phase, model,
     isolation level, swap reason, and effect on claimed assurance.

---

## 4. The two runtime modes (this determines everything)

The orchestrator behaves completely differently depending on where you invoke
it, and it decides which mode it is in as the very first thing it does.

**Read-only chat (the web UI, or any chat agent without file access):** The team
cannot write files or run commands. It produces a **verifiable blueprint and
hand-off** — the crew sizing, the plan, the lane structure, the gates it would
hit — but executes nothing. This is the mode to use when you want to see the
plan and sanity-check the sizing before committing real work. It is safe:
nothing changes on disk.

**IDE / MCP-enabled agent (Antigravity, Cursor, VS Code with the MCP server):**
The team has full write access, creates git worktrees, runs the `rtk` tools,
executes the plan, and produces real diffs. This is where actual work happens.

The practical consequence: if you want to _preview_ how the team will approach
your task, paste it in the read-only web UI first. If you want the work done,
open your IDE with the MCP server connected. The same task in both places gives
you a plan first, then the execution.

---

## 4. Choosing models

Model choices for AI responsibilities (`planner`, `implementer`, `auditor`,
`adjudicator`) are configured flexibly across the platform:

- **User Defaults**: Configured per user in **Settings → Orchestrator Defaults**
  (`/settings` in the web application).
- **Per-Project Overrides**: Configured per project on the project settings
  surface under the **Project Models** tab (`/api/projects/[id]/model-routing`).
- **Precedence Chain**: `Environment Variables (MODEL_*)` → `Project Routing` →
  `User Routing` → `System Default`.
- **Environment Variables are Optional**: `MODEL_*` environment variables
  (`MODEL_PLANNER`, `MODEL_IMPLEMENTER`, `MODEL_AUDITOR`, `MODEL_ADJUDICATOR`)
  should be left **UNSET** so the UI and database remain the authoritative
  source of truth. Environment variables remain available as an optional
  headless override only.

---

## 5. How the team sizes itself to the task

Before any work begins, the orchestrator scores your task on five signals, each
0 to 2, and prints the scores. This is the **Crew Sizing Gate**, and it is the
single most important thing to understand — it is why the team is not "too many
cooks" on small jobs and not under-resourced on big ones.

The five signals:

| Signal       | 0                | 1                      | 2                        |
| ------------ | ---------------- | ---------------------- | ------------------------ |
| Surface area | 1 file, 1 layer  | ≤5 files or 2 layers   | many files / cross-layer |
| Novelty      | existing pattern | adjacent pattern       | new pattern/system       |
| Risk         | cosmetic         | business logic         | auth/payments/data/infra |
| Ambiguity    | spec is exact    | minor gaps             | open questions           |
| Parallelism  | none             | 2 independent subtasks | 3+ independent subtasks  |

The total maps to a crew size:

| Size | Score | Crew                                          | Lanes | Loop hardening                      |
| ---- | ----- | --------------------------------------------- | ----- | ----------------------------------- |
| XS   | 0–1   | Developer only                                | 1     | self-check + autoeval               |
| S    | 2–3   | Developer + Reviewer                          | 1     | reviewer gate                       |
| M    | 4–5   | Planner + Developer + Reviewer                | 1–2   | plan gate + review gate             |
| L    | 6–8   | PM-analyst + Planner + Dev ×N + Reviewer + QA | 2     | reflexion-hardened plan recommended |
| XL   | 9–10  | mission-architect + full L crew               | 2     | reflexion-loop plan gate mandatory + Tech-Lead confirmation gate (~60 turns) |

Three hard rules the orchestrator follows here: idle personas are never spun up
(an XS task gets exactly one developer, not a full crew standing around); the
sizing decision and its scores are always printed before any work starts; and a
size can be revised at a gate but never silently — if the task turns out bigger
than it first looked, the team tells you and re-sizes openly.

**How to use this as the Tech Lead:** when the scores print, check them against
your own gut. If you think a task is trivial and it sized XS, good. If you think
a task is risky and it sized XS, the rubric wording missed something — stop and
tell me, and we tune it. The scores being visible is what lets you catch a
mis-size before it wastes a run.

---

## 5. What a good task hand-off contains

The team is only as good as the goal you give it. A good hand-off has:

- **A clear outcome**, stated as what should be true when done — not how to do
  it. "Users who try to log in before verifying their email are taken to a
  verification screen instead of failing silently" is a goal. "Add an if-check
  in the login handler" is a line-by-line instruction, which is the wrong
  altitude.
- **The acceptance criteria** — the checklist of observable behaviours that
  define done. These become the Reviewer's evidence checklist.
- **Any design inputs**, if the task is visual. This is critical: the planning
  and design skills explicitly consume screenshots and Figma links. A UI task
  without them will stall at a gate asking for them, or guess and get the layout
  wrong. Attach them up front.
- **Known open questions**, flagged honestly. If part of the spec is uncertain
  ("we don't know if the backend can distinguish error type X"), say so. The
  team will surface it as a gate question rather than guessing — which is
  exactly what you want.
- **The scope boundary** — what is explicitly out of scope, so the team does not
  "helpfully" expand the work.

You do not need to decompose the task into steps. That is the planner's job. You
provide the destination and the constraints; the team plots the route.

---

## 6. The five phases, from your seat

**Phase 0 — Discovery.** The team inspects the actual stack (reads
`package.json`, config, conventions), acquires the skills it needs via the MCP
tools, forms a one-sentence mission statement, and confirms its runtime mode.
You do nothing here except watch it correctly identify your project.

**Phase 1 — Crew Sizing Gate.** The five-signal scores print, and the crew size
is declared. This is your first checkpoint — glance at the sizing, and if it
matches your expectation, let it proceed.

**Phase 2 — Lane Ledger.** The team sets up one row per task lane — each with
its own git worktree, branch, and state file at `.dev-team/lanes/<lane-id>.md`.
This is the source of truth for what is happening. You can `cat` these files at
any time to see status. One writer per lane means no two agents ever edit the
same worktree.

**Phase 3 — Persona Execution.** Each role runs as a chain of existing skills:
the planner uses `planning-expert` or `vertical-slice-decomposer`, the developer
implements, the reviewer runs `code-review-checklist` and `verification-auditor`
with fresh eyes and pastes hard evidence, QA runs `visual-verifier` or
`accessibility-auditor` for UI work. The Reviewer never sees the developer's
reasoning — it judges only the actual output, which is the whole point of the
separation.

**Phase 4 — Tech-Lead Interview at Gates.** When the team needs a decision, it
appends the question to `.dev-team/inbox.md` and the lane parks. Other lanes
keep working. You answer when you get to it. (Full detail in the next section.)

**Phase 5 — Friction Defect Protocol.** If something goes wrong twice, or a
skill misbehaves, or a tool is missing, the team writes a friction defect file
and drafts a GitHub issue. (Full detail in section 9.)

Throughout: the team runs everything through the MCP skill tools so the Agentic
Health dashboard records who did what. It never runs `git push`, `git add`, or
`merge` — those are yours alone, always.

---

## 7. Working the gates: the interview inbox

This is the mechanism that lets you be hands-off. The team does not interrupt
you mid-work with questions. It **batches** questions to gate boundaries and
writes them to `.dev-team/inbox.md` in a fenced yaml block:

```yaml answers:
# Leave blank for the human to answer inline
question_1: ''
```

When there is an unanswered question, the lane **parks** at that gate — it stops
and waits, while any other lanes continue. You answer by editing the yaml block
in the file (fill in the empty strings), then tell the agent to continue.

**What this means for your day:** you can hand off a task, walk away, and come
back to a set of parked questions in the inbox. You answer them in a batch,
resume, and walk away again. You are never pulled in mid-stream for a question
the team could have queued.

**A parked lane is not a failed lane.** It is the system working as designed —
it hit something it correctly refused to guess about. Your task in section 11
below has exactly one of these baked in (the Cognito error-code question), and a
healthy run _will_ park on it.

---

## 8. Parallel lanes: running several tasks at once

For M-sized tasks and above, the team can run 2 lanes concurrently. Each lane is a separate git worktree with a single writer, so they never collide.

The Lane Ledger (Phase 2) is the source of truth. After any detour, the team
reprints it so you can always see the state of every lane at a glance:

```bash
cat .dev-team/lanes/*.md      # every lane's status, next gate, artifacts
cat .dev-team/inbox.md        # every pending question across all lanes
```

The key guarantee: lanes advance independently without cross-talk, and the team
never silently abandons a pending slice. If lane A parks waiting for your
answer, lanes B and C keep moving. You are the only synchronisation point, and
only at gates.

**When to use multiple lanes deliberately:** if you have three genuinely
independent tasks (they touch different files, no shared state), hand them over
together and let the team run them as parallel lanes. If the tasks depend on
each other, do not — sequence them, because a parked dependency stalls the
chain.

---

## 9. Friction defects: when the team tells on itself

This is the self-improvement mechanism. The team files a friction defect when:

- It hits the same gate twice with rework (≥2 rework loops).
- A skill behaves contrary to its own description.
- A tool or permission it needs is missing.

When triggered, it writes `.dev-team/friction/<date>-<slug>.md` documenting what
happened (observed vs expected, which skill, how to reproduce, rework count, and
a proposed prevention class), and it drafts a ready-to-run `gh issue create`
command into the inbox.

**By default it only drafts — it does not file the issue.** The issue is only
auto-filed if you have set the environment variable
`DEV_TEAM_AUTOFILE_ISSUES=1`. Otherwise you review the draft and run the command
yourself if you agree.

**Why this matters:** friction defects are how the system gets better over time.
When the team struggles with something, that struggle becomes a documented,
trackable issue on the repo — the same repo the team works on. Over weeks, the
friction files tell you exactly where your skills, tools, or prompts need work.
Treat them as first-class feedback, not noise.

One absolute rule restated: even with `DEV_TEAM_AUTOFILE_ISSUES=1`, the team
still never runs `git push`, `git add`, or `merge`. Auto-filing an issue is the
maximum autonomy it ever has, and even that is opt-in.

---

## 10. Worked example: a small task (XS/S)

_Mock task (illustrative): "Fix the typo 'recieve' to 'receive' in the
onboarding email template."_

**Sizing:** Surface area 0 (one file), Novelty 0, Risk 0 (cosmetic), Ambiguity 0
(exact), Parallelism 0. Total 0 → **XS → Developer only.**

**What happens:** the team prints the sizing, spins up exactly one developer
persona, makes the change in a single worktree, runs the self-check and
autoeval, and hands you a diff. No planner, no reviewer, no gates — because none
are warranted. You review the one-line diff and merge it yourself.

**The lesson:** this is the "too many cooks" prevention in action. A trivial
task gets a trivial crew. If you saw a planner and a QA persona spin up for a
typo fix, that would be the mis-size to report.

_A slightly bigger mock — "Add a loading spinner to the export button" — would
score around 2 (Surface area 1, everything else 0–1) → **S → Developer +
Reviewer**. Now a reviewer with fresh eyes verifies the spinner actually shows
and hides correctly and pastes evidence, but there is still no planner and no
plan gate._

---

## 11. Worked example: a large task (L/XL)

_Mock task (illustrative, derived from a generic pattern — not any real ticket):
"Rework the email-verification flow so unverified users get a dedicated
verification screen with a resend flow, handle expired and failed verification
links with distinct screens, and redirect unverified login attempts to the
verification screen. Includes a new screen, changes to four existing screens,
and the backend verification integration. One open question: whether the auth
provider's error codes can distinguish an expired link from other errors."_

**Sizing:** Surface area 2 (many files, cross-layer — UI plus backend), Novelty
1 (adjacent pattern), Risk 2 (auth flow), Ambiguity 2 (the open error-code
question), Parallelism 1–2 (the screens are somewhat independent). Total roughly
8 → **L, bordering XL → PM-analyst + Planner + Developer(s) + Reviewer + QA, 2–3
lanes, reflexion-hardened plan recommended.**

**What happens:**

1. Sizing prints — you see it land at L/XL and confirm that matches the reality
   of an auth-touching, multi-screen task.
2. Because it is L/XL, the team hardens the plan through
   `rtk run reflexion-loop` before any code is written. The plan gets critiqued
   against the Four Pillars and revised until it passes. This is the plan gate.
3. The plan decomposes into lanes — likely one for the create-account layout
   change, one for the new verification screen and resend flow, one for the
   login-redirect and error-screen handling.
4. Early on, the team hits the open question (can the backend distinguish
   "expired" from other errors?). It **parks that lane** and writes the question
   to `.dev-team/inbox.md`. The other lanes keep working.
5. You answer the question in the inbox and resume. If the answer is "no, we
   can't distinguish," the affected lane adjusts its plan (the error screen
   avoids saying "expired" and prompts a resend instead) — openly, at the gate,
   not silently.
6. QA runs on the UI screens (`visual-verifier`, `accessibility-auditor`).
7. Each lane finishes with a reviewer having pasted hard evidence. You review
   the combined diffs and merge — lane by lane or together, your call.

**The lesson:** a big, risky, ambiguous task gets the full treatment — strategy,
a hardened plan, parallel lanes, QA, and a gate on the genuine unknown. The open
question does not block the whole task; only its lane parks while the rest
proceed. This is the system at its most valuable.

---

## 12. Edge cases and gotchas

**A UI task with no design inputs will stall.** The design and planning skills
consume screenshots and Figma links. If your task is visual and you did not
attach them, expect a gate question asking for them, or a guessed layout. Attach
them in the hand-off.

**An L/XL task in read-only chat gives you a plan, not code.** That is correct —
read-only mode never executes. If you wanted the work done, you were in the
wrong mode; re-run in your IDE. Use read-only deliberately to preview sizing and
the plan first.

**A task with a hidden dependency between "independent" lanes will surface as a
collision or a park.** If two lanes turn out to need the same file, the
single-writer rule forces one to wait. If you see this, the tasks were not as
independent as they looked — sequence them next time.

**Parked lanes wait indefinitely.** If you never answer an inbox question, the
lane never advances. There is no timeout that guesses for you (by design). Check
`.dev-team/inbox.md` when you return.

**The team may re-size mid-run.** If a task reveals itself to be bigger than the
initial signals suggested, the team re-sizes openly at a gate and tells you.
This is not a bug; it is the "never silently" rule. A task that grows from S to
M mid-run is the team being honest.

**Friction defects are drafted, not filed, unless you opted in.** If you
expected a GitHub issue to appear and it did not, check whether
`DEV_TEAM_AUTOFILE_ISSUES` is set. By default you must run the drafted command
yourself.

**The team will never merge for you.** Every lane ends with a diff for your
review. If you are waiting for something to land on main automatically, it never
will — merging is exclusively yours.

**Telemetry only records if skills run through the MCP tools.** If you see a
lane do work but nothing appears on the Agentic Health dashboard, the persona
likely bypassed the MCP skill tools. That is itself worth a friction note.

---

## 13. Pre-flight checklist before any run

Before you hand the team a task, confirm:

- [ ] **Mode is right for intent.** Read-only chat to preview the plan; IDE with
      MCP connected to actually build.
- [ ] **The hand-off states a goal, not line-by-line instructions.** You are
      describing the destination and the constraints, not the route.
- [ ] **Acceptance criteria are included.** These become the reviewer's evidence
      checklist.
- [ ] **Design inputs are attached, if the task is visual.** Figma links or
      screenshots. A UI task without them will stall.
- [ ] **Open questions are flagged honestly in the hand-off.** Let the team park
      and ask rather than guess.
- [ ] **Scope boundary is stated.** What is explicitly out of scope.
- [ ] **You are reachable for gates, or accept that lanes will park.** If the
      task has open questions and you are unavailable, the run will wait.
- [ ] **You know roughly what size you expect,** so you can sanity-check the
      printed sizing against your gut.

If all of those are true, hand it over and let the team size itself. Your job
from that point is to work the gates and review the diffs — not to write the
code.

---

## 16. Closing the outer loop

The repository contains skills capable of handling outer-loop concerns—such as `product-strategist`, `competitive-analysis`, `weekly-leadership-report`, and `qa-handover-generator`—but no automated system currently routes external signals back into planning. The intended flow is: external signal -> `product-strategist` or `competitive-analysis` -> spec revision -> `planning-expert` -> `dev-team`. Today, this handoff is **MANUAL**.

No automated pipeline for outer-loop orchestration exists yet. This is candidate future work.

In regulated environments, the outer loop is where policy, governance, audit, and accountability live. This aligns directly with the repository's existing evidence artifacts (e.g., the `.dev-team/` logs, `.loop-out/` outputs, and the Model Provenance Ledger), ensuring every execution decision leaves a clear, auditable trail.
