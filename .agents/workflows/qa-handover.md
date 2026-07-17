---
description: Generate a QA handover + universal smoke-test criteria document and deliver it to ClickUp
---

// turbo-all

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is strictly prohibited for skill reading.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

1. **Phase 0: Skill Acquisition**: Call the `get_skills` / `get_skill` tool:
   - skillName: "qa-handover-generator"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Phase 0 (cont): Scope & Architecture Discovery**: Identify the exact modules/screens the change touches. From the REAL code, determine how the feature manages state — distinguish server-driven (URL/query is source of truth, round-trips to server) from client-side/in-memory/offline-first (static fetch, in-memory filtering), or whatever pattern the code actually uses. For each pattern extract the single source of truth and the owning hook/query/function by real name. Scoped searches only (exclude node_modules/.next/.nx/dist/build).

3. **Gate 1: Architecture Overview**: Write the Architecture Overview split by the patterns actually found — target modules, single source of truth, mechanism (named symbols), pattern-specific behaviours. Every claim traces to real code.

4. **Gate 2: Universal Smoke-Test Criteria**: For each pattern, write smoke-test acceptance criteria covering general usage and core flows (not edge cases), each with expected result and pattern-specific gotcha. Each criterion must be agent-ingestible AND human-followable. Render as ClickUp checklist items.

5. **Gate 3: Testability & Environment Notes**: State URLs/modules, auth/role, offline/PWA and data/environment considerations so QA does not report false failures.

6. **Gate 4: ClickUp Delivery**: Render the ENTIRE document through the shared module `scripts/clickup-format.ts` — never hand-roll ClickUp markdown. Tables via `renderTable(table, mode, target)`: `mode` defaults to `'pipe'` (native ClickUp Doc/task tables) and auto-falls back to `'list'` when a table exceeds the destination column limit (8 for docs, 4 for task descriptions); pass `target` `'doc'` or `'task'` to match where it will be created. When the ClickUp MCP is connected AND a destination (space/folder/list/doc id + title) is provided, create the handover via `clickup_create_document` / `clickup_create_document_page` and confirm headings/table/checkboxes/code render correctly. Otherwise write the rendered content to `.ai/output/qa-handovers/<feature>-handover.md`. Never create in ClickUp without an explicit destination.

7. **Telemetry**: Pass overrides `{ teamRole: "qa", actorType: "AGENT", loopRunId: "<MISSION_ID>" }` on MCP skill calls.
