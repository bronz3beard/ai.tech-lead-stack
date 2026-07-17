---
name: dev-team
description: The flagship orchestration workflow for an agentic dev team
---

// turbo-all

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is strictly prohibited for skill reading.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

1. **Phase 0: Skill Acquisition**: Call the `get_skills` / `get_skill` tool:
   - skillName: "dev-team-orchestrator"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Phase 0 (cont): Discovery & Mission Frame**: Inspect the codebase for tech stack & domain boundaries. Establish the mission frame (one sentence + success metric).

3. **Phase 1: Crew Sizing Gate**: Score the five signals (Surface area, Novelty, Risk, Ambiguity, Parallelism) from 0-2. Sum to get size (XS to XL) and assign the appropriate crew and lane setup. Print the sizing decision before any work.

4. **Phase 2: Lane Ledger**: Set up the Lane Ledger tracking each lane's status, branch/worktree, state-file (`.dev-team/lanes/<lane-id>.md`), and next-gate.

5. **Phase 3: Persona Execution**: Orchestrate the active lanes using existing skills for pm-analyst, planner, developer, reviewer, and qa. Ensure Reviewer must ACT, not read.

6. **Phase 4: Tech-Lead Interview**: Batch questions at gate boundaries ONLY, appended to `.dev-team/inbox.md` using the YAML answers convention. Park the lane if unanswered.

7. **Phase 5: Friction Defect Protocol**: File friction defects at `.dev-team/friction/<date>-<slug>.md` using the `friction-defect` template for >=2 rework loops, skill behavioral deviations, or missing tools. Create an issue command (draft only by default).

8. **Telemetry**: Ensure telemetry events capture persona actions with `{ teamRole, loopRunId, actorType: 'AGENT' }`.

9. **Anti-drift Guard**: Reprint the Lane Ledger after every detour or completed gate. Multiple lanes advance independently.

**Execution guardrails (CRITICAL):**
This workflow relies on the `dev-team-orchestrator` skill. You MUST follow its explicit execution guardrails covering:
- **Execution Discipline:** Direct native file edits only (no patch.js/regex), produce-don't-deliberate, no stall commands.
- **Discovery Budget:** Strict caps on search, omitting build/dependency directories.
- **Lane & Worktree Integrity:** No silent lane creation; mandatory bootstrap (deps, `.env`, clients, builds) of fresh worktrees before testing.
- **Hard Gate Rules:** Inbox is read-only after human writes; PARK is a hard stop; NEVER silently bypass a tool failure (e.g., `reflexion-loop`) without human consent.
