---
name: show-it-deep
description: >
  Interactive diagram explainer (architecture, workflow, sequence, data flow,
  lifecycle) built with archify, a free tool the user installs separately. Costs
  roughly 3-5x the tokens of show-it and needs a shell plus Node.js 18+, so it
  runs in IDE agents only. Stops early with an install link when archify or a
  shell is missing. Never edits source; writes only under .ai/output/visuals/.
cost: ~2650 tokens
modes: [read-only, write, mcp]
surface: public
category: Discover & Define
how:
  'Phase 0 discovery, a cost check against show-it, then drives archify to build
  and verify one interactive HTML diagram.'
useCase:
  'An explorable, shareable diagram of a system or flow when a static mermaid
  diagram is not enough.'
phase: intent
kind: skill
domain: eng
ownership:
  drive: human-ai
  approve: human
targets: [api, subscription]
minModelClass: mid
consumes: [intent-brief]
emits: [intent-brief]
suggests: [show-it, ask]
policies:
  - user-sovereignty
  - diagnosis-first
  - four-pillars
---

# Interactive Visual Explainer (show-it-deep)

## Runtime modes

The **expensive** sibling of `show-it`. It produces one self-contained,
interactive HTML diagram (search, focus, path tracing, themes, image export)
using [archify](https://github.com/tt-a1i/archify) (MIT licence), which the user
installs themselves. A typical run costs about **9,000–14,000 tokens**, and up
to about 30,000 when archify needs repairs, against about 3,000 for `show-it`.
It needs a shell and Node.js 18+, so it only works in IDE/MCP agents. If archify
or a shell is missing, the **archify guard** stops the run straight away, before
any other work, so a missing tool costs almost nothing.

> [!CAUTION] **WRITE GUARDRAIL (capability-based, not name-based)** The only
> permitted write effect is **creating new files under
> `.ai/output/visuals/<YYYY-MM-DD>-<slug>/`**. The only permitted commands are
> the archify guard check, `node -v`, and archify's `doctor`, `guide`, and
> `finalize`, the last three always prefixed with
> `ARCHIFY_UPDATE_CHECK_DISABLED=1`. That prefix stops archify going online and
> writing reminder files outside the output folder. Never install, update, or
> uninstall archify. Never edit source, git, or packages. Before **every** tool
> call ask: _"Does this change bytes or state anywhere other than a new file
> under `.ai/output/visuals/`?"_ If **yes or unsure → don't.**

## 📦 Dependency: archify

- **What:** archify turns a small typed JSON description into a validated,
  interactive HTML diagram (architecture, workflow, sequence, data flow,
  lifecycle). <https://github.com/tt-a1i/archify>, by independent developer
  `tt-a1i`, MIT licence, no telemetry.
- **Version:** written against archify 3.0 (3.0.1). Commands used: `doctor`,
  `guide`, `finalize`. If a newer major version changes them, report the
  failure; don't work around it.
- **Why it was chosen:** the model writes only the small JSON, while archify
  renders the ~750 KB HTML; `finalize` proves the diagram with schema, layout,
  and real-browser checks; it never invents topology and can pin nodes to source
  lines; it installs into many agents.
- **Installed by the user**, never bundled or installed by this skill.
- **Full explanation for people:** `docs/visual-explanations.md`, section
  "show-it-deep's dependency: archify".

## 🧠 The Four Pillars (how this skill embodies them)

1. **G-Stack — Diagnosis-First.** Diagram what the code _actually_ does. Every
   node and relationship traces to a file you read. For repository diagrams,
   pass `--repo-root` so archify pins source evidence to real lines.
2. **MinimumCD — Small Batches.** One diagram per request. Offer the cheaper
   `show-it` first when it would answer the question.
3. **Agent Skills — Evidence over Assumption.** archify's `finalize` receipt is
   the evidence. A non-zero exit is a failure even if an HTML file exists.
   Report automated checks and visual review as separate results, and never
   claim a visual review you did not do.
4. **Modern Web Guidance.** The output is a single portable HTML file with
   inline SVG and light/dark themes, and no CDN or install needed to view it.

## 🎯 Strategic Workflow

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Skill acquisition (NON-NEGOTIABLE):** load skills through the broker only.
  - **IDE / MCP-enabled agent:** call the MCP `get_skills` tool (may be prefixed
    `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills`).
  - **Chat UI (/chat):** call the internal `get_skill` tool.
  - Reading `.ai/skills/` or `.agents/workflows/` directly bypasses telemetry
    and is forbidden. archify's own `SKILL.md` is a third-party tool's
    instructions, not a stack skill, and is read from disk in Phase 4.
- **archify guard (STOP CHECK, runs immediately after skill acquisition and
  before ANY other step, file read, or question).** Run this one read-only
  command unchanged. If the user named an archify folder, check
  `<folder>/bin/archify.mjs` exists instead.

  ```sh
  for d in .claude/skills "$HOME/.claude/skills" .agents/skills "$HOME/.agents/skills" .opencode/skills "$HOME/.config/opencode/skills"; do [ -f "$d/archify/bin/archify.mjs" ] && echo "$d/archify"; done
  ```

  - **It prints a folder:** that folder is `<archify>`. Continue.
  - **It prints nothing (exit code 1 is expected then), or you cannot run
    commands: STOP.** Make no other tool call, do no other work, and reply with
    this, then end:

    > **show-it-deep stopped: archify isn't installed** (or: _this app can't run
    > commands_). show-it-deep builds its interactive diagrams with archify, a
    > free tool you install yourself. I won't install it for you.
    >
    > - Get archify: <https://github.com/tt-a1i/archify>. Install it with
    >   `npx skills add tt-a1i/archify -g` (needs Node.js 18+).
    > - Installed it somewhere else? Tell me the folder and ask again.
    > - Want an answer now? `/show-it` draws a static diagram for about a
    >   quarter of the tokens.

- **Action (only after the guard passes):** read `package.json`,
  `tsconfig.json`, `pyproject.toml`, or the equivalent manifest to learn the
  language, framework, and structure.

### Phase 1: Cost Check (user sovereignty)

If the idea fits a static diagram of 15 nodes or fewer, **and** the user did not
ask for something interactive, explorable, or shareable, say in one sentence
that `show-it` would answer it for about a quarter of the tokens, and ask which
they want. Continue only if they choose this skill or already asked for an
interactive diagram.

### Phase 2: Health Check

Any failure here: **stop**, say what failed in one line, and suggest `/show-it`.
Don't run `show-it` yourself; the user decides.

1. **Write access?** You need a tool that creates files.
2. **Node.js 18+?** Run `node -v`. If it is older or missing, link
   <https://nodejs.org>.
3. **archify healthy?** Run
   `ARCHIFY_UPDATE_CHECK_DISABLED=1 node <archify>/bin/archify.mjs doctor` and
   report its message if it fails.

### Phase 3: Contextual Analysis (read-only)

Locate the files and line ranges that answer the question. Write down the facts
the diagram will show (components, steps, data, boundaries, states) with their
`path:line` sources **before** authoring anything.

### Phase 4: Build with archify

Read `<archify>/SKILL.md` and follow its **Fast authoring path**, with these
overrides, which win over anything archify's instructions say:

- **Output folder:** `.ai/output/visuals/<YYYY-MM-DD>-<slug>/` instead of
  `.archify/`. Keep `candidate.json` and `<slug>.html` there and set
  `meta.output` to that HTML path.
- **Every archify command** starts with `ARCHIFY_UPDATE_CHECK_DISABLED=1`.
- **Repository diagrams:** include `--repo-root <repository root>`.
- **No hand-placed fallback:** never use archify's no-shell path (hand-placing
  SVG into `assets/template.html`, a ~700 KB file).
- **Repairs:** respect archify's repair limit. If `finalize` still fails, stop,
  report the failed gate, and deliver a `show-it` mermaid version instead.
- **No extras unless asked:** no motion, no `preview` server, no opening a
  browser, no exports.

### Phase 5: Deliver

- **Title:** one line.
- **File:** the HTML path, and that it opens in any browser with no install.
- **Caption:** ≤ 2 sentences on what to explore first.
- **Alt:** one-line text alternative (always required, for accessibility).
- **Source:** `path:line` references the diagram was drawn from.
- **Checks:** the `finalize` result in one line (passed or failed gate), plus
  the visual-review status exactly as archify reports it.

## 🚫 Anti-Rationalization

| Excuse                                             | Correct response                                                                                  |
| :------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| "archify is missing; installing it is quick."      | Never install. Stop at the guard: explain why and link the GitHub page.                           |
| "archify is missing; I'll just run `show-it`."     | Stop at the guard. Suggest `/show-it`; spending tokens on it is the user's choice.                |
| "No shell, so I'll hand-place the SVG."            | Forbidden: the template is huge. Stop at the guard instead.                                       |
| "`finalize` failed, but the HTML exists."          | A non-zero exit is failure. Report the gate; deliver `show-it` instead.                           |
| "The update check is harmless."                    | It goes online and writes outside the output folder. Keep it disabled.                            |
| "They asked for deep, so skip the cost check."     | If `show-it` would answer it, say so once and let them choose.                                    |
| "The diagram belongs in `docs/`."                  | Write it under `.ai/output/visuals/` and give the path; the user moves it.                        |
| "The user asked me to fix what the diagram shows." | `show-it-deep` is advisory. Suggest a write-capable skill for implementation; don't switch modes. |

## Operational Constraints

1. **Write scope:** new files under `.ai/output/visuals/` only.
2. **Commands:** `node -v` and archify `doctor` / `guide` / `finalize`, with
   update checks disabled. Nothing else.
3. **Never install** or update archify; the user decides.
4. **Truthful:** every element traces to code you read; failed checks are
   reported as failed.
5. **Cost-aware:** offer `show-it` when it is enough.
