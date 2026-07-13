# Skills Readiness Audit — agent- & stack-agnostic consumption

> Audited 2026-07-08 against the live repo (29 skills in `.ai/skills/`, 26
> workflow files in `.agents/workflows/`, manifest, README, `install.sh`,
> `scripts/validate-skills.sh`, MCP server). Every finding below was verified by
> command, not assumed. Remediation is **PROMPT 8** at the bottom —
> parallel-safe with Prompts 1–3, **must merge before Prompt 4** (the dev-team
> orchestrator consumes these skills).

## Readiness standard (what "ready" means here)

A skill is ready for the new architecture when a human _or_ any agent —
Antigravity, Cursor, Continue/VS Code, the read-only web UI, or the WS-4
orchestrator — can (1) **discover** it, (2) know **which runtime modes** it
supports before invoking it, and (3) be held to its **evidence gate**. Today
discovery is inconsistent per IDE, modes are prose in 8 files and absent in 21,
and two skills have no evidence language.

---

## Findings

### F1 — Registration drift: discovery differs by surface (HIGH)

The MCP server **globs the directory** (`fs.readdir`,
`src/mcp-server/handlers.ts:31`) so Antigravity/MCP sees all 29 skills. But
`install.sh` installs Cursor skills **from the manifest** (`install.sh:69` reads
`.ai/cursor-skills.manifest`), and the README table is hand-maintained. Result —
the same repo exposes three different skill sets:

- **11/29 skills absent from the manifest** (invisible to Cursor installs):
  `agent-optimizer`, `design-system-review`, **`feature-orchestrator`**,
  `knowledge-manager`, `mission-control`, `operational-boundaries`,
  `planning-expert-quick`, **`reflexion-loop`**, `ui-spec-generator`,
  `verification-auditor`, `weekly-leadership-report`. The flagship orchestrator
  and the loop itself are on this list.
- **7/26 workflow files unregistered:** `design-system-review`,
  `feature-orchestrator`, `plan-quick`, `pr-design-review-init`,
  `reflexion-loop`, `ui-spec-generator`, `weekly-leadership-report`.
- **10/29 skills missing from the README table** (19 rows at `README.md:608`):
  the manifest list above minus `feature-orchestrator`/`planning-expert-quick`,
  plus `codebase-onboarding-intelligence`.

Some gaps may be _intentional_ ("Internal" support skills per `README.md:216`) —
but today intent and drift are indistinguishable. **Fix:** make intent explicit
in frontmatter (`surface: public | internal`) and **generate** the manifest and
README table from frontmatter, so drift becomes impossible (rule-bound →
deterministic, Fig. 5).

### F2 — Runtime modes are prose, and mostly missing (HIGH)

Only 8/29 skills carry any mode-conditional language (`accessibility-auditor`,
`ask`, `feature-orchestrator`, `planning-expert`, `planning-expert-quick`,
`pr-automator`, `reflexion-loop`, plus an IDE/MCP-conditional acquisition line
in `vertical-slice-decomposer`). The other 21 say nothing, so neither the web UI
(which must not imply write actions), nor the WS-4 crew-sizer (which routes
lanes), nor a Cursor agent can tell — before spending tokens — whether a skill
may execute or must hand off.

`feature-orchestrator` is the house model and its pattern is exactly right:
frontmatter promises _"produces a verifiable implementation blueprint in
read-only chat, and executes + verifies the implement phase in an IDE/MCP
agent"_, and its objection table hard-denies write claims in chat
(`.ai/skills/feature-orchestrator.md:104`). **Fix:** lift this into a
machine-readable frontmatter field on all 29 skills —
`modes: [read-only] | [read-only, write] | [read-only, write, mcp]` — plus a
one-line `## Runtime modes` body section, both enforced by `validate-skills.sh`.
Prose stays for humans; frontmatter serves machines.

### F3 — Stack coupling in `knowledge-manager` (MEDIUM)

The skill defines the KI system _as_ Antigravity's and hardcodes the backend
path — _"Knowledge Items are stored in `~/.gemini/antigravity/knowledge/`"_
(`.ai/skills/knowledge-manager.md:35`, echoed in `src/lib/ki/ki-service.ts`). In
Cursor/Continue that path is meaningless, yet the repo already exposes the
agnostic contract: MCP tools `list_knowledge_items` / `read_knowledge_item` /
`create_knowledge_item`. **Fix:** re-anchor the skill on the MCP tools as the
interface; demote the path to a "default backend (Antigravity)" note. Other
agent-name mentions (in `feature-orchestrator`, `planning-expert`,
`reflexion-loop`, `visual-verifier`, `security-audit`, `operational-boundaries`)
were checked and are compatibility notes, not requirements — standardize their
placement under `## Runtime modes` but no rewrite needed. `planning-expert`'s
Firecrawl-optional pattern (capability detection with graceful fallback) is the
model for optional tooling.

### F4 — Evidence gates missing in two skills (LOW)

`knowledge-manager` and `style-logic-exporter` contain no
paste/evidence/verification language at all — the only two of 29. Under Pillar 3
every skill must end in a verification gate, even documentation-shaped ones
(e.g., "paste the created KI's `read_knowledge_item` output").

### F5 — Cosmetic inconsistency (LOW)

`operational-boundaries` declares `cost: 1` while every other skill uses
`cost: ~N tokens` — breaks any cost parser and the README footprint column.

### Not findings (checked, fine)

Frontmatter `name`/`description`/`cost` present on all 29 ✓ · MCP surface
complete via readdir ✓ · workflow mirrors exist for the major skills ✓ ·
`validate-skills.sh` + prettier + markdownlint wired in CI ✓.

---

## PROMPT 8 — Skills readiness pass (feed to Jules)

> Prepend **PROMPT 0 — Standing Rules** from `2026-07-08-jules-prompts.md`.
> Parallel-safe with Prompts 1–3. **Must merge before Prompt 4.**

STANDING RULES for bronz3beard/ai.tech-lead-stack (read before anything else):

1. FOUR PILLARS are non-negotiable and grade your output: (1)
   G-Stack/Diagnosis-First: begin with Phase 0 — inspect package.json,
   tsconfig.json, prisma/schema.prisma, and the files named in the task BEFORE
   writing code. Ground every decision in what actually exists. (2)
   MinimumCD/Atomic Batches: commit in vertical slices <100 LOC each, every
   commit independently verifiable. Never one big-bang commit. (3)
   Production-Grade Ethos: no "add tests later", no "seems right". Every slice
   ends with hard evidence (test output, tsc output) pasted into the PR
   description. If you catch yourself rationalizing a shortcut, stop and do it
   properly. (4) Modern Web Guidance: for anything UI/web-facing use modern,
   performant, accessible, secure APIs (Server Components, Zod validation,
   semantic HTML/ARIA). No legacy workarounds.
2. GIT DISCIPLINE: work only on the feature branch named in the prompt. Never
   merge, never touch main, never force-push. Deliver via a single PR. (This
   extends .ai/agents.md, which forbids agents from git push/git add in user
   checkouts; as a cloud agent you may commit to YOUR OWN branch only.)
3. CODE STYLE: strict TypeScript (no `any` unless justified in a comment), early
   returns, Zod validation on every API payload and external input, Prettier +
   markdownlint clean (npm run format:check, npm run lint pass).
4. VERIFICATION COMMANDS you must run and paste before opening the PR: npm run
   check-types && npm test && npm run validate:skills (plus any task-specific
   commands listed in the prompt).
5. Do not rename, move, or "improve" existing files outside the prompt's scope.
   If you believe something out of scope is broken, note it in the PR
   description under "Observed friction" instead of fixing it — this repo treats
   agent-reported friction as first-class input.

**Branch:** `feat/skills-readiness-pass`

**Context — read first:** `docs/designs/2026-07-08-skills-readiness-audit.md`
(this file, findings F1–F5), `.ai/skills/feature-orchestrator.md` (the
runtime-mode house model), `templates/SKILL_TEMPLATE.md`,
`scripts/validate-skills.sh`, `.ai/cursor-skills.manifest`, `README.md` lines
600–660, `install.sh` lines 60–110, `src/mcp-server/handlers.ts`.

**Your Task:**

1. **Frontmatter contract (all 29 skills):** add two fields to every file in
   `.ai/skills/`: `modes:` — a YAML list drawn only from `read-only`, `write`,
   `mcp` (every skill includes `read-only`; add `write` iff the skill edits
   files/runs commands; add `mcp` iff it requires MCP tools such as `get_skill`,
   KI tools, or `verify_mission_alignment`); and `surface:` — `public` or
   `internal`. Derive `modes` from each skill's own body text; when the body is
   ambiguous, choose the _narrower_ mode set and note it in the PR description.
   Mark as `internal` only skills whose body text describes them as
   support/internal logic; when unsure, `public`.
2. **`## Runtime modes` section (all 29 skills):** one or two lines, immediately
   after the title, following the `feature-orchestrator` pattern: what the skill
   delivers in read-only chat, and what it additionally does in a write-capable
   IDE/MCP agent. No agent brand names in the normative sentence; put
   compatibility notes ("tested in Antigravity, Cursor, Continue") on a separate
   line if the skill already had them.
3. **Registry generation (kills F1 permanently):** create
   `scripts/generate-skill-registry.ts` (strict TS, Zod-parse the frontmatter)
   that emits: (a) `.ai/cursor-skills.manifest` — every `surface: public` skill
   plus every workflow file, preserving the existing `name|path` format and the
   `workflow-` prefix convention and current header comments; (b) the README
   skill table, rewritten **only** between new markers
   `<!-- SKILLS_TABLE:START -->` / `<!-- SKILLS_TABLE:END -->` which you place
   around the existing table at `README.md:608` — columns unchanged, rows now
   include a Modes column, `internal` skills listed in a small separate table
   beneath. Add npm script `"generate:registry"`. Commit the regenerated
   manifest + README in the same commit as the generator.
4. **Validator upgrade (deterministic gate):** extend
   `scripts/validate-skills.sh` to fail on: missing/invalid `modes` or
   `surface`; `cost` not matching `~N tokens`; and — via a call into
   `generate-skill-registry.ts --check` — any drift between frontmatter and the
   committed manifest/README table (generate to a temp file and diff). Keep
   GitHub-Actions error-annotation output style.
5. **F3 fix:** rewrite `knowledge-manager.md`'s storage paragraph to present the
   MCP KI tools as the interface and `~/.gemini/antigravity/knowledge/` as the
   default backend note. Do not touch `src/lib/ki/ki-service.ts` (out of scope —
   file a friction note if you believe it needs the same treatment).
6. **F4 fix:** add a `## Verification Gate` (evidence-pasting, Pillar 3) to
   `knowledge-manager.md` and `style-logic-exporter.md`, matching the register
   of gates in sibling skills.
7. **F5 fix:** `operational-boundaries` → `cost: ~400 tokens` (estimate from its
   actual length; state your count in the PR).
8. **Template:** update `templates/SKILL_TEMPLATE.md` with the two new
   frontmatter fields and the `## Runtime modes` section so future skills
   inherit the contract.

**Strict Technical Requirements:** additive frontmatter only — never rename
`name`/`description`; do not alter any skill's instructional logic beyond the
sections named above; generator must be idempotent (running twice produces zero
diff); Zod for all parsing, early returns, no `any`.

**Execution Steps (atomic commits):** (1) template + validator vocabulary; (2)
frontmatter + Runtime-modes across skills in 3–4 commits grouped alphabetically;
(3) generator + regenerated manifest/README; (4) validator `--check` wiring; (5)
F3/F4/F5 fixes.

**Acceptance Criteria:**

- [ ] `pnpm validate:skills` fails if any skill lacks `modes`/`surface`, and
      fails on manifest/README drift (prove by temporarily breaking one, paste
      both failing and passing output).
- [ ] `pnpm generate:registry` twice in a row → `git status` clean (paste).
- [ ] Cursor manifest now lists all `public` skills incl. `feature-orchestrator`
      and `reflexion-loop`; the 7 orphan workflows are registered or their files
      carry `surface: internal`.
- [ ] README table row count == public skill count; Modes column present.
- [ ] `pnpm check-types && pnpm test && pnpm validate:skills && pnpm lint`
      output pasted.
- [ ] No skill's instructional body changed outside Runtime modes / Verification
      Gate / the `knowledge-manager` storage paragraph (state this explicitly;
      the diff proves it).

**Out of Scope:** `install.sh` logic changes; `ki-service.ts`; MCP server; any
WS-1..7 code; creating new skills.
