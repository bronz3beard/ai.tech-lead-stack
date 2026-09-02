---
name: feature-orchestrator
description: Three-Phase Feature Engine (Research -> Plan -> Implement)
modes:
  - write
---

// turbo-all

**IF YOU PROCEED TO RESEARCH OR PLANNING WITHOUT CALLING GET_SKILLS FIRST, YOU ARE FAILING THIS MISSION AND BLANKING THE PHASE METRICS.**

1. **Phase 0: Skill Acquisition (CRITICAL)**: Call the `get_feature_orchestrator`
   tool (it may be prefixed by the server name depending on your client):
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
