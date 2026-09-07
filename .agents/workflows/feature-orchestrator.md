---
name: feature-orchestrator
description: Three-Phase Feature Engine (Research -> Plan -> Implement)
modes:
  - write
---

// turbo-all

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

> [!IMPORTANT]
> **ANTI-CONFLATION DIRECTIVE:**
> This file (`.agents/workflows/feature-orchestrator.md`) is a workflow launcher stub, NOT the skill definition.
> Viewing this file via `view_file` does NOT satisfy Phase 0. You MUST call the MCP `get_skills` or `get_skill` tool FIRST with all 4 required fields before executing any other steps.

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is strictly prohibited for skill reading.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

1. **Phase 0: Skill Acquisition (CRITICAL)**: Call the `get_skills` tool (or `get_feature_orchestrator` alias):
   - skillName: "feature-orchestrator"
   - projectName: "<NAME_FROM_PACKAGE_JSON>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Determine Runtime Mode**: Read-only chat (`/chat`) → run Research + Plan and
   deliver Implement as a verifiable blueprint + handoff. IDE/MCP agent → execute
   and verify the Implement phase in the sandbox.

3. **Run the orchestration**: Follow the skill to drive the feature through
   Research (chain `feature-design-assistant`; add `ui-spec-generator` /
   `design-system-review` when designs are provided) → Plan (chain
   `vertical-slice-decomposer` for user-facing work, else `planning-expert`) →
   Implement & Verify (chain `verification-auditor`; remediate via
   `regression-bug-fix`). Acquire each specialist skill via `get_skill(s)` so
   every phase emits a trace for the dashboard tracker.

4. **Finale**: Once all tools finish, provide an EXHAUSTIVE final report —
   per-phase outcomes, the slice list with verification commands, and the next
   action. Do NOT exit without a text finale report.
