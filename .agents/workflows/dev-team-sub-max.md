---
name: dev-team-sub-max
description: >-
  [DEV-TEAM · SUB-MAX · NO API KEYS · CROSS-MODEL VERIFY] Subscription-tier
  ($100/mo) dev team orchestrator workflow (up to 2 lanes,
  reflexion-loop-sub-max, cross-model verify, visual fidelity gate)
modes:
  - write
---

// turbo-all

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

> [!IMPORTANT]
> **ANTI-CONFLATION DIRECTIVE:**
> This file (`.agents/workflows/dev-team-sub-max.md`) is a workflow launcher stub, NOT the skill definition.
> Viewing this file via `view_file` does NOT satisfy Phase 0. You MUST call the MCP `get_skills` or `get_skill` tool FIRST with all 4 required fields before executing any other steps.

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is strictly prohibited for skill reading.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

> [!NOTE] `// turbo-all` is active for execution velocity, BUT it does NOT license bypassing PARK. Parking at a gate or inbox question is a HARD STOP regardless.

1. **Phase 0: Skill Acquisition (FIRST ACTION — NO EXCEPTIONS)**:
   Call the `get_skills` / `get_skill` tool with all 4 required fields:
   - `skillName`: "dev-team-sub-max"
   - `projectName`: "<YOUR_CURRENT_PROJECT_NAME>"
   - `model`: "<YOUR_MODEL_NAME>"
   - `agent`: "<YOUR_AGENT_NAME>"

2. **Pre-Flight Model Contract**: Formulate and print model assignments and isolation levels (L0-L3). Check `CLAUDE_CODE_SUBAGENT_MODEL` (warn and cap at L2 if overridden).
3. **Phase 0A: Cold Resume Check**: Inspect `.dev-team/lanes/*.md`. If incomplete lanes exist, print Quota Ledger, read state files and Findings Ledger (`.dev-team/analysis/<lane-id>.md`), and resume directly from recorded Phase without re-running Phase 0 discovery.
4. **Phase 0B: Discovery & Mission Frame**: Run scoped discovery (excluding build/dependency dirs), create Findings Ledger, and establish Mission Frame.
5. **Phase 1: Crew Sizing Gate**: Score the five signals (0-2). Max 2 parallel lanes. If score = XL, open Tech-Lead confirmation gate stating expected turn cost (~60 turns) before worktree creation. Print scores first.
6. **Phase 2: Lane & Quota Ledgers**: Initialize Quota Ledger (`.dev-team/quota.md` tracking active models and headroom). Set up Lane Ledger and git worktrees. Write lane state files (`.dev-team/lanes/<lane-id>.md`) BEFORE entering gates. Mandatory worktree bootstrap before testing.
7. **Phase 3: Persona Execution & Model Continuity**: Run pm-analyst, planner, developer, reviewer, qa. Hardened plans via `reflexion-loop-sub-max`. Reviewer runs in fresh sub-agent (Context Firewall) with diff + criteria + commands. Handle exhaustion Modes A/B/C via fallback ladder; mark degraded reviewer approvals as PROVISIONAL (Risk-2 work MUST PARK). UI slices MUST enforce visual fidelity gate.
8. **Phase 4: Tech-Lead Interview**: Batch questions at gate boundaries in `.dev-team/inbox.md`. PARK is a hard stop. Inbox is read-only after human responds. Never bypass gate failures silently.
9. **Phase 5: Friction Defect Protocol**: Document rework ≥2, tool failures, or >2 model swaps in `.dev-team/friction/<date>-<slug>.md`. Draft issue command (autofile only if `DEV_TEAM_AUTOFILE_ISSUES=1`).
10. **Mandatory Disclosure Output**: Emit the disclosure status (`Model separation held` vs `MODEL SEPARATION LOST`) as the VERY FIRST line of final output, followed by the full Provenance Table.
11. **Telemetry**: Include `{ teamRole, loopRunId, actorType: 'AGENT' }` on all persona skill calls.
12. **Anti-drift Guard**: Reprint Lane and Quota Ledgers after every detour or completed gate.

**Execution guardrails (CRITICAL):**
This workflow relies on the `dev-team-sub-max` skill. You MUST follow its explicit execution guardrails covering:
- **Execution Discipline:** Direct native file edits only, produce-don't-deliberate, no stall commands.
- **Interrupt Safety:** Checkpoint BEFORE gate in `.dev-team/lanes/<lane-id>.md`. Cold resume protocol on fresh window.
- **Model Isolation & Continuity:** First-line same-model disclosure line, PROVISIONAL slice tracking, Findings Ledger updates.
- **Hard Gate Rules:** PARK is a hard stop; `git push`, `git add`, `merge` STRICTLY FORBIDDEN.

**IDE surface activation notes:**
- **Antigravity:** Paste file content into Agent Manager > Customizations > Workflows (trigger via `/dev-team-sub-max`).
- **Cursor:** `install.sh` symlinks to `~/.cursor/skills/workflow-dev-team-sub-max/SKILL.md` (trigger via `@workflow-dev-team-sub-max`).
- **Continue:** `install.sh` symlinks to `~/.continue/prompts/dev-team-sub-max.prompt` (trigger via `/dev-team-sub-max`).
