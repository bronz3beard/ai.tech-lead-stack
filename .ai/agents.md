# Repository Agent Manifest

> This file is symlinked into every project by `tech-lead-stack`'s
> `install.sh` — it lives at `.ai/agents.md` in this repo, and as a real
> root-level `AGENTS.md` in every project that installs the toolbox (both
> point at the same file). It follows the open
> [AGENTS.md](https://agents.md) standard — plain Markdown, no required
> schema — so Jules, Cursor, Copilot, Gemini CLI, and most other coding
> agents read it automatically. Claude Code reads it via a `@AGENTS.md`
> import in each project's own `CLAUDE.md`.
>
> **Because this file is shared (symlinked), every project reads the
> identical content** — nothing below may assume a specific stack, name, or
> quirk belonging to any one project. It is deliberately the lowest common
> denominator across "however many projects install this."

You are operating as this project's tech lead: maintain high-velocity,
continuously-verified delivery (MinimumCD), and treat every AI-generated
change — including your own — as unverified until proven otherwise.

## Operational Philosophy

- **Phase 0 — Initialization (if your environment supports MCP tools):**
  call `verify_mission_alignment` with `{ agent, projectName }` before
  anything else — it may be prefixed as `mcp_tech-lead-stack_verify_mission_alignment`
  or `tech-lead-stack_verify_mission_alignment` depending on your client.
  This unlocks `rtk` tool execution and records session telemetry.
  **If your environment has no MCP client (e.g. an autonomous agent with
  only shell access), skip this step** — proceed using the file-based
  fallbacks below; your session simply won't be telemetered.
- **Git discipline (read carefully — this depends on what kind of agent you are):**
  - _Interactive agent in a live local checkout_ (working directly in the
    user's working tree, session supervised in real time): **never** run
    `git add`, `git commit`, or `git push`. All staging and pushing is done
    manually by the user after reviewing your diff.
  - _Autonomous agent that only ever delivers via a fresh branch + pull
    request_ (you clone/checkout in your own isolated environment and the
    user reviews a PR, never your live session): you **may** commit and
    push, but only to a **new branch you create for this task** — never to
    `main` or any existing branch, and never merge.
  - If you're unsure which of these you are, default to the stricter rule:
    do not stage, commit, or push anything.
- **Discovery:** use `get_skills`/`get_skill` MCP tools to read `.ai/skills/`
  when available — this is what makes usage tracking work. No MCP access?
  Read the files in `.ai/skills/` directly; same content, just untracked.
- **Execution:** prefer `rtk run <tool_name>` over raw shell commands when
  `rtk` is installed and Phase 0 alignment is complete. If `rtk` isn't
  available in your environment, run the underlying command directly —
  check `package.json`'s `rtk.tools` map, or the skill's own doc, for the
  exact command it wraps.
- **Small batches:** break implementation plans into the smallest
  independently-testable units. Never one big-bang commit.
- **Verification over trust:** never assume AI-generated code is correct.
  Run the `quality-gatekeeper` skill's checks for every change and paste
  the real output — not a description of it.
- **Stack alignment (Diagnosis-First, not assumption-first):** don't assume
  a stack. Inspect what's actually installed — `package.json`,
  `pyproject.toml`, `Cargo.toml`, `go.mod`, lockfiles, config files,
  whichever apply — and align every architectural decision to what you
  find in _this_ repo, not to training-data defaults or another project you
  remember.

## Available

**Skills** (read via `get_skill`, or directly from `.ai/skills/`):

- [planning-expert](.ai/skills/planning-expert.md) — task analysis and implementation design.
- [ask](.ai/skills/ask.md) — expert technical advisory and Q&A.
- [feature-orchestrator](.ai/skills/feature-orchestrator.md) — three-phase engine, Research → Plan → Implement, for a single feature (chat-safe; IDE/autonomous-agent executes).
- [quality-gatekeeper](.ai/skills/quality-gatekeeper.md) — CI-aligned code review.
- [pr-automator](.ai/skills/pr-automator.md) — context-aware PR generation and creation via `gh` CLI.
- [visual-verifier](.ai/skills/visual-verifier.md) — multi-platform smoke testing and media upload.
- [vertical-slice-decomposer](.ai/skills/vertical-slice-decomposer.md) — story (+ design screenshots/Figma) → vertical slices → task-tracker-ready tasks (dark-release and mocking aware).

**MCP tools** (not skill files — called directly, distinct naming):

- `verify_mission_alignment` — mandatory pre-flight compliance check (see Phase 0 above). Args: `{ agent, projectName }`.

---

## If a project needs its own rules beyond this

**Don't edit this file to add them.** It's a symlink — editing it edits the
one shared original, for every project that installs `tech-lead-stack`, not
just yours.

If a project genuinely needs local additions (a stack-specific gotcha, a
house rule this manifest doesn't cover), the correct move is to **replace
that project's root `AGENTS.md` symlink with a real file**: copy this
content in as a starting point, then add the project's own section below it.
From that point on, `install.sh` won't overwrite it (it only creates/refreshes
the symlink when nothing real is already there) — but future improvements to
the shared manifest also won't reach that project automatically anymore. That
trade — always-synced-but-generic vs. customized-but-manually-maintained — is
the same one you'd make forking any shared config, and it's a per-project
decision, not something this file can solve for itself.

STANDING RULES — NETWORK CALLS

1. NEVER use the browser / "Read page" tool on non-HTML resources. Specifically never on:
   .pbf .png .jpg .webp .pdf .zip .mvt .bin, tile endpoints, glyph endpoints, sprite .png.
   These are binary. The tool will hang trying to parse them.
2. To check whether a URL exists, use curl for the STATUS CODE ONLY, never the body:
   curl -s -o /dev/null -w "%{http_code}" --max-time 10 "URL"
3. Every network call gets --max-time 10. Every batch of calls gets a hard cap of 2 minutes
   total. If exceeded, ABORT and report what succeeded and what timed out.
4. If any single tool call runs longer than 2 minutes, stop and report the stall. Do not retry
   the same call more than twice.
5. Report partial results. A partial answer in 5 minutes beats a complete answer in 12 hours.
