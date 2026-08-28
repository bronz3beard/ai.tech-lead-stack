---
name: reflexion-loop-sub-pro
description: "[LOOP · SUB-PRO · NO API KEYS · CROSS-MODEL VERIFY] $20/mo tier context-isolated loop with single-pass cross-model plan check."
---

// turbo

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is strictly prohibited for skill reading.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

1. **Pre-Flight Model Contract**: Print model assignments and isolation levels (L0-L3). Check `CLAUDE_CODE_SUBAGENT_MODEL` (warn and cap at L2 if overridden).
2. **Phase 0: Skill Acquisition & Discovery**: Call `get_skills` for `reflexion-loop-sub-pro`. Run scoped discovery, write Findings Ledger to `.loop-out/<runId>/loop.md`, and establish stack diagnosis.
3. **Phase 1-3: Generate & Single-Pass Critique**: Execute single-pass generator and critic. On Mode B quota limit, consolidate into `.loop-out/<runId>/loop.md`, mark status `PARKED`, and report reset window.
4. **Mandatory Disclosure Output**: Emit disclosure status (`Model separation held` vs `MODEL SEPARATION LOST`) as the VERY FIRST line of `.loop-out/<runId>/loop.md` and chat output, followed by Provenance Table.
5. **Adjudicate (Human-in-the-Loop)**: Report final status to human.
   > "The Reflexion loop concluded with score **S/10** (Status: **<PASSED|PROVISIONAL>**). Approve to proceed, or override and run another pass?"
6. **On approval**, hand `.loop-out/<runId>/loop.md` to `planning-expert` or `vertical-slice-decomposer` to execute atomic task list.

---

**IDE Notes:**
- **Antigravity**: Paste into Agent Manager > Customizations > Workflows and invoke with `/reflexion-loop-sub-pro`.
- **Cursor**: Auto-symlinked to `~/.cursor/skills/workflow-reflexion-loop-sub-pro/`, invoke with `@workflow-reflexion-loop-sub-pro`.
- **Continue**: Auto-symlinked to `~/.continue/prompts/reflexion-loop-sub-pro.prompt`, invoke from the prompt menu.
