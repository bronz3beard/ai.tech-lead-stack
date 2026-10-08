# AI Impact Baseline - Architecture Design

> Design for the `ai-impact-baseline` skill: the same engineering metrics before
> and after AI entered a codebase, explained visually. Produced with
> `feature-design-assistant`; implemented in the same change.

## 🎯 Verification Gates Context

**1. Core Goal:** New functionality. Answer "what changed since we adopted AI?"
from the repository's own history, for any git host, with GitHub adding
pull-request, issue, CI and release metrics. Pause and ask the user for the
adoption date or range when the history cannot prove it. **2. Success Metric:**
(a) on a repo with an AI co-author trailer the cutoff is found without a
question; (b) on a repo without one the collector exits `20` and the skill asks
exactly one question; (c) both windows are the same length and a user-supplied
range is excluded from both; (d) every delta in the output carries before,
after, relative change and a direction reading, and a window under the minimum
sample is labelled anecdotal; (e) the skill is listed for every dashboard role
and installed to every IDE adapter through the generated surface index. **3.
Scope/Timeline:** Small (one day). **4. Architectural Layers:** Script
(`scripts/ai-impact-baseline.mjs`, pure functions plus a thin CLI), Skill
(`.ai/skills/ai-impact-baseline.md` +
`.agents/workflows/ai-impact-baseline.md`), Surfaces (dashboard role map and
skills catalogue; generated registry files).

## 🛠 Strategic Design Process

### Phase 1: Contextual Exploration

- The dashboard already defines "AI-assisted" for merged PRs in
  `apps/dashboard/src/lib/ai-impact.ts` (co-author trailer, "Generated with"
  body marker, AI agent author) and compares cohorts on medians and p75 with a
  minimum sample of 5. The skill reuses those definitions so both surfaces
  agree; the three regexes are duplicated in the script with a comment naming
  the source, because the script must run with zero dependencies inside any
  linked project.
- `show-it` owns the visual contract (mermaid, markdown, script-free static
  HTML, no installs). The new skill `requires` it rather than restating it.
- `visual-verifier.mjs` sets the script convention: JSON manifest on stdout,
  logs on stderr, exported pure functions tested with `node --test`.
- `rtk-run.sh` executes stack tools from the linked project's working directory,
  so the collector defaults to analysing `process.cwd()`.

### Phase 2: Approach Exploration (The Fork)

- **Option A (The G-Stack Way, chosen):** a deterministic collector script plus
  a skill that orchestrates, pauses on an unknown cutoff, qualifies the result
  and renders it through `show-it`. JSON is the contract for anyone who wants
  their own visual. No new dependencies.
- **Option B (The Fast Way):** a prompt-only skill that runs `gh` and `git` by
  hand. Rejected: pagination and cohort maths done ad hoc per run are
  non-reproducible and token-expensive.
- **Option C (The Scalable Way):** a dashboard panel backed by the existing
  `GitHubClient`, with a charting library. Rejected for now: it would not work
  for non-GitHub hosts or in IDEs, and the dashboard's AI-impact panel already
  covers the "AI vs human within a window" view.

### Phase 3: Architectural Presentation

1. **The Data Model:** `report.json` with `cutoff` (start, end, source,
   detected), `windows` (days, before, after), `git.before/after`,
   `github.before/after`, `deltas.*` (before, after, absolute, relative,
   direction, favourable) and `series.weekly`. No database changes.
2. **The Logic:** pure functions `parseGitLog`, `detectFirstAiCommit`,
   `splitWindows`, `commitStats`, `prStats`, `issueStats`, `ciStats`,
   `releaseStats`, `buildDeltas`, `renderMarkdown`; `gh api` reads behind a
   capability check (GitHub origin and signed-in CLI); no other host API.
3. **The Interface:** CLI flags `--cutoff`, `--cutoff-end`, `--window-days`,
   `--branch`, `--out-dir`, `--no-github`, `--detect-only`; exit codes `0`, `2`,
   `20` (ask the user), `30`. Registered as the `ai-impact-baseline` rtk tool.
   The skill is a `report` in the `scale` phase that emits `evidence`.
4. **The Proof:** `scripts/__tests__/ai-impact-baseline.test.mjs` covers
   parsing, signal detection, window maths (equal length, excluded range,
   refusal on missing history), every stats function, deltas and rendering;
   `workflow-roles.test.ts` proves every role can launch it.

## 🔍 Critical Patterns

- **YAGNI:** no Bitbucket or GitLab API; the skill says so instead of
  improvising. No charting dependency; `show-it` already renders everywhere.
- **Honest readings:** only rates and times get a "better/worse" reading; raw
  volumes stay neutral, and nothing is shown as favourable below the minimum
  sample.

## 📦 Implementation Tasks

| #   | Task                                           | Files                                                                                                                                                |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Collector script with pure functions and tests | `scripts/ai-impact-baseline.mjs`, `scripts/__tests__/ai-impact-baseline.test.mjs`                                                                    |
| 2   | Skill and workflow launcher                    | `.ai/skills/ai-impact-baseline.md`, `.agents/workflows/ai-impact-baseline.md`                                                                        |
| 3   | Tool registration                              | `package.json` (`rtk.tools`)                                                                                                                         |
| 4   | Dashboard: all roles, catalogue entry, tests   | `apps/dashboard/src/lib/workflow-roles.ts`, `apps/dashboard/src/app/skills/roles/data.ts`, `apps/dashboard/src/lib/__tests__/workflow-roles.test.ts` |
| 5   | Docs and generated registry                    | `docs/workflows.md`, `README.md`, `npm run generate:registry` outputs                                                                                |
| 6   | Posture snapshots                              | `packages/core/src/__tests__/__snapshots__/*.snap`                                                                                                   |
