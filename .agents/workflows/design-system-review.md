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

1. **Thought 1** — Identify the component under review (from user message or
   active file context).
2. **Thought 2** — Check for an existing session file at:
   `scratch/design-review/<project-name>/session-<YYYY-MM-DD>.md`
   - If found: read it and restore iteration count + status.
   - If not found: create it using the template in the skill.
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
- After Gate 4 (Storybook/Figma): pause if Figma URL is needed, wait for user.
- After Gate 5 (Chromatic): pause if credentials are needed, wait for user.
- Update the session file after all gates are complete.

---

## Phase 4: Iteration Decision

**After Iteration 1:**

- Present the "Must Fix" list (🔴 Critical / 🟡 Recommended / 🟢 Advisory).
- Instruct the user: "Apply these fixes, then reply `/design-system-review iterate`
  to trigger Iteration 2."
- **STOP here.** Do not proceed until the user responds.

**After Iteration 2 (`/design-system-review iterate`):**

- Re-read session file to confirm iteration = 2.
- Re-run only failed gates.
- Calculate alignment score.
- Branch:
  - **≥ 90%** → Call `create_knowledge_item` → Mark `READY_FOR_DESIGNER_GATE`
  - **< 90%** → Write to `docs/design-debt.md` → Mark `ESCALATED`

---

## Phase 5: Persistence

On **any** session completion (pass or escalation):

- Final `sequential-thinking` thought: summarize the full session outcome.
- Update the session file with final status and decision.
- If `READY_FOR_DESIGNER_GATE`: call `create_knowledge_item` with the KI
  schema from the skill.
- If `ESCALATED`: append a new entry to `docs/design-debt.md`:

```markdown
## [YYYY-MM-DD] <Component Name>

- **Status**: ESCALATED after 2 iterations
- **Alignment Score**: N%
- **Unresolved Gates**: <list>
- **Session File**: `scratch/design-review/<project>/session-<date>.md`
- **Action Required**: Manual designer review
```

---

*Companion skills: Always run `style-logic-exporter` first to extract current
token state. Run `accessibility-auditor` in parallel for WCAG coverage.*
