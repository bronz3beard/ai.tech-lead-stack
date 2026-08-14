---
name: reflexion-loop-sub-max
description: "[LOOP · SUB-MAX · NO API KEYS] $100/mo tier context-isolated plan hardening loop."
---

// turbo

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is strictly prohibited for skill reading.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

1. **Phase 0: Skill Acquisition**: Call the `get_skills` / `get_skill` tool:
   - skillName: "reflexion-loop-sub-max"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Context Firewall**: You must state the Context Firewall level being used to ensure grading integrity, and name the concrete mechanism:
   - Antigravity: `invoke_subagent` (spawn a sub-agent)
   - Cursor: New Composer or Task
   - Continue: Fresh session

3. **Quota Discipline**: 
   - Turn Budget: 12 agent turns. Print the turn count in every phase header (e.g., `[turn 1/12]`).
   - Checkpoint state to `.loop-out/<runId>/state.json` after every phase.

4. **Adjudicate (Human-in-the-Loop)**: When the run is complete, report the final status.
   > "The Reflexion loop concluded at revision **N** with score **S/10**. Approve to proceed, or override the last fix and run another loop?"

5. **On approval**, hand `.loop-out/<runId>/plan.md` to `planning-expert` or `vertical-slice-decomposer` to execute the atomic task list.

---

**IDE Notes:**
- **Antigravity**: Paste into Agent Manager > Customizations > Workflows and invoke with `/reflexion-loop-sub-max`.
- **Cursor**: Auto-symlinked to `~/.cursor/skills/workflow-reflexion-loop-sub-max/`, invoke with `@workflow-reflexion-loop-sub-max`.
- **Continue**: Auto-symlinked to `~/.continue/prompts/reflexion-loop-sub-max.prompt`, invoke from the prompt menu.
