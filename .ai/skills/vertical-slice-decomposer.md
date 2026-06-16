---
name: vertical-slice-decomposer
description:
  Decomposes one or more user stories — optionally with design screenshots or
  Figma URLs — into thin, independently deployable vertical slices (<=2 days)
  and emits ClickUp-ready tasks. Each task carries a technical-details section,
  a developer technical prompt, a dark-release (beta-flag) decision, and a
  mock-vs-real-backend decision. Built for greenfield and (primarily) brownfield
  features under Trunk-Based Development.
cost: ~2000 tokens
---

# Vertical Slice Decomposer (The Corridor Cutter)

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
>    **immediately reprint the Ledger and resume the decomposition queue.**
> 3. **Every response that follows a detour MUST end by reprinting the Ledger**
>    and naming the next pending slice. Never silently abandon a pending slice.
> 4. **Goal Drift Guard (from `operational-boundaries`):** ignore unrelated
>    workspace files/tasks/goals. **Exception:** design screenshots and Figma
>    URLs the user provides WITH a story are in-scope feature spec — not noise.
>    If a request is not part of slicing the in-scope stories, confirm scope
>    before acting — do not silently expand.

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

## Phase 1: Story Intake & The Slice Ledger

- **Ingest** every input story plus any attached design frames (screenshots /
  Figma). For multi-story input, queue them; do not interleave. Finish slicing
  story N before story N+1 (limit WIP). Each distinct UI state/variant in a
  design is a candidate slice boundary.
- **INVEST screen** each story — Independent, Negotiable, Valuable, Estimable,
  **Small (<=2 days)**, Testable. Any story failing **Small** MUST be sliced.
- **Maintain the Ledger** (reprint at every checkpoint and after every detour):

  | #   | Story | Slice | Beta flag | Mock/Real | Status (queued/sliced/emitted) |
  | --- | ----- | ----- | --------- | --------- | ------------------------------ |

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
  follow-up slices; desktop vs mobile = platform; data variants = data
  variation.
- **Task decomposition inside a slice:** each task is hours-not-days, leaves
  trunk green, ordered simplest-first, may use a flag/stub to integrate safely.
  Edge/error cases follow the happy path immediately — never deferred to
  someday.
- **Contracts evolve incrementally:** add only the columns/fields this slice
  needs (backward-compatible). Subdomain teams version the contract and use
  **contract tests** so each side deploys independently.

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

Emit **one block per slice** (one slice = one task = <=2 days). Use this exact
structure every time, then add the slice to the Ledger as `emitted`:

```md
### Task: <imperative title, names the corridor>

**Vertical slice:** As a <actor>, I can <observable behaviour> [happy path].
**Acceptance criteria (GWT):**

- Given … When … Then … **Technical details:**
- Layers touched (UI / API / data) within the team's domain
- Contract: query/mutation/endpoint name + payload shape (ref existing types)
- Schema/migration delta (backward-compatible) **Design reference:** <Figma
  frame link / screenshot name> — state covered: <e.g. populated row, empty
  state>. <"none" if no design provided>. **Technical prompt (for the
  developer/agent):**
- A copy-paste prompt to execute the slice. For mocking, hand off to
  `/schema-driven-mocking`; for implementation, hand off to `/plan`. **Dark
  release:** Flag required? <yes: `betaName` | no>. Flag owner removes at
  go-live. **Data source:** <Mock (backend-first / MSW fallback) | Real
  backend>. **Definition of Ready:** GWT defined • <=2 days • testable • deps
  resolved. **Definition of Done:** integrated to trunk • tests pass • reviewed
  • deployable (flag hides incomplete UI) • docs updated • no known defects.
```

- **Deliver** the full set as a `vertical-slices.md` handoff (paste-ready for
  ClickUp). Only auto-create ClickUp items if a ClickUp connector is present
  **and** the user explicitly confirms; otherwise hand off the blocks.
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

## 🚩 Red Flags (STOP & Pivot)

- **Horizontal slice detected** — item delivers a layer, not behaviour (fails
  the deployability test).
- **Monolithic item** — 10+ acceptance criteria or a multi-week estimate.
- **Role/handoff split** — separate "frontend builds X / backend builds Y"
  items.
- **Ledger missing or stale** after a detour — anti-drift breach; reprint before
  continuing.
- **Cross-team deploy dependency** baked into a single slice.
- **Design state dropped** — a slice ships the populated view but silently omits
  empty/loading/error states shown in the provided design.

## ✅ Verification Gate (Hard Evidence)

- Every slice **passes the deployability test** and is independently shippable
  within the team's domain.
- Every emitted block is **complete against the Output Contract** (no missing
  flag/data-source/GWT field).
- Target metrics the decomposition must satisfy: story cycle time **<2 days**,
  **~100%** of items independently deployable, **0** cross-team deploy
  dependencies per slice. "Seems small enough" is NOT evidence.
