---
name: reflexion-loop-sub-max
description: >-
  [LOOP · SUB-MAX · NO API KEYS · CROSS-MODEL VERIFY] $100/mo tier
  context-isolated plan hardening loop with multi-vendor cross-model
  verification.
modes:
  - write
---

// turbo

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

> [!IMPORTANT]
> **ANTI-CONFLATION DIRECTIVE:**
> This file (`.agents/workflows/reflexion-loop-sub-max.md`) is a workflow launcher stub, NOT the skill definition.
> Viewing this file via `view_file` does NOT satisfy Phase 0. You MUST call the MCP `get_skills` or `get_skill` tool FIRST with all 4 required fields before executing any other steps.

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is strictly prohibited for skill reading.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

1. **Phase 0: Skill Acquisition (FIRST ACTION — NO EXCEPTIONS)**:
   Call the `get_skills` / `get_skill` tool with all 4 required fields:
   - `skillName`: "reflexion-loop-sub-max"
   - `projectName`: "<YOUR_CURRENT_PROJECT_NAME>"
   - `model`: "<YOUR_MODEL_NAME>"
   - `agent`: "<YOUR_AGENT_NAME>"

2. **Pre-Flight Model Contract**: Formulate and print generator and critic model assignments and isolation levels (L0-L3). Check `CLAUDE_CODE_SUBAGENT_MODEL` (warn and cap at L2 if overridden).
3. **Phase 0B: Discovery**: Run scoped discovery, write Findings Ledger (`.loop-out/<runId>/findings.md`), and establish stack diagnosis.
4. **Phase 1-3: Generate, Critique & Adjudicate**: Execute plan generation and critic passes. Track models in state file (`.loop-out/<runId>/state.json`). Handle exhaustion Modes A/B/C via fallback ladder; mark degraded critic pass as PROVISIONAL.
5. **Mandatory Disclosure Verdict**: Emit disclosure status (`Model separation held` vs `MODEL SEPARATION LOST`) as the VERY FIRST line of `.loop-out/<runId>/verdict.md` and chat output, followed by Provenance Table.
6. **Adjudicate (Human-in-the-Loop)**: When run is complete, report final verdict.
   > "The Reflexion loop concluded at revision **N** with score **S/10** (Status: **<PASSED|PROVISIONAL>**). Approve to proceed, or override the last fix and run another loop?"
7. **On approval**, hand `.loop-out/<runId>/plan.md` to `planning-expert` or `vertical-slice-decomposer` to execute atomic task list.

---

**IDE Notes:**
- **Antigravity**: Paste into Agent Manager > Customizations > Workflows and invoke with `/reflexion-loop-sub-max`.
- **Cursor**: Auto-symlinked to `~/.cursor/skills/workflow-reflexion-loop-sub-max/`, invoke with `@workflow-reflexion-loop-sub-max`.
- **Continue**: Auto-symlinked to `~/.continue/prompts/reflexion-loop-sub-max.prompt`, invoke from the prompt menu.
