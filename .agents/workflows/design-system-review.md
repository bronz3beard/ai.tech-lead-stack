---
name: design-system-review
description: AI-augmented design review with a 2-iteration guard, sequential memory, and KI persistence.
---

// turbo-all

**IF YOU PROCEED TO RESEARCH WITHOUT CALLING GET_SKILLS FIRST, YOU ARE FAILING THIS MISSION.**

## Phase 0: Skill Acquisition (CRITICAL)

Call the `get_skill` tool:

- skillName: `"design-system-review"`
- projectName: `"<NAME_FROM_PACKAGE_JSON>"`
- model: `"<YOUR_MODEL_NAME>"`
- agent: `"<YOUR_AGENT_NAME>"`

---

## Phase 1: Sequential Memory Init

Before any analysis, use the `sequential-thinking` tool to initialize your
session context:

1. **Thought 1** — Identify the `sessionId` from the user message.
2. **Thought 2** — Fetch the current session state via the local API:
   `curl http://localhost:3000/api/design-review/session/<sessionId>`
   - Restore iteration count, current status, and check if a `figmaUrl` was provided.
3. **Thought 3** — Confirm: "Session initialized. Iteration N. Status: X."

---

## Phase 2: Existing KI Check

Before auditing, search for past design decisions on this component:

1. Call `list_knowledge_items` with the current project name.
2. Look for any slug matching `design-decision-<component-name>-*`.
3. If found: call `read_knowledge_item` and incorporate the past decision
   into your audit context so you don't contradict approved deviations.

---

## Phase 3: Run the Audit (Follow Skill Gates)

Execute the full skill workflow (Phase 0 → Gate 5):

- Use `sequential-thinking` to track each gate result as a separate thought.
- After each gate: record PASS / FAIL and the specific evidence.
- After Gate 4 (Storybook/Figma): If a `figmaUrl` exists in the session, verify against it. If NO Figma URL exists, evaluate the component purely based on base Shadcn/Radix foundations and the project's brand tokens.
- After Gate 5 (Chromatic): pause if credentials are needed, wait for user.
- Update the session state via the API (using `PATCH /api/design-review/session/<sessionId>`) after all gates are complete.

---

## Phase 4: Iteration Decision

**When the audit is complete (Score < 90%):**

- Present the "Must Fix" list (🔴 Critical / 🟡 Recommended / 🟢 Advisory).
- Instruct the user: "Apply these fixes, then reply `/design-system-review iterate` to trigger the next iteration."
- **STOP here.** Do not proceed until the user responds.

**On subsequent iterations (`/design-system-review iterate`):**

- Re-fetch the session state to confirm the current iteration count.
- Re-run only failed gates.
- Calculate the new alignment score.
- *Note:* There is a minimum of 2 iterations required, but you may scale upwards as needed to reach UI parity.
- Branch:
  - **≥ 90%** → Call `create_knowledge_item` → `PATCH` status to `READY_FOR_DESIGNER_GATE`
  - **Still failing after multiple attempts & stuck** → `PATCH` status to `ESCALATED` and write to `docs/design-debt.md`

---

## Phase 5: Persistence

On **any** session completion (pass or escalation):

- Final `sequential-thinking` thought: summarize the full session outcome.
- Update the session state using:
  `curl -X PATCH http://localhost:3000/api/design-review/session/<sessionId> -H "Content-Type: application/json" -d '{"status": "<STATUS>", "alignmentScore": <SCORE>, "gateResults": [...]}'`
- If `READY_FOR_DESIGNER_GATE`: call `create_knowledge_item` with the KI
  schema from the skill.
- If `ESCALATED`: append a new entry to `docs/design-debt.md`:

```markdown
## [YYYY-MM-DD] <Component Name>

- **Status**: ESCALATED
- **Alignment Score**: N%
- **Unresolved Gates**: <list>
- **Session ID**: `<sessionId>`
- **Action Required**: Manual designer review
```

---

*Companion skills: Always run `style-logic-exporter` first to extract current
token state. Run `accessibility-auditor` in parallel for WCAG coverage.*
