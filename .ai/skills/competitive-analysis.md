---
name: competitive-analysis
description: >
  Port of the blog's /competitive-analysis: compare this stack against external
  sources (blog posts, other agent stacks/plugins, papers, vendor docs), produce
  a Four-Pillars gap report grounded in OUR actual artifacts, and queue accepted
  ideas as GitHub issues + reflexion briefs — the self-improvement flywheel.
cost: ~850 tokens
modes: [read-only, write, mcp]
surface: public
---

# Competitive Analysis (Self-Improvement Flywheel)

## Runtime modes

Produces a full analysis and drafts issues inline in read-only chat, and
executes + verifies the report writing and GitHub issue generation in an IDE/MCP
agent.

> [!CAUTION] **RUNTIME MODE (DETERMINE FIRST — NON-NEGOTIABLE)**
>
> - **Read-only chat (`/chat`, the tech-lead-stack web app):** write/exec tools
>   are forbidden. Produce the full gap matrix, summary, and issue commands
>   inline. The user will manually copy these to execute.
> - **IDE / MCP agent + e2b sandbox:** write/exec exist. You must write the
>   report file and execute the `gh` commands if `DEV_TEAM_AUTOFILE_ISSUES=1` is
>   set, otherwise just write the drafted `gh` commands to the inbox file.

## 🎯 Verification Gates

### Phase 0: Self-inventory FIRST (Diagnosis-First)

- **Action:** Identify our current capability.
- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **IDE / MCP-enabled Agent:** Call the `get_skills` tool (which may be
    prefixed as `mcp_tech-lead-stack_get_skills` or
    `tech-lead-stack_get_skills`).
  - **Chat UI (/chat):** Call the internal `get_skills` tool.
- **Target Files:** Read the `README.md` section on "Four Pillars" and the skill
  table.
- **MANDATORY Guardrail:** Build the "our side" of the comparison from real
  artifact paths before reading external sources.

### Phase 1: Source ingestion

- **Input:** Accepts URLs, local files, transcripts.
- **Firecrawl integration:** (Optional) Use `firecrawl_scrape` (if available) to
  read external links just like `planning-expert` does. Do not invent a new
  scraping convention; reuse the same one.
- **Summarization:** Summarize each source in <=10 lines, PARAPHRASED.
- **MANDATORY Guardrail:** Quoting is limited to short attributed fragments.
  This skill explicitly requires paraphrasing for conciseness.

### Phase 2: Practice extraction table

- **Action:** Extract specific competitive practices found in the sources.
- **Format:** `practice | paraphrased evidence | source section pointer`.

### Phase 3: Four-Pillars gap matrix

- **Action:** Compare the extracted practices against our Phase 0
  self-inventory.
- **Format:**
  `practice | pillar(s) | our status (Better / Parity / Gap / N-A) | our artifact path | adoption cost S/M/L | verdict (adopt / decline / investigate)`.
- **HARD RULE:** A practice conflicting with any pillar (G-Stack Ethos,
  MinimumCD, Agent Skills, Modern Web Guidance) is auto-declined with the
  conflict recorded — sources never outrank pillars.

### Phase 4: Outputs

- **Action:** Write the report and queue work.
- **File Output:** Write the report to
  `.dev-team/competitive/YYYY-MM-DD-<slug>.md`.
- **Queue Ideas:** For each "adopt" verdict:
  - (a) Draft a `gh issue create --label competitive-analysis` command and
    append it to `.dev-team/inbox.md`. (Draft-only default;
    `DEV_TEAM_AUTOFILE_ISSUES=1` escape hatch identical to
    `onboard-dev`/`vertical-slice-decomposer`).
  - (b) Create a one-line brief formatted for
    `rtk run reflexion-loop -- "<brief>"` so adopted ideas enter the hardening
    loop before implementation.
- **Telemetry note:** When run via MCP, ensure `withAnalytics` records it
  (teamRole 'pm', actorType 'AGENT').

## 📊 Micro-example Gap Matrix

| Practice          | Pillar(s)    | Our Status | Our Artifact Path        | Cost | Verdict |
| ----------------- | ------------ | ---------- | ------------------------ | ---- | ------- |
| "Big bang merges" | MinimumCD    | N/A        | `.ai/skills/planning.md` | -    | decline |
| "Diff verify"     | Agent Skills | Gap        | `.ai/skills/verify.md`   | M    | adopt   |
