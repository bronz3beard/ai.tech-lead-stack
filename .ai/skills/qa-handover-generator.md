---
name: qa-handover-generator
description: >
  Produces a QA handover + universal smoke-test criteria document for a changed
  feature and delivers it to ClickUp. Splits behaviour by architecture/state
  pattern, states the single source of truth per pattern (from real code), and
  emits smoke-test acceptance criteria that are both agent-ingestible (for
  generating formal acceptance criteria) and directly followable by a human
  tester. All ClickUp output is rendered through the shared clickup-format
  module (single source of truth for ClickUp formatting).
cost: ~950 tokens
modes: [read-only, write, mcp]
surface: public
category: Ship & Communicate
how:
  'Performs Phase 0 G-Stack discovery of state architecture, maps components to
  server-driven vs client-side patterns, and renders ClickUp markup via the
  clickup-format module.'
useCase:
  'Generating high-fidelity QA handovers and smoke test checklists for
  developers and automated testing agents.'
---

# QA Handover Generator

## Runtime modes

Produces a verifiable QA handover in read-only chat, and in an IDE/MCP agent
renders it via the shared ClickUp formatter and creates it in ClickUp (with a
file fallback).

**Persistence & Quality Mindset**: There is no reward for completion. The reward
comes from a handover accurate enough that a QA engineer — or an agent ingesting
it — can derive correct acceptance criteria without re-reading the source.
Persist until the architecture split and the single-source-of-truth per pattern
are stated correctly and render correctly in ClickUp.

> [!IMPORTANT] **Diagnosis before Advice**: Every handover begins with
> **Architecture Discovery**. Identify how the feature actually manages state
> (server-driven vs client/in-memory, which hook/query owns the source of truth,
> where filtering executes) BEFORE writing any smoke-test criteria. A handover
> built from assumption instead of the real code is a failed handover.
>
> **Methodology Alignment**: This skill strictly adheres to the four core
> pillars: **G-Stack Ethos**, **MinimumCD**, **Agent Skills**, and **Modern Web
> Guidance**.

<!-- -->

> [!CAUTION] **ClickUp formatting is NOT hand-rolled.** All ClickUp output MUST
> be produced via the shared module `scripts/clickup-format.ts` (headings, bold,
> code, bullets, checklists, tables, document assembly). Never format ClickUp
> markdown inline in this skill — the shared module is the single source of
> truth so formatting stays consistent and testable across every ClickUp-
> producing skill. If ClickUp rendering needs a fix, fix it in that module once.

## 🎯 Handover Gates

### Phase 0: Skill Acquisition & Architecture Discovery (MANDATORY)

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is
    strictly prohibited for skill reading.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which
    may be prefixed as `mcp_tech-lead-stack_get_skills` or
    `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

- **Scope the change:** Identify exactly which modules/screens/components the
  change touches. The handover covers the feature under test, nothing else.
- **Discover the state architecture (the core of this skill):** From the real
  code, determine how state is managed for the feature under test. Distinguish
  the patterns that actually apply (name only what the code uses):
  - **Server-driven** (e.g. URL query string is the source of truth; a hook
    parses URL state and maps it to server query variables; sort/paginate/filter
    round-trip to the server).
  - **Client-side / in-memory / offline-first** (e.g. a static query fetches all
    records once; sort/search/filter execute in-memory; URL may hold filter
    state for deep-linking but no server round-trip on change).
  - Any other real pattern (cursor-paginated, optimistic-update, event-driven…).
- **Per pattern, extract the mechanics** a tester needs: single source of truth,
  the owning hook/query/function BY REAL NAME, where filtering/sorting executes,
  reset behaviours (e.g. offset reset on tab change), browser/history/offline
  integration.
- **Scoped discovery only:** exclude `node_modules`, `.next`, `.nx`, `dist`,
  `build`. No unscoped recursive searches.

### Gate 1: Architecture Overview (verified against code)

- **Positive (Pass):** The handover opens with an Architecture Overview split by
  the state patterns actually found. For EACH pattern: target modules, single
  source of truth, mechanism (named hooks/queries/functions), and
  pattern-specific behaviours (resets, history, offline). Every claim traces to
  real code.
- **Negative (Fail):** Generic overview, a pattern the code does not use, or
  named symbols that do not exist. Rendered with `clickup-format` headings +
  tables/lists.

### Gate 2: Universal Smoke-Test Acceptance Criteria

- **Positive (Pass):** For EACH pattern, smoke-test criteria covering general
  usage and core user flows (NOT edge cases): sort, paginate, filter, search,
  tab switch, navigate — each with its expected observable result and any
  pattern-specific gotcha (e.g. "server-side pagination offset is zero-indexed:
  offset=0 is page 1"; "client-side table issues no server request on filter
  change — manipulation is immediate/in-memory").
- **Dual-audience rule:** Each criterion MUST be (a) concrete enough for an
  agent to convert into formal acceptance criteria, AND (b) followable
  step-by-step by a human doing it manually. Render criteria as ClickUp
  checklist items via `clickup-format.checklist(...)` so QA can tick them off.

### Gate 3: Testability & Environment Notes

- **Positive (Pass):** States what the tester needs to run the smoke tests
  locally: which modules/URLs to visit, auth/role requirements, offline/PWA
  considerations, how to observe state (e.g. URL query string for server-driven
  tables), and where behaviour differs by environment (live vs seeded/offline)
  so QA does not report false failures.

### Gate 4: ClickUp Delivery

- **Render:** Build the entire document through `scripts/clickup-format.ts`
  (`h2`/`h3`, `bold`, `code`, `bullets`, `checklist`, `renderTable`, `section`,
  `assembleDocument`). Do not concatenate raw markdown by hand.
  - **Tables:** call `renderTable(table, mode)`. Default `mode` is `'list'`
    (guaranteed to render correctly in ClickUp). Only pass `'pipe'` if
    pipe-tables have been confirmed to render in the target ClickUp context. The
    mode is the ONLY table decision — never hand-write table syntax.
- **Create in ClickUp (primary path):** When the ClickUp MCP is connected AND a
  destination is provided (space/folder/list/doc id + title), create the
  handover via the ClickUp MCP tools — prefer `clickup_create_document` /
  `clickup_create_document_page` for a handover Doc, passing the rendered
  content. Confirm the created doc's headings, table, checkboxes and code render
  correctly.
- **File fallback (no destination / no MCP):** write the same rendered content
  to `.ai/output/qa-handovers/<feature>-handover.md` for manual paste into
  ClickUp.
- **Opt-in:** never create in ClickUp without an explicit destination.

## Handover Structure (rendered via clickup-format)

```md
# QA Handover & Universal Smoke Test Criteria: <Feature>

## 1. <Feature> Architecture Overview

<framing paragraph>
### A. <Pattern name>   (e.g. Server-Side / URL-Driven)
- **Target Modules:** <real names>
- **Single Source of Truth:** <what owns state>
- **Mechanism:** `<hook/query/fn>` — <how controls map to state/server>
- <pattern-specific behaviours>
### B. <Pattern name>   (e.g. Client-Side / In-Memory / Offline-First)
- **Target Module:** <real names>
- **Mechanism:** `<query/wrapper>` — <fetch/hold data>
- **Filtering & Search:** <where filtering executes>
- **Performance / Offline:** <what to expect>

## 2. Universal Smoke Test Acceptance Criteria

### <Pattern A> Smoke Tests (Verify on <modules>. Note: <gotcha>.)

- [ ] <interaction> → <expected observable result>

### <Pattern B> Smoke Tests (Verify on <module>. Important: <gotcha>.)

- [ ] <interaction> → <expected observable result>

## 3. Testability & Environment Notes

- **Local run:** <URLs/modules>
- **Auth/role:** <requirement>
- **Data/offline:** <seeded data / PWA / env differences>
```

## Telemetry

When invoked via MCP skill tools, pass telemetry overrides
`{ teamRole: "qa", actorType: "AGENT", loopRunId: "<MISSION_ID>" }` so the
handover generation is attributed on the Agentic Health dashboard.
