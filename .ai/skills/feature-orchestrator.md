---
name: feature-orchestrator
description:
  The Three-Phase Engine. Orchestrates the full Research -> Plan -> Implement
  sequence for a single feature by chaining the specialist skills
  (feature-design-assistant, planning-expert / vertical-slice-decomposer,
  verification-auditor) into one governed loop. Runtime-aware: produces a
  verifiable implementation blueprint in read-only chat, and executes + verifies
  the implement phase in an IDE/MCP agent. Use from the feature-discovery chat
  to drive a change end-to-end in the sandbox app.
cost: ~1400 tokens
---

# Feature Orchestrator (The Three-Phase Engine)

> [!IMPORTANT] **User Sovereignty & Persistence**: We advise; the User Tech-Lead
> decides. The reward is resolving the feature to an extremely high standard,
> not merely "finishing". **Methodology Alignment**: G-Stack (Diagnosis before
> Advice), MinimumCD (atomic batches, vertical slices, continuous verification),
> Agent Skills (Process over Prose, Anti-Rationalization), Modern Web Guidance.
>
> **Relationship to `mission-architect`:** that skill is the heavy multi-feature
> strategy engine (Strategy→Research→Plan→Deliver). This is the lean
> **single-feature** Research→Plan→Implement loop optimised for the
> discovery-chat → sandbox-implement workflow.

<!-- -->

> [!CAUTION] **RUNTIME MODE (DETERMINE FIRST — NON-NEGOTIABLE)**
>
> - **Read-only chat (`/chat`):** write/exec tools are forbidden; only
>   `get_skill`, `list_skills`, `read_file` exist. Run Phase 1 + Phase 2 fully
>   and deliver Phase 3 as a **verifiable implementation blueprint + handoff**.
>   Treat every "implement/fix/modify" request as "analyse and propose".
> - **IDE / MCP agent (Antigravity, Cursor, Claude Code):** write tools exist.
>   Execute Phase 3 in the sandbox and capture hard verification evidence.
> - **Never fake the boundary:** do not claim files were changed in chat. State
>   the mode you are in once, then proceed.

## Phase 0: Skill Acquisition & Discovery (MANDATORY)

- **Skill enforcement (NON-NEGOTIABLE):** IDE/MCP agent MUST call `get_skills`;
  Chat MUST call `get_skill`. Never read `.ai/skills/` via raw file access.
- **Stack ID:** Inspect `package.json`, `tsconfig.json`, framework + CI config
  to anchor conventions before any advice. Ignore unrelated workspace noise
  (Goal Drift Guard, per `operational-boundaries`).
- **Mission frame:** Restate the feature in one sentence + its success metric.
  Hold this as the spine the three phases must serve.

## Phase 1: Research (Chain → `feature-design-assistant`)

- **Action:** Acquire and run `feature-design-assistant` to translate the
  request into a methodology-compliant spec: existing patterns to reuse, data
  model, contracts, and the layers touched.
- **Design inputs (when provided):** treat user screenshots / Figma URLs as
  in-scope spec; chain `ui-spec-generator` and `design-system-review` (read
  Figma via the connector when available). Capture states/variants shown.
- **Exit gate:** a clear problem statement, reuse map, and contract sketch. No
  plan begins until Research names the real touchpoints.

## Phase 2: Plan (Chain → `planning-expert` / `vertical-slice-decomposer`)

- **Action:** Delegate decomposition. Default to `vertical-slice-decomposer` for
  user-facing features (thin, independently deployable slices <=2 days, each
  with a dark-release + mock-vs-real decision); use `planning-expert` for
  refactors/architecture-heavy work.
- **Validation:** every item passes the deployability test (observable
  behaviour, no cross-team blocker, behaviour-not-layer). Order simplest-first;
  edge cases scheduled immediately after the happy path.
- **Exit gate:** an atomic, commit-ready task list mapped to the success metric.

## Phase 3: Implement & Verify (Chain → `verification-auditor`)

- **Read-only chat:** STOP at a per-slice **implementation blueprint**: target
  files, contract/schema delta, the exact CLI verification commands, and the
  developer technical prompt. Deliver the handoff; do not pretend to execute.
- **IDE / MCP agent:** execute the first slice in the sandbox, then run
  `verification-auditor` (and `code-review-checklist` / `visual-verifier`) to
  capture fresh evidence. Repeat per slice; keep trunk green; integrate daily.
- **Exit gate:** hard evidence (test/build output or screenshots) per slice.
  "Seems to work" is not evidence.

## 🔄 Remediation Loop (Chain → `regression-bug-fix`)

- **Trigger:** verification or human review fails, or the conversation drifts
  into deep error resolution for one slice.
- **Action:** switch to `regression-bug-fix`, resolve, fold the outcome back
  into that slice, then **return to the active phase** — never abandon the
  sequence mid-loop.

## 📡 Telemetry (Phase visibility — do not skip)

Each phase is driven by acquiring its specialist skill via `get_skill(s)`, so
every phase emits a `skill:<name>` trace. This is what lights up the dashboard's
**Research → Plan → Implement** tracker. Skipping skill acquisition both breaks
governance AND blanks the phase metrics.

## ⚖️ Anti-Rationalization (MANDATORY)

| Excuse                                                    | Rebuttal                                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| "I'll just plan and implement, skip Research."            | **Denied.** Unresearched plans invent the wrong touchpoints; Research is the cheapest phase to be wrong in. |
| "I already know the skills, no need to call `get_skill`." | **Denied.** Acquisition is the governance + telemetry contract; without it the phase tracker is blind.      |
| "I changed the files." (in chat)                          | **Denied.** `/chat` is read-only. Deliver a blueprint + handoff; the IDE agent implements.                  |
| "One big commit at the end is fine."                      | **Denied.** MinimumCD: thin vertical slices, integrate daily, verify per slice.                             |
| "Ship the happy path, log the rest."                      | **Denied.** Edge cases follow the happy path immediately, not someday.                                      |

## 🚩 Red Flags (STOP & Pivot)

- **Phase skipped or out of order** (planning with no Research; implementing
  with no Plan).
- **Mode confusion** — proposing write actions in read-only chat.
- **Orphaned remediation** — dived into a bug and never returned to the phase.
- **Monolithic plan** — a slice exceeding 2 days or touching unrelated files.
- **No evidence** — a slice marked done without test/build/screenshot output.

## ✅ Verification Gate (Hard Evidence)

- All three phases are accounted for, in order, each via its specialist skill.
- Plan items are independently deployable; Implement (or its blueprint) carries
  explicit per-slice verification commands.
- Target metrics: story cycle time <2 days, ~100% items independently
  deployable, fresh evidence captured at every milestone.
