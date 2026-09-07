---
name: competitive-analysis
description: >-
  Port of the blog's /competitive-analysis - compare this stack against external
  sources and queue accepted ideas.
modes:
  - write
---

// turbo

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

> [!IMPORTANT]
> **ANTI-CONFLATION DIRECTIVE:**
> This file (`.agents/workflows/competitive-analysis.md`) is a workflow launcher stub, NOT the skill definition.
> Viewing this file via `view_file` does NOT satisfy Phase 0. You MUST call the MCP `get_skills` or `get_skill` tool FIRST with all 4 required fields before executing any other steps.

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is strictly prohibited for skill reading.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

1. **Phase 0: Skill Acquisition**: Call the `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing):
   - skillName: "competitive-analysis"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"

2. **Phase 1: Source Ingestion**:
   - Accept URLs, local files, transcripts. Use optional Firecrawl integration for external links.
   - Summarize each source in <=10 lines (PARAPHRASED), quoting is limited to short attributed fragments.

3. **Phase 2: Practice Extraction**:
   - Extract specific competitive practices found in the sources.
   - Format: `practice | paraphrased evidence | source section pointer`.

4. **Phase 3: Four-Pillars Gap Matrix**:
   - Compare practices to Phase 0 self-inventory.
   - Format: `practice | pillar(s) | our status (Better / Parity / Gap / N-A) | our artifact path | adoption cost S/M/L | verdict (adopt / decline / investigate)`.
   - **HARD RULE:** Auto-decline any practice conflicting with any pillar (G-Stack Ethos, MinimumCD, Agent Skills, Modern Web Guidance).

5. **Phase 4: Outputs**:
   - Write the report to `.dev-team/competitive/YYYY-MM-DD-<slug>.md`.
   - For each "adopt" verdict, append a drafted `gh issue create --label competitive-analysis` to `.dev-team/inbox.md`.
   - For each "adopt" verdict, generate a one-line `rtk run reflexion-loop -- "<brief>"` brief.
