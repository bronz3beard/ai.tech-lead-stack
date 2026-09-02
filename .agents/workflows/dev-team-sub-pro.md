---
name: dev-team-sub-pro
description: >-
  [DEV-TEAM · SUB-PRO · NO API KEYS · CROSS-MODEL VERIFY] Subscription-tier
  ($20/mo) dev pair orchestrator workflow (1 lane, no worktrees,
  builder/checker, cross-model verify, tier ceiling)
modes:
  - write
---

// turbo-all

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is strictly prohibited for skill reading.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

> [!NOTE] `// turbo-all` is active for execution velocity, BUT it does NOT license bypassing PARK. Parking at a gate or inbox question is a HARD STOP regardless.

1. **Pre-Flight Model Contract**: Print model assignments and isolation levels (L0-L3). Check `CLAUDE_CODE_SUBAGENT_MODEL` (warn and cap at L2 if overridden).
2. **Phase 0A: Cold Resume Check**: Inspect `.dev-team/lanes/lane-1.md`. If incomplete, print Quota Ledger, read state file and Findings Ledger (`.dev-team/analysis/lane-1.md`), and resume directly from recorded Phase without re-running Phase 0 discovery.
3. **Phase 0B: Skill Acquisition & Discovery**: Call `get_skills` for `dev-team-sub-pro`. Run scoped discovery (excluding build/dependency dirs), create Findings Ledger, and establish Mission Frame.
4. **Phase 1: Crew Sizing & Tier Ceiling Gate**: Score the five signals (0-2). Score ≥ 6 (L/XL) or Risk signal = 2 -> REFUSE and escalate immediately. Print scores first regardless.
5. **Phase 2: Single-Lane & Quota Ledger**: Initialize Quota Ledger (`.dev-team/quota.md`, 20 turn budget, active model tracking). No git worktrees (operate directly on branch). Write checkpoint `.dev-team/lanes/lane-1.md` BEFORE entering gates. If Mode B limit hit or turns reach 20, consolidate into Findings Ledger, PARK, and hand back.
6. **Phase 3: Two-Hat Execution (Builder & Checker)**: Builder plans and implements (optional `reflexion-loop-sub-pro` if Risk = 1). Checker runs in fresh sub-agent (Context Firewall) and pastes hard evidence. Mark degraded Checker approvals as PROVISIONAL (Risk-2 work MUST PARK). Visual gate for UI slices requires Figma spec in plan and 2-viewport capture.
7. **Phase 4: Tech-Lead Interview**: Batch questions at gate boundaries in `.dev-team/inbox.md`. PARK is a hard stop. Inbox is read-only after human responds. Never bypass gate failures silently.
8. **Phase 5: Friction Defect Protocol**: Document rework ≥2, tool failures, or >2 model swaps in `.dev-team/friction/<date>-<slug>.md`. Draft issue command (autofile only if `DEV_TEAM_AUTOFILE_ISSUES=1`).
9. **Mandatory Disclosure Output**: Emit disclosure status (`Model separation held` vs `MODEL SEPARATION LOST`) as the VERY FIRST line of final output, followed by the full Provenance Table.
10. **Telemetry**: Include `{ teamRole, loopRunId, actorType: 'AGENT' }` on all skill calls.
11. **Anti-drift Guard**: Reprint Lane Ledger after every detour or completed gate.

**Execution guardrails (CRITICAL):**
This workflow relies on the `dev-team-sub-pro` skill. You MUST follow its explicit execution guardrails covering:
- **Execution Discipline:** Direct native file edits only, produce-don't-deliberate, single branch checkout (no worktrees).
- **Tier Ceilings:** Refuse L/XL and Risk-2 tasks immediately. Maximum 20 turns per slice.
- **Interrupt Safety & Model Continuity:** Checkpoint BEFORE gate in `.dev-team/lanes/lane-1.md`. Mode B consolidate-and-park. First-line same-model disclosure line.
- **Hard Gate Rules:** PARK is a hard stop; `git push`, `git add`, `merge` STRICTLY FORBIDDEN.

**IDE surface activation notes:**
- **Antigravity:** Paste file content into Agent Manager > Customizations > Workflows (trigger via `/dev-team-sub-pro`).
- **Cursor:** `install.sh` symlinks to `~/.cursor/skills/workflow-dev-team-sub-pro/SKILL.md` (trigger via `@workflow-dev-team-sub-pro`).
- **Continue:** `install.sh` symlinks to `~/.continue/prompts/dev-team-sub-pro.prompt` (trigger via `/dev-team-sub-pro`).
