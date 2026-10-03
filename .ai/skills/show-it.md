---
name: show-it
description: >
  Visual explainer for a codebase: answers "how does this work?" with a mermaid
  diagram, terminal mock, annotated screenshot, or tiny static HTML page instead
  of prose, choosing the cheapest visual that carries the idea. Never edits
  source; may write only under .ai/output/visuals/.
cost: ~2400 tokens
modes: [read-only, write, mcp]
surface: public
category: Discover & Define
how:
  'Phase 0 discovery, then picks the cheapest visual format the current surface
  can render.'
useCase:
  'Explain a flow, architecture, CLI or UI region visually instead of in words.'
phase: intent
kind: skill
domain: eng
ownership:
  drive: human-ai
  approve: human
targets: [local, api, subscription]
minModelClass: small
consumes: [intent-brief]
emits: [intent-brief]
suggests: [ask, feature-design-assistant, show-it-deep]
policies:
  - user-sovereignty
  - diagnosis-first
  - four-pillars
---

# Visual Explainer (Show, Don't Tell)

## Runtime modes

Advisory in **every** context, like `ask`, but the answer is a **visual**. Words
are capped at a title, a caption of at most two sentences, and a one-line text
alternative per visual. In read-only chat it returns inline visuals (mermaid,
text mocks). In an IDE/MCP agent that can write files it may also produce a
static HTML page or an annotated screenshot, but **only** under
`.ai/output/visuals/`. It never implements, refactors, or edits source.

> [!CAUTION] **WRITE GUARDRAIL (capability-based, not name-based)** The only
> permitted write effect is **creating new files under
> `.ai/output/visuals/<YYYY-MM-DD>-<slug>/`**. The only permitted command is the
> stack's screenshot tool (`visual-verifier`). Everything else is forbidden,
> whatever the tool is called: editing or deleting any other file, git
> operations, package installs (including installing visual tools), and mutating
> actions in apps or browsers. Before **every** tool call ask: _"Does this
> change bytes or state anywhere other than a new file under
> `.ai/output/visuals/`?"_ If **yes or unsure → don't.** Return an inline visual
> instead.

## 🧠 The Four Pillars (how this skill embodies them)

1. **G-Stack — Diagnosis-First.** Draw what the code _actually_ does. Every
   node, arrow, and callout must trace to a file, symbol, or command you have
   read. Never invent topology to make a picture tidier.
2. **MinimumCD — Small Batches.** One idea per visual. If a concept needs more
   than 15 nodes, split it into an overview plus zoom-in visuals rather than one
   "big-bang" diagram.
3. **Agent Skills — Evidence over Assumption.** Every visual ends with a
   **Source** line listing the `path:line` references it was drawn from, so the
   reader can verify it. "Looks right" is not evidence.
4. **Modern Web Guidance.** HTML output is semantic, accessible, script-free,
   and platform-native (see the HTML contract below). No CDNs, no frameworks.

## 🎯 Strategic Workflow

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Skill acquisition (NON-NEGOTIABLE):** load skills through the broker only.
  - **IDE / MCP-enabled agent:** call the MCP `get_skills` tool (may be prefixed
    `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills`).
  - **Chat UI (/chat):** call the internal `get_skill` tool.
  - Reading `.ai/skills/` or `.agents/workflows/` directly bypasses telemetry
    and is forbidden. This applies to **skill files only**.
- **Action:** read `package.json`, `tsconfig.json`, `pyproject.toml`, or the
  equivalent manifest to learn the language, framework, and structure.

### Phase 1: Contextual Analysis (read-only)

- Locate the files and line ranges that answer the question with read-only
  tools.
- Write down the facts the visual will show (actors, steps, data, boundaries)
  **before** choosing a format. The visual renders facts; it does not find them.

### Phase 2: Capability Check

Decide what this surface can do by **effect**, not by tool name:

- **Can write?** You have a tool that creates files.
- **Can exec?** You have a tool that runs shell commands.
- **Has browser?** The screenshot tool runs (exit code `30` = no browser).

If unsure about any capability, treat it as **absent**.

### Phase 3: Pick the Cheapest Adequate Format

Choose the first row that fits the idea **and** the capabilities.

| Idea shape                          | Format               | Needs              | Budget                          |
| :---------------------------------- | :------------------- | :----------------- | :------------------------------ |
| Flow, sequence, state, architecture | Mermaid block        | nothing            | ≤ 15 nodes                      |
| CLI usage, logs, command output     | Terminal mock        | nothing            | ≤ 40 lines, fenced `text`       |
| UI region, no browser available     | ASCII wireframe      | nothing            | ≤ 30 lines, fenced `text`       |
| Numbers, comparisons, layers        | Static HTML          | write              | ≤ 6 KB file                     |
| "What is this part of the UI?"      | Annotated screenshot | write+exec+browser | ≤ 8 callouts                    |
| Rich interactive architecture       | Best mermaid + note  | nothing            | suggest `show-it-deep`, see end |

Without write capability, render numbers as a markdown table or a mermaid
`xychart-beta`/`pie`, and return HTML as a fenced `html` block for the user to
save.

### Phase 4: Render

**Mermaid (Safe syntax, renders in GitHub, VS Code, and the web app):**

- Start with `graph TD` or `graph LR` (or `sequenceDiagram` /
  `stateDiagram-v2`).
- One node definition per line. Define a node before any edge references it.
- Quote every label containing paths, dots, slashes, or parentheses:
  `A["src/lib/fs-service.ts"]`.
- Square `[..]` or round `(..)` nodes only. Labels ≤ 40 chars, single line.
- Edge labels ≤ 20 chars: `-->|reads|`.
- If the user reports a broken render, regenerate in **Safe Mode**: `graph TD`,
  square nodes, every label quoted, no special characters, ≤ 10 nodes.

**Terminal mock:** a fenced `text` block that looks like a real session: prompt
(`$`), command, and representative output taken from real code or docs. Mark
elided output with `…`. Never fabricate flags the CLI does not have.

**Static HTML contract:**

- Single file `index.html`, ≤ 6 KB, written to
  `.ai/output/visuals/<YYYY-MM-DD>-<slug>/`.
- `<figure>` + `<figcaption>`; inline `<svg role="img">` with a `<title>`.
- Inline `<style>` only; system font stack; `prefers-color-scheme` light and
  dark; text contrast ≥ 4.5:1.
- **No `<script>`, no external fonts, images, stylesheets, or CDNs.** It must
  render identically offline and inside a `sandbox=""` iframe.

**Annotated screenshot:**

1. Run the stack's screenshot tool with the target URL and
   `--out-dir .ai/output/visuals/<YYYY-MM-DD>-<slug>` (via
   `./.ai/rtk-run run visual-verifier` in linked projects, or
   `node scripts/visual-verifier.mjs` in this repo). Read the JSON manifest on
   stdout.
2. If the exit code is `30`, or a shot status starts with `rejected_`, stop and
   fall back to an ASCII wireframe. Say which status you got. Never attempt to
   bypass an auth wall.
3. View one captured PNG, then write `index.html` beside it: the `<img>` plus an
   absolutely positioned SVG overlay of numbered callouts and a matching legend.
   Follow the static HTML contract.

### Phase 5: Deliver

Structure every answer as:

- **Title:** one line.
- **The Visual:** inline block, or the path of the generated file.
- **Caption:** ≤ 2 sentences on what to notice.
- **Alt:** one-line text alternative (always required, for accessibility).
- **Source:** `path:line` references the visual was drawn from.

## 🚫 Anti-Rationalization

| Excuse                                            | Correct response                                                                             |
| :------------------------------------------------ | :------------------------------------------------------------------------------------------- |
| "A paragraph would be clearer here."              | Pick the simplest visual. If prose truly wins, say so and suggest `ask`.                     |
| "This diagram belongs in `docs/`."                | Write it under `.ai/output/visuals/` and give the path; the user moves it.                   |
| "I'll install a diagram tool to do it better."    | Installs are forbidden. Name the tool and its install command; the user decides.             |
| "One more node will make it complete."            | Over 15 nodes means split into overview + zoom-in visuals.                                   |
| "I can infer this connection."                    | Draw only what you read. Mark anything unverified as dashed and label it `unverified`.       |
| "The user asked me to fix what the visual shows." | `show-it` is advisory. Suggest a write-capable skill for implementation; don't switch modes. |

## Heavier Visuals

For rich, interactive diagrams (search, path tracing, export), deliver the best
mermaid version first, then mention the `show-it-deep` skill: it builds an
explorable HTML diagram with archify, a tool the user installs separately, at
roughly 3-5x the token cost. Never install anything yourself.

## Operational Constraints

1. **Visual-first:** words are limited to title, caption, alt, and source.
2. **Write scope:** new files under `.ai/output/visuals/` only; never anything
   else.
3. **Diagnosis-first:** complete Phase 0 and Phase 1 before drawing.
4. **Truthful:** every element traces to code you read.
5. **Token efficiency:** choose the cheapest format that carries the idea.
