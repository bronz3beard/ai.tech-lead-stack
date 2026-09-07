# ADR 0002: Lifecycle Paradigm (Nine Phases in Metadata)

## Context

Skills today are organized by team (`.ai/skills`, `.ai/pm-skills`,
`.ai/hr-skills`) and given one display `category` (e.g. "Plan & Harden"). That
tells us _who_ a skill is for, but not _which stage of building software_ it
belongs to, who is meant to run it (this is old thinking the who), or how it
hands work to the next step. Recognition of the ecosystem around the
software-development lifecycle so the repo is self-documenting, skills connect
to each other in a machine-readable way, and the runtime can reason about who
owns each step. We are moving from a role based model to a lifecycle based
model. We are moving from a category based model to a phase based model. This is
a paradigm shift in how we think about agent-based development and the future of
software engineering.

This decision defines that lifecycle model. It is deliberately a _metadata_
model, not a folder layout - see the "nine-in-metadata" rule below.

## Decision

### 1. Nine canonical phases

Every skill (except cross-cutting ones - see 3) belongs to exactly one phase.
The phase ids are frozen; tooling depends on them.

| #   | Phase         | id         | Drives (does the work) | Approves (signs off)    | What the stage is for                                          |
| --- | ------------- | ---------- | ---------------------- | ----------------------- | -------------------------------------------------------------- |
| 1   | Intent        | `intent`   | human-ai               | human                   | Capture what and why; frame the problem and the success metric |
| 2   | Specification | `specify`  | ai                     | human                   | Turn intent into a reviewable, testable contract               |
| 3   | Planner       | `plan`     | human-ai               | human                   | Break the spec into small, verifiable pieces                   |
| 4   | Builder       | `build`    | ai                     | human                   | Implement the pieces; produce reviewable changes plus evidence |
| 5   | Maintainer    | `maintain` | human-ai               | human-ai                | Keep the system healthy: debt, onboarding, knowledge           |
| 6   | Review        | `review`   | ai                     | ai (escalates to human) | Gate quality: correctness, security, accessibility, standards  |
| 7   | Scaler        | `scale`    | human                  | human                   | Performance, infrastructure, capacity, cost-at-scale           |
| 8   | Deploy        | `deploy`   | human                  | human                   | Ship: pull requests, changelogs, QA handover, release          |
| 9   | Polisher      | `polish`   | human-ai               | human-ai                | Refine the finish: UX, visual parity, styling                  |

### 2. The "nine-in-metadata" rule (the core decision)

The nine phases are authoritative **only as metadata** a `phase:` field in each
skill's frontmatter, compiled into the generated `skills.graph.json`. They are
**never** encoded as a directory structure. The runtime reads the frontmatter
and the compiled graph, so a file's location on disk never defines its phase.

Consequences of this rule:

- A skill's phase can be changed by editing one line of frontmatter and
  regenerating no file moves.
- Physical folders (if introduced at all) are optional ergonomics and must group
  by a _stable_ dimension (team or kind), never by phase.
- All nine phases are first-class and non-collapsible at the metadata layer.
  Nothing may fold Review into Maintainer, or Deploy into Scaler. (A compressed
  folder scheme was considered and rejected for exactly this reason: it dropped
  Intent, Review, and Deploy as first-class stages.)

### 3. The `kind` axis (for skills that span phases)

Some skills do not belong to a single phase. They declare a `kind` instead:

- `kind: skill` (default) - a normal single-phase skill.
- `kind: orchestrator` - drives multiple phases (e.g. `dev-team-orchestrator`,
  `feature-orchestrator`, `mission-architect`). It omits `phase` and instead
  declares `spans: [intent, specify, plan, build, review]`.
- `kind: policy` - encodes company/engineering practice and is loaded as a
  dependency by other skills (e.g. `operational-boundaries`).
- `kind: report` - cross-cutting reporting/communication (e.g. `daily-standup`,
  `weekly-leadership-report`).

### 4. The `domain` axis (kept separate from phase)

Each skill also carries a `domain`: `eng`, `product`, `hiring`, or `shared`.
Domain and phase are independent. A product skill and an engineering skill can
both be in the `specify` phase without being mixed together. This preserves the
existing team grouping while adding the lifecycle grouping on top of it.

### 5. The `ownership` axis (who does it, who approves it)

Each skill declares:

```yaml
ownership:
  drive: ai # human | ai | human-ai   → who executes the work
  approve: human # human | ai | none       → who signs off before it is "done"
  escalate: human # optional → who a failed/uncertain review goes to
```

Defaults follow the phase table in 1, but a skill may override them where its
own methodology specifies otherwise. This axis makes rules like "AI builds,
human approves" enforceable rather than aspirational (see ADR 0003 and the hooks
layer).

### 6. Typed artifact handoffs, backed by Knowledge Items

Phases connect by passing typed artifacts. Each skill declares what it reads and
produces:

```yaml
consumes: [{ type: spec, ki: feature-spec }]
emits: [{ type: plan, ki: implementation-plan }]
```

- `type` is validated against the artifact-type registry below (so the graph can
  check that every input a skill needs is produced somewhere upstream).
- `ki` is a Knowledge Item slug - the actual runtime handoff. `emits` writes a
  Knowledge Item (`create_knowledge_item`); `consumes` reads one
  (`read_knowledge_item`). Because Knowledge Items are filesystem-backed, the
  same handoff works offline, in the IDE, and in the cloud.

**Artifact-type registry (frozen):**

| type                               | produced by (phase) | consumed by (phase)    |
| ---------------------------------- | ------------------- | ---------------------- |
| `intent-brief`                     | intent              | specify                |
| `spec`                             | specify             | plan                   |
| `plan`                             | plan                | build, review          |
| `slice-set`                        | plan                | build                  |
| `diff`                             | build               | review                 |
| `evidence`                         | build, review       | deploy                 |
| `review-report`                    | review              | build (rework), deploy |
| `qa-handover`                      | deploy              | (human QA)             |
| `changelog` / `release`            | deploy              | (stakeholders)         |
| `design-tokens` / `screenshot-set` | polish              | review                 |
| `kb-item`                          | maintain            | any                    |

### 7. Frozen ids; consumed by tooling

The phase ids (1), the `kind` values (3), the `domain` values (4), and the
artifact types (6) are frozen. They are consumed by the skill validator, the
graph generator, the MCP server, and the dashboard. Changing them is itself an
ADR-level decision.

### 8. This is an iterative model

The taxonomy is versioned data, not code. Expect phase assignments to move as we
learn where work actually clusters. Two safeguards make that safe:

- **Dual-run:** the new axes are added _alongside_ the existing `category` and
  directory grouping and stay optional in the schema until backfill is complete.
  `category` is retired only after the phase grouping reaches parity.
- **Signals:** a skill that will not fit a phase, or an artifact `consumes` with
  no upstream `emits`, is treated as a signal that the model is wrong not the
  skill. These surface automatically as validation/drift failures.

## Consequences

- Positive: the repo becomes self-documenting by lifecycle; skills gain
  machine-readable connections; the runtime can route work and enforce
  ownership; the same model spans eng, product, and hiring.
- Cost: every skill needs new frontmatter (a one-time backfill), and two
  parsers/validators must learn the new fields.
- Reversible: because phases live in metadata and are dual-run with `category`,
  any part of this can be rolled back per phase without breaking the stack.

## Status

Accepted (proposed for `main`). Supersedes the display-only `category` axis as
the primary organizing principle once backfill (see the implementation runbook,
Phases 1-3) reaches parity. Related: ADR 0003 (Execution Targets).
