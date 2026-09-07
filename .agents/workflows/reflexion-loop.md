---
name: reflexion-loop
description: >-
  [LOOP · DUAL-MODEL · API KEYS] ✨ Special feature — run the two-model
  self-correcting plan loop (Gemini drafts, Claude grades). Requires
  GEMINI_API_KEY + ANTHROPIC_API_KEY.
modes:
  - write
---

// turbo

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

> [!IMPORTANT]
> **ANTI-CONFLATION DIRECTIVE:**
> This file (`.agents/workflows/reflexion-loop.md`) is a workflow launcher stub, NOT the skill definition.
> Viewing this file via `view_file` does NOT satisfy Phase 0. You MUST call the MCP `get_skills` or `get_skill` tool FIRST with all 4 required fields before executing any other steps.

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is strictly prohibited for skill reading.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

1. **Phase 0: Skill Acquisition (FIRST ACTION — NO EXCEPTIONS)**:
   Call the `get_skills` / `get_skill` tool with all 4 required fields:
   - `skillName`: "reflexion-loop"
   - `projectName`: "<YOUR_CURRENT_PROJECT_NAME>"
   - `model`: "<YOUR_MODEL_NAME>"
   - `agent`: "<YOUR_AGENT_NAME>"

2. **Phase 0B: Confirm the brief.** Take the user's feature request / ticket as
   the brief. If they pointed at a file, read it.

3. **Run the engine (terminal).** From the repo root:

   ```
   rtk run reflexion-loop -- "<BRIEF TEXT>"
   ```

   (Equivalent: `npx tsx scripts/reflexion-loop.ts "<BRIEF TEXT>" --repo . --max 3 --threshold 8`.)
   The engine reads the repo for Phase-0 diagnosis, then loops Gemini (writer) ↔
   Claude (critic) until it passes or caps, and Claude writes the final verdict.

4. **Surface the artifacts** from `.reflexion-out/`:
   - `plan.md` — the final implementation plan.
   - `diminishing-returns.svg` — score-per-revision curve.
   - The adjudicator verdict printed at the end of the run.

5. **Adjudicate (Human-in-the-Loop).** Report:
   > "The Reflexion loop concluded at revision **N** with score **S/10**. Approve
   > to proceed, or override the last fix and run another loop?"
   Handle the run's exit state correctly:
   - **0 (Passed/user-approve):** The plan is ready.
   - **2 (Parked/awaiting answers):** The adjudicator has questions. Instruct the user to edit `interview.md` and resume.
   - **3 (Budget-exceeded/user-stop):** The budget cap was tripped or manually stopped. Summarise the gap.
   - **4 (Refine-contract-violation/internal error):** The loop failed strict verification.

5. **On approval**, hand `.reflexion-out/plan.md` to `planning-expert` or
   `vertical-slice-decomposer` to execute the atomic task list.

> [!NOTE] **This is the developer path.** Running here (IDE + MCP) means the
> agent may go on to **change code** from the reviewed plan, and the run is
> **logged to Prisma** (`source: 'mcp'`). The website/chat version is read-only
> and only ever returns a plan + an IDE prompt — it never edits code.
