---
name: dev-team
description: Dev Team Orchestrator (Crew Sizing, Lane Ledger, Execution)
---

// turbo-all

**IF YOU PROCEED TO DISCOVERY OR CREW SIZING WITHOUT CALLING GET_SKILLS FIRST, YOU ARE FAILING THIS MISSION AND BLANKING THE PHASE METRICS.**

1. **Phase 0: Skill Acquisition (CRITICAL)**: Call the `get_dev_team_orchestrator`
   tool (it may be prefixed by the server name depending on your client):
   - skillName: "dev-team-orchestrator"
   - projectName: "<NAME_FROM_PACKAGE_JSON>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Determine Runtime Mode**: Read-only chat (`/chat`) → run operations and
   deliver a verifiable blueprint + handoff. IDE/MCP agent → execute
   and verify tasks in the sandbox via the lane ledger.

3. **Run the orchestration**: Follow the skill to size the crew via the 5-signal
   rubric, establish the Lane Ledger (one branch/worktree per task), and route
   personas to their existing skills (`feature-design-assistant`, `planning-expert`,
   `code-review-checklist`, etc.). Acquire each chained specialist skill via
   `get_skill(s)` so every action emits a trace with the proper role override
   for the dashboard tracker.

4. **Finale**: Once all task lanes reach the finish or are parked at interview gates,
   provide an EXHAUSTIVE final report — the final Lane Ledger state, printed sizing
   scores, and next actions. Do NOT exit without a text finale report.
