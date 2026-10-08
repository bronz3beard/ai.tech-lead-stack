---
name: ai-impact-baseline
description: Compare engineering metrics before and after AI entered the codebase, and explain the deltas visually.
modes:
  - read-only
  - write
---

// turbo-all

> [!CAUTION] **READ-ONLY ON THE REPOSITORY**
> This workflow never edits, deletes or refactors code, and never changes git state (no fetch, pull, checkout or push).
> The ONLY permitted writes are the collector's outputs under `.ai/output/ai-impact/`.
> The ONLY permitted commands are the collector (`ai-impact-baseline`), read-only `git` and `gh api` reads.

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

> [!IMPORTANT]
> **ANTI-CONFLATION DIRECTIVE:**
> This file (`.agents/workflows/ai-impact-baseline.md`) is a workflow launcher stub, NOT the skill definition.
> Viewing this file via `view_file` does NOT satisfy Phase 0. You MUST call the MCP `get_skills` or `get_skill` tool FIRST with all 4 required fields before executing any other steps.

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is strictly prohibited for skill reading.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

1. **Phase 0: Skill Acquisition**: Call the `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing):
   - skillName: "ai-impact-baseline"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Phase 1: Capability and Host Check**: Confirm a git checkout and read the origin URL. GitHub origins with a signed-in `gh` CLI get PR, issue, CI and release metrics; every other host (Bitbucket, GitLab, self-hosted) gets git metrics only. Say which applies.

3. **Phase 2: Find the Cutoff**: Run `./.ai/rtk-run run ai-impact-baseline --detect-only` (in this repo: `node scripts/ai-impact-baseline.mjs --detect-only`).
   - `detected` → use the first AI-assisted commit it names.
   - `cutoff_unknown` (exit code 20) → **STOP and ask the user** for the date or date range they know or suspect AI was first introduced, showing the manifest's hints. Pass their answer as `--cutoff <date>` and, for a range, `--cutoff-end <date>`.

4. **Phase 3: Collect**: Run the collector with the cutoff flags (and `--window-days <n>` if the user wants a bound). Read the JSON manifest on stdout; stop with the `reason` if `status` is not `ok`.

5. **Phase 4–6: Qualify, Render, Deliver**: Follow the `ai-impact-baseline` skill: state the window length and sample caveats first, then render the headline tiles, the weekly trend chart and the detail tables using the `show-it` contract (load `show-it` through the broker). Finish with the `report.json` / `report.md` paths and a one-line question about what else changed at the cutoff.
