---
name: ai-impact-baseline
description: >
  Before-and-after engineering metrics around the moment AI entered a codebase.
  Finds the first AI-assisted commit (or asks for the date or range when it
  cannot), splits history into two equal windows, collects the same git,
  pull-request, issue, CI and release metrics for both, and explains the deltas
  visually with show-it. Git metrics work on any host; GitHub adds PR, issue, CI
  and release metrics through the gh CLI. Writes only under
  .ai/output/ai-impact/.
cost: ~3200 tokens
modes: [read-only, write, mcp]
surface: public
category: Review & Verify
how:
  'Runs the ai-impact-baseline collector, pauses when the cutoff is unknown,
  then renders the before/after deltas as tables and charts with show-it.'
useCase:
  'Answering "what changed since we adopted AI?" with evidence from the repo
  itself, for a retro, a leadership update, or a tooling decision.'
phase: scale
kind: report
domain: eng
ownership:
  drive: human-ai
  approve: human
targets: [local, api, subscription]
minModelClass: small
consumes: []
emits: [evidence]
requires: [show-it]
suggests: [ask, weekly-leadership-report]
policies:
  - user-sovereignty
  - diagnosis-first
  - four-pillars
---

# AI Impact Baseline (Before vs After AI)

## Runtime modes

Advisory in every context. In an IDE/MCP agent with a shell it **runs the
collector**, reads the JSON it writes, and renders the comparison visually. In
read-only chat (the web app's `/chat`, or any surface without a shell) it hands
the user the exact command, then renders whatever `report.json` or `report.md`
they paste back. It never edits source, never touches git state, and the only
files it creates are the collector's outputs under `.ai/output/ai-impact/`.

> [!IMPORTANT] **Correlation, not causation.** Before/after is a self-selected
> comparison. Team size, holidays, product phase, hiring and process changes all
> move these numbers. Every delta is reported next to the window sizes and
> sample counts that qualify it, and the summary names what else is known to
> have changed at the cutoff. Never present a delta as "AI caused X".

## 🧠 The Four Pillars (how this skill embodies them)

1. **G-Stack — Diagnosis-First.** The cutoff comes from the repository's own
   evidence (an AI co-author trailer, a "Generated with" marker, or an AI agent
   as author) before the user is ever asked. The user's answer is recorded as
   the cutoff source so the report says where the date came from.
2. **MinimumCD — Small Batches.** One collector run, one output folder, one
   visual per idea. Headline first, detail tables second, raw JSON for anyone
   who wants to go further.
3. **Agent Skills — Evidence over Assumption.** Every number traces to
   `report.json`, every chart to the `series.weekly` array in it. The report
   says which lists were capped and when a window is too small to compare.
4. **Modern Web Guidance.** Visuals follow the `show-it` contract: mermaid or
   markdown inline, static script-free HTML when a file is wanted. No CDNs, no
   installs.

## 🎯 Strategic Workflow

### Phase 0: Skill Acquisition and Tech-Stack Discovery (MANDATORY)

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is
    strictly prohibited for skill reading.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which
    may be prefixed as `mcp_tech-lead-stack_get_skills` or
    `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.
- Load `show-it` the same way before Phase 5; it owns the visual contract.
- **Action:** confirm the target is a git checkout (`git rev-parse --git-dir`),
  note the default branch, and read `git remote get-url origin` to learn the
  host. Do not read application code; this skill measures history, not source.

### Phase 1: Capability and Host Check

Decide by **effect**, not tool name:

| Capability                                  | How to tell                                   | Effect on this run                             |
| :------------------------------------------ | :-------------------------------------------- | :--------------------------------------------- |
| Can exec                                    | a tool runs shell commands                    | run the collector; otherwise hand over the cmd |
| GitHub origin + `gh`                        | origin is github.com, `gh auth status` passes | PR, issue, CI and release metrics are added    |
| Other host (Bitbucket, GitLab, self-hosted) | origin is not github.com                      | git metrics only; say so plainly in the report |

The collector implements **no Bitbucket or GitLab API**. Do not improvise one.
If the user wants PR metrics from another host, say that it is not supported and
offer the git-only comparison.

### Phase 2: Find the Cutoff (or pause and ask)

Run detection first. In this repo:

```bash
node scripts/ai-impact-baseline.mjs --detect-only
```

In a linked project:

```bash
./.ai/rtk-run run ai-impact-baseline --detect-only
```

- `status: "detected"` → the earliest commit with a hard AI signal is the
  cutoff. Show the user the sha, date, subject and signal in one line and
  proceed. If they know AI arrived earlier (for example through an IDE assistant
  that leaves no trailer), they can override with `--cutoff`.
- `status: "cutoff_unknown"` (exit code **20**) → **STOP and ask one question**,
  verbatim from the manifest's `ask` field, and list its `hints` (commits whose
  subject mentions AI) with their dates so the user can answer from evidence.
  Accept either:
  - a single date → `--cutoff YYYY-MM-DD`
  - a suspected range → `--cutoff <start> --cutoff-end <end>`; the range is a
    transition period and belongs to neither window.

  Never pick a date yourself. Never treat a "mentions AI" hint as the cutoff
  without the user confirming it.

### Phase 3: Collect

```bash
node scripts/ai-impact-baseline.mjs [--cutoff <date> [--cutoff-end <date>]] [--window-days <n>]
```

What it does, so you can explain it:

- Builds two windows of **equal length**: `before` ends at the cutoff, `after`
  starts at it (or at the end of the range). The length is the most the history
  and today allow, capped by `--window-days`.
- **Git metrics, any host:** commits and commits per week, merge commits, active
  authors, lines added and deleted, changed lines and files per commit (median),
  test-line share, fix-commit share, reverts, AI-assisted commits and share,
  tags and tags per week.
- **GitHub metrics, when available:** merged PRs and PRs per week, PR authors,
  cycle time median and p75 (first commit → merge), coding, pickup and review
  time medians, PR size, changed files, commits per PR, review comments,
  unreviewed share, revert rate, AI-assisted PRs and share; issues opened and
  closed, closed share, time to close, bug-labelled share; workflow runs, failed
  runs, success rate, run duration median; releases and releases per week.
  Dependency and release bots are excluded; AI coding agents are kept.
- Writes `report.json` (the full data, including `series.weekly` for charts) and
  `report.md` (ready-to-paste tables) under
  `.ai/output/ai-impact/<YYYY-MM-DD>/`, and prints a manifest on stdout.

Read the manifest. If `status` is anything but `ok`, report the `reason` and
stop; the exit codes are `2` usage, `20` cutoff unknown, `30` not a repo.

### Phase 4: Qualify before you interpret

Check these in `report.json` before drawing anything, and say them first:

- **`windows.days` under 14** → the baseline is too short to mean much (the repo
  was AI-assisted almost from the start). Say so, and offer `--cutoff` with a
  later date the user considers the real adoption point.
- **`sufficient: false`** → a window holds fewer than `minSample` commits or
  PRs. Present the numbers as anecdotal, no "better/worse" language.
- **`github.capped`** has a `true` → say which list was capped and that rates
  for it are lower bounds.
- **`cutoff.source: "user"`** → state the date came from the user, and whether
  the collector detected an earlier or later hard signal (`cutoff.detected`).

### Phase 5: Render (the show-it contract)

Load `show-it` through the broker and follow its format table. For this skill
the cheapest adequate visuals are:

1. **Headline tile row (markdown table):** commits per week, merged PRs per
   week, cycle-time median, revert rate, each as before → after with the
   relative change and the `favourable` reading from `deltas`.
2. **Trend (mermaid `xychart-beta`):** one chart from `series.weekly`, commits
   per week on the y-axis, weeks on the x-axis, with the cutoff named in the
   title. Keep it to the two windows; never more than ~26 bars. A second chart
   for merged PRs per week only when GitHub data exists.
3. **Detail tables:** paste the sections of `report.md` as they are.
4. **Static HTML** only when the user asks for a file to share: follow show-it's
   HTML contract (single `index.html`, ≤ 6 KB, inline SVG, no scripts) and write
   it beside the report under `.ai/output/ai-impact/`.

Without a shell, render exactly the same visuals from the pasted `report.json`;
the shape is the same.

**Passive mode.** When the user, or a downstream agent, wants the data rather
than the pictures, point at `report.json` and describe its shape in one line:
`git.before/after`, `github.before/after`, `deltas.*` (before, after, absolute,
relative, direction, favourable) and `series.weekly` (weekStart, cohort,
commits, prsMerged). That is the contract for anyone building their own visual.

### Phase 6: Deliver

Structure the answer as:

- **Title:** repo, cutoff date and its source, window length.
- **Qualifiers:** the Phase 4 findings, first and plainly.
- **The visuals:** headline tiles, trend chart, then the detail tables.
- **Caption:** at most two sentences on what to notice.
- **What else changed at the cutoff:** one line asking the user to name any
  confounder they know of (team change, release freeze, new process).
- **Source:** the `report.json` and `report.md` paths, the commit used as the
  cutoff, and whether GitHub metrics were included.

## 🚫 Anti-Rationalization

| Excuse                                                  | Correct response                                                                                    |
| :------------------------------------------------------ | :-------------------------------------------------------------------------------------------------- |
| "No AI signal found, but it was probably around March." | Exit code 20 means **ask**. The user supplies the date; the report records it as `source: user`.    |
| "The before window is tiny, but the trend is clear."    | Say the window is too short to compare, offer a later `--cutoff`, and present numbers as anecdotal. |
| "I'll call the Bitbucket API by hand to get PR data."   | Not implemented. Deliver the git-only comparison and say which metrics are missing and why.         |
| "Cycle time dropped 40%, so AI made the team faster."   | It is a correlation. Name the window sizes and ask what else changed at the cutoff.                 |
| "I'll paginate `gh api` myself to get every PR."        | The collector already pages and caps. Hand-rolled calls skew cohorts and burn tokens.               |
| "I'll install a charting library for a nicer graph."    | Installs are forbidden. Use mermaid, markdown or the static HTML contract from `show-it`.           |
| "The report belongs in `docs/`."                        | Write under `.ai/output/ai-impact/` and give the path; the user decides where it lives.             |

## Operational Constraints

1. **Read-only on the repository:** the collector only runs `git log`,
   `git for-each-ref`, `git remote` and `gh api` reads. Never fetch, pull,
   checkout, or change any ref.
2. **Write scope:** new files under `.ai/output/ai-impact/` only.
3. **Secrets:** `gh` holds the token; never print it, never ask for one, never
   pass one on the command line.
4. **Cutoff sovereignty:** the user, not the agent, decides any date the
   repository could not prove.
5. **Token efficiency:** read the manifest and `report.md`; open `report.json`
   only for the `series.weekly` chart data and the qualifiers in Phase 4.
