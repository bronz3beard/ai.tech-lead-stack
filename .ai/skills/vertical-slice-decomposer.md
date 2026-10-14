---
name: vertical-slice-decomposer
description: >
  Decomposes one or more user stories — optionally with design screenshots or
  Figma URLs — into thin, independently deployable vertical slices (<=2 days)
  and emits ClickUp-ready tasks. Each task carries a technical-details section,
  a developer technical prompt, a dark-release (beta-flag) decision, and a
  mock-vs-real-backend decision. Sizes slices (<=2 working days, <=24 files,
  fewest slices that each deploy, at most 3 open per developer) and, when it can
  run, checks them against the repo's own merged history via the
  `slice-baseline` tool. Built for greenfield and (primarily) brownfield
  features under Trunk-Based Development.
cost: ~5500 tokens
modes: [read-only, write, mcp]
surface: public
category: Plan & Harden
how:
  'Phase 0 stack + domain-boundary + design-input discovery, then a
  deployability-test + BDD + design-state slicing engine, a persistent Slice
  Ledger for multi-turn anti-drift, and a fixed Output Contract per task.'
useCase:
  'Turning brownfield/greenfield stories and designs into 2-day, dark-releasable
  slices under Trunk-Based Development.'
phase: plan
kind: skill
domain: eng
ownership:
  drive: human-ai
  approve: human
targets: [local, api, subscription]
minModelClass: large
consumes: [spec]
emits: [plan]
suggests:
  [
    clean-code,
    regression-bug-fix,
    operational-boundaries,
    style-logic-exporter,
    ui-spec-generator,
  ]
policies:
  - user-sovereignty
  - diagnosis-first
  - four-pillars
---

# Vertical Slice Decomposer (The Corridor Cutter)

## Runtime modes

Produces a verifiable decomposition blueprint in read-only chat, and executes +
verifies the decomposition phase in an IDE/MCP agent.

> [!IMPORTANT] **Four-pillar alignment**: G-Stack (Diagnosis before Advice),
> MinimumCD (atomic batches, vertical slicing, continuous verification), Agent
> Skills (Process over Prose, Anti-Rationalization), Modern Web Guidance.
> **Ethos**: a slice is a thin, fully functional vertical corridor — never a
> layer. **Done = deployable**, even if hidden behind a beta flag.
>
> [!CAUTION] **PRIME DIRECTIVE — ANTI-DRIFT (NON-NEGOTIABLE)** This is an
> **iterative, multi-turn** task. The single goal is: **convert the input user
> story/stories into vertical slices and emit ClickUp tasks.**
>
> 1. **The Slice Ledger is the source of truth.** Maintain it for the ENTIRE
>    conversation (see Phase 1). It survives every detour.
> 2. **Detours are allowed, drift is not.** If the conversation dives into error
>    resolution, deeper requirements, or implementation detail for ONE slice,
>    resolve it, fold the outcome back into that slice's entry, then
>    **immediately reprint the Ledger and Requirement Inventory and resume the
>    decomposition queue.**
> 3. **Every response that follows a detour MUST end by reprinting BOTH the
>    Ledger and Requirement Inventory**, re-running the coverage check, and
>    naming the next pending slice. Never silently abandon a pending slice.
> 4. **Goal Drift Guard (from `operational-boundaries`):** ignore unrelated
>    workspace files/tasks/goals. **Exception:** design screenshots and Figma
>    URLs the user provides WITH a story are in-scope feature spec — not noise.
>    If a request is not part of slicing the in-scope stories, confirm scope
>    before acting — do not silently expand.

## 🔒 VERBATIM ZONES (DO NOT SUMMARIZE)

**VERBATIM ZONES:** user-facing copy strings, enum/identifier values, URLs, GWT
acceptance lines, and the Output Contract template MUST be reproduced
character-for-character wherever they appear in output. Paraphrasing/truncating
any of them is a hard verification failure.

The skill's output is a verbatim template; any intermediary that distills it
must treat fenced Output Contract, tables, GWT lines, and sentinel regions as
protected regions, not narrative.

## Phase 0: Tech-Stack & Domain Discovery (MANDATORY)

- **Skill acquisition (NON-NEGOTIABLE):** IDE/MCP agent MUST call `get_skills`;
  Chat UI MUST call `get_skill`. Never read `.ai/skills/` via raw file access.
- **Stack ID:** Inspect manifest/config (`package.json`, `tsconfig.json`,
  `schema.prisma`/`*.graphql`, CI yaml) for framework + conventions (case style,
  validation lib, query layer, existing types to model contracts from).
- **Domain boundary (CRITICAL — defines "end-to-end"):** A **full-stack product
  team** slices to a **UI** the user observes; a **subdomain/service team**
  slices to an **API contract** its consumers observe. State which applies.
- **Release & mock infra:** Locate the dark-release gate (Next.js middleware,
  `beta_*` cookies, `x-beta-flags` header) and the mock layer (backend-first
  interception in the API service = **default**; client MSW = **fallback**).
- **Design inputs (when provided):** Treat user-supplied screenshots and Figma
  URLs as in-scope spec. Read Figma via the Figma MCP/connector when available;
  otherwise request an exported frame or screenshot. Extract the distinct
  states, components, and variants shown (empty / loading / error / populated;
  desktop / mobile). Reuse `ui-spec-generator` / `style-logic-exporter` if
  present.
- **Sizing baseline (optional — never blocks slicing):** this repo's own merged
  history from the `slice-baseline` tool. Use the first row that applies:

  | Where you are                                                   | Do                                |
  | --------------------------------------------------------------- | --------------------------------- |
  | tech-lead-stack checkout                                        | `node scripts/slice-baseline.mjs` |
  | Project linked to a tech-lead-stack clone                       | `rtk run slice-baseline`          |
  | Read-only chat, npm install, or the command is missing or fails | Skip it                           |

  Add `--window-days 90` for a recent view (default 180).
  - **Tables printed:** use the story type's row ("≤2 days", "Files typical") to
    judge whether a slice fits, and the developer table for the 1 + 2 rule. Pass
    the `all` row's "Over 24" to `planning-expert` for its allowance check.
  - **"No history baseline", skipped, or failed:** say so in one line and use
    the defaults: <=2 working days, <=24 files, at most 3 open per developer.
  - The baseline only **tightens or explains** limits; it never raises them. A
    team whose typical PR is 40 files still slices to <=24.
  - A table the user pastes counts as the baseline; state where it came from.
    Developer names from it guide order and assignment in chat only — never copy
    them into ClickUp tasks.

## Phase 0.5: Input Classification & Spec Precondition

- **Classify input:** is it a formalized `spec` or a raw story/intent-brief?
  (Heuristics: per-touchpoint acceptance criteria present, contracts resolved,
  states enumerated).
- **If NOT a spec:** STOP and recommend running the `specify` phase first.
  - **Primary:** `solutioning-facilitator` to converge business rules / open
    questions and emit a spec (Decision Record + backlog-ready story).
  - **Optional upstream:** the `design-requirements-to-architecture` workflow
    (feature-design-assistant) to translate requirements into a technical spec.
  - **Note:** Only pull in `ui-spec-generator` if UI skeleton components must be
    scaffolded — it is NOT the spec source.
- **Inline fallback:** If the user declines the upstream step, run an inline
  "Spec Normalization" that produces the structured spec (touchpoints, states,
  contracts, verbatim copy, enums) and **REQUIRE explicit user confirmation** of
  that normalized spec before any slicing. _(A spec — or a confirmed
  inline-normalized spec — is a hard precondition.)_

## Phase 1: Story Intake & The Slice Ledger

- **Ingest** every input story plus any attached design frames (screenshots /
  Figma). For multi-story input, queue them; do not interleave. Finish slicing
  story N before story N+1 (limit WIP). Each distinct UI state/variant in a
  design is a candidate slice boundary.
- **Open work per developer: 1 + 2.** A developer actively works one task and
  holds at most two more open (in review, waiting, blocked) — never more than 3
  open at once. Order and assign slices so nobody goes over. If the slice count
  would force it, merge slices (merge pass, Phase 2) instead of queueing more.
- **INVEST screen** each story — Independent, Negotiable, Valuable, Estimable,
  **Small (<=2 working days, <=24 files)**, Testable. Any story failing
  **Small** MUST be sliced.
- **Maintain the Ledger** (reprint at every checkpoint and after every detour):

  | #   | Story | Slice | Files (est.) | Beta flag | Mock/Real | Status (queued/sliced/emitted) | Notes (merges, reasons) |
  | --- | ----- | ----- | ------------ | --------- | --------- | ------------------------------ | ----------------------- |

## Phase 1.5: Requirement Inventory

Build BEFORE slicing; reprint with the Ledger every turn.

<!-- slm-gate:verbatim-start -->

| #   | Requirement/touchpoint | Exact string(s) verbatim | Source (story line / Figma node) | Covered by slice(s) |
| --- | ---------------------- | ------------------------ | -------------------------------- | ------------------- |

<!-- slm-gate:verbatim-end -->

- **Rule:** every distinct touchpoint, copy string, enum value, URL, and
  truth-table row from the input becomes one row. No slicing may begin until the
  inventory is complete.

## Phase 2: Vertical Slicing Engine

- **The deployability test (apply to every candidate item):**
  1. Can a user or consumer **observe** behaviour after this ships?
  2. Can the team **deploy it without waiting** on another team/item?
  3. Does it deliver **behaviour**, not a layer? — Any "no" ⇒ **horizontal
     slice; reslice.**
- **Find boundaries with BDD.** Write `Given–When–Then` scenarios; each scenario
  is a candidate slice with built-in acceptance criteria.
- **Slicing strategies** (pick the smallest valuable cut):

  | Strategy         | Cut by             | Example                                          |
  | ---------------- | ------------------ | ------------------------------------------------ |
  | Workflow step    | one step of a flow | "add to cart" before "checkout"                  |
  | Business rule    | one rule           | ">$100 free shipping" before "intl shipping"     |
  | Data variation   | one data type      | "credit card" before "PayPal"                    |
  | Operation (CRUD) | one operation      | "create" before "edit"/"delete"                  |
  | Happy path first | success case       | "completes checkout" before "payment-fail error" |
  | Platform         | one platform       | "desktop web" before "mobile"                    |
  | Performance      | works first        | "returns results" before "<200ms"                |

- **Design-driven boundaries:** each state/variant a design shows maps to a
  strategy — populated view = happy path first; empty/loading/error states =
  follow-up slices (tasks inside one slice when the story is already Small);
  desktop vs mobile = platform; data variants = data variation.
- **Story already Small?** A story that passes INVEST "Small" is ONE slice. Its
  scenarios and design states become tasks inside it, not separate slices.
- **Slice count check:** estimate the story's total changed files (record each
  slice's share in the Ledger's `Files (est.)`). Expect about (total files ÷ 24,
  rounded up) slices. Up to double that is fine; more needs a one-line reason in
  the Ledger. (A 28-file story → 2 slices, never 7.)
- **Merge pass (run after slicing, before emitting):** merge two slices of the
  same story when ALL hold: (1) together they still fit one slice (<=2 working
  days AND <=24 files); (2) they share a flag (or neither needs one) and touch
  mostly the same files; (3) neither is worth deploying without the other. Aim
  for the FEWEST slices that each pass the deployability test. Log each merge in
  the Ledger ("S3+S4 merged: same flag, same files").
- **Task decomposition inside a slice:** each task is hours-not-days, leaves
  trunk green, ordered simplest-first, may use a flag/stub to integrate safely.
  Edge/error cases follow the happy path immediately — never deferred to
  someday.
- **Contracts evolve incrementally:** add only the columns/fields this slice
  needs (backward-compatible). Subdomain teams version the contract and use
  **contract tests** so each side deploys independently.

## Phase 2.5: Multi-Repository Grounding (EVIDENCE-REQUIRED)

- **Expect MULTIPLE workspace roots** (e.g., a backend service repo AND a
  frontend app repo). Enumerate the roots in play; if the spec implies a repo
  not in context, REQUEST its path — never guess across the gap.
- **For EVERY touchpoint**, resolve and cite: `repo` -> `exact file path` ->
  `exact symbol` (GraphQL operation NAME and type, resolver/plugin, React
  component, email template) -> `short snippet or line ref`.
- **No slice may be emitted with an unresolved identifier.** Unknowns go into an
  explicit "Grounding Gaps" list, not a guessed slice.
- **Truncation Guard:** if a codebase read looks truncated/elided (e.g. an
  "expand_elision" marker or an obviously partial file), you MUST expand/re-read
  before naming a symbol from it — never infer an identifier from a partial
  result.

## Phase 3: Dark-Release & Mocking Decision (per slice)

- **Beta flag?** If the slice's user-facing behaviour is incomplete or must be
  hidden until QA/release, it ships behind the **dark-release gate** (a `beta_*`
  flag, e.g. `auditBeta`, set on authorised domains via the middleware
  cookie/`x-beta-flags` header). Record the flag name. The introducing dev owns
  removing the flag at go-live.
- **Mock or real backend?**
  - **Mock (backend-first, default):** new/unbuilt contract → define the GraphQL
    query/mutation schema in the API service first, intercept on the
    `x-beta-flags` header, return the mock payload. Stateful mock store if a
    write must be observable by a later read. Frontend MSW only as fallback.
  - **Real:** the contract already exists and is stable → wire to it directly.
  - **Transition note:** mock→real is non-destructive — run the migration /
    point at the live resolver; only the data values change, the schema is
    identical.

## Phase 4: ClickUp Task Emission (OUTPUT CONTRACT — fill verbatim)

## OUTPUT DISCIPLINE (NON-NEGOTIABLE)

The ONLY deliverable is `vertical-slices.md` (+ Ledger + Requirement Inventory).
The skill MUST NOT write source code, MUST NOT create any other file, MUST NOT
begin implementation. Implementation is delegated only via the per-slice
Technical Prompt.

Emit **one block per slice** (one slice = one task = <=2 days). Use this exact
structure every time, then add the slice to the Ledger as `emitted`:

<!-- slm-gate:verbatim-start -->

```md
### Task: <imperative title, names the corridor>

**Dark release:** Flag required? <yes: `betaName` | no>. Flag owner removes at
go-live. **Data source:** <Mock (backend-first / MSW fallback) | Real backend>.
**Definition of Ready:**

- GWT defined
- <=2 days
- <=24 files (est.)
- testable
- deps resolved. **Definition of Done:**
- integrated to trunk
- unit tests pass
- code reviewed
- deployable (flag hides incomplete UI)
- docs updated
- no known defects. **Vertical slice:** As a <actor>, I can
  <observable behaviour> [happy path]. **Acceptance criteria (GWT):**
- Given …
- When …
- Then … **Technical details:**
- Layers touched (UI / API / data) within the team's domain
- Contract: operation TYPE (query | mutation | subscription) + exact operation
  name (from the codebase) + the type/field being extended + payload shape as a
  typed schema. If a field is exposed on BOTH a query return type and a mutation
  return type, list BOTH consumption sites separately.
- Evidence: Grounding: <repo>/<path> :: <symbol> (<line/snippet>)
- Schema/migration delta (backward-compatible) **Design reference:** <Figma
  frame link / screenshot name> — state covered: <e.g. populated row, empty
  state>. <"none" if no design provided>. **Technical prompt (for the
  developer/agent):**
- A highly specific, copy-pasteable prompt to execute the slice. Because you
  have codebase access, you MUST ground this prompt in reality by including:
  - **Target Files:** The exact file paths in the workspace to edit or create
    (e.g., `src/app/profile/page.tsx`, `prisma/schema.prisma`).
  - **Backend Context:** The exact DB models, RLS policies, or GraphQL/REST
    endpoints to modify, based on existing repository patterns.
  - **Frontend Context:** The exact shared UI components to reuse and the exact
    API mutations to wire up.
  - **Handoff:** For implementation, hand off to a build-phase skill (e.g.,
    `clean-code` or `dev-team`).
```

<!-- slm-gate:verbatim-end -->

- **Deliver** the full set as a `vertical-slices.md` handoff (paste-ready for
  ClickUp). Only auto-create ClickUp items if a ClickUp connector is present
  **and** the user explicitly confirms; otherwise hand off the blocks.
- **ClickUp Formatting Standard:** If using automated scripts or tools to create
  or format these slices in ClickUp:
  - You MUST format the description and tasks using `scripts/clickup-format.ts`
    to ensure consistent headings, checklists, and bolding.
  - Keep tables under 4 columns for task comments/descriptions to prevent table
    wrapping/truncation in ClickUp.
- Close with the **Ledger** showing all slices and the next action.

## ⚖️ Anti-Rationalization (MANDATORY)

| Excuse                                                | Rebuttal                                                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| "Split it into a UI task and a backend task."         | **Denied.** That is horizontal. One dev/pair owns the full corridor; layer-splits create handoffs and block integration.      |
| "Build the whole schema/API first, wire UI later."    | **Denied.** A layer ships no observable behaviour and untested contracts accumulate risk. Slice through all owned layers now. |
| "Ship the happy path, backlog the error cases."       | **Denied.** Error handling is not optional. Schedule the key edge cases immediately after the happy path.                     |
| "This story is fine at a week, we'll go faster."      | **Denied.** >2 days ⇒ reslice. Speed is not the fix; smaller batches are.                                                     |
| "We can't deploy without the other team."             | **Denied.** That is an undefined contract. Define/version it and use contract tests so each side deploys independently.       |
| "We drifted into a bug, let's just keep going there." | **Denied.** Resolve, fold into the slice, reprint the Ledger, resume the queue.                                               |
| "Every scenario and design state is its own slice."   | **Denied.** More slices means more open work, not faster delivery. Run the merge pass; a Small story is one slice.            |
| "It's 35 files, but it's still one slice."            | **Denied.** Past 24 files most changes miss 2 days. Cut at a deployable seam; only renames/moves may go wider (`/plan`).      |
| "They can pick up a 4th while one waits for review."  | **Denied.** Review or unblock the open ones first. More open work makes each one finish later.                                |

## 🚩 Red Flags (STOP & Pivot)

- **Horizontal slice detected** — item delivers a layer, not behaviour (fails
  the deployability test).
- **Monolithic item** — 10+ acceptance criteria or a multi-week estimate.
- **Over-split** — more than double (total files ÷ 24) slices with no Ledger
  reason, or a Small story cut into several slices.
- **Open-work breach** — the order or assignment leaves a developer with more
  than 3 open slices.
- **Role/handoff split** — separate "frontend builds X / backend builds Y"
  items.
- **Ledger or Requirement Inventory missing or stale** after a detour —
  anti-drift breach; reprint before continuing.
- **Cross-team deploy dependency** baked into a single slice.
- **Design state dropped** — a slice ships the populated view but silently omits
  empty/loading/error states shown in the provided design.
- **Emitting source code or creating any non-`vertical-slices.md` file** = STOP;
  you have left the skill's contract.

## 🏁 Final Self-Verification (print before emitting)

- (a) input classified; spec present or inline-normalized+confirmed;
- (b) Requirement Inventory complete;
- (c) every inventory row covered;
- (d) every identifier grounded with evidence across ALL repos;
- (e) verbatim zones intact and byte-matched;
- (f) only `vertical-slices.md` produced;
- (g) baseline source stated (tool output, pasted table, or "defaults"); slice
  count within the check; every merge and extra slice has a Ledger reason.

## ✅ Verification Gate (Hard Evidence)

- Every slice **passes the deployability test** and is independently shippable
  within the team's domain.
- Every emitted block is **complete against the Output Contract** (no missing
  flag/data-source/GWT field).
- **COVERAGE CHECK:** every inventory row maps to >=1 slice/AC; zero uncovered
  rows; every verbatim string in the ACs byte-matches its inventory row.
- Target metrics the decomposition must satisfy: story cycle time **<2 days**,
  **<=24 files** per slice, **~100%** of items independently deployable, **0**
  cross-team deploy dependencies per slice, **<=3** open slices per developer.
  "Seems small enough" is NOT evidence.
