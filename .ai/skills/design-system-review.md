---
name: design-system-review
description:
  AI-augmented design review with a strict 2-iteration guard, sequential memory
  persistence, and KI creation. Enforces Shadcn/Radix token alignment and
  coordinates designer quality gates.
cost: ~1100 tokens
---

# Design System Review (Iteration Guard)

> [!IMPORTANT] **Iteration Discipline**: This skill enforces a hard
> **2-iteration limit**. Iteration 1 produces feedback. Iteration 2 verifies
> fixes. If alignment is not reached by Iteration 2, the component is escalated
> — NOT reviewed a 3rd time. Context must be persisted to a scratch file at the
> start of every session so iteration count survives chat resets.
>
> [!IMPORTANT] **Credential Protocol**: If an external tool (Chromatic, Figma)
> is required during the audit, PAUSE execution, prompt the user for
> credentials, wait for their response, then resume. Never assume credentials
> are available. Never hard-code or log credential values.
>
> **Methodology Alignment**: This skill strictly adheres to the four core
> pillars: **G-Stack Ethos**, **MinimumCD**, **Agent Skills**, and **Modern Web
> Guidance**.

## 🎯 Verification Gates

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is
    strictly prohibited without first calling the skill tool.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool.
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

- **Action:** Identify the project's UI foundation.
- **Target Files:** Inspect `package.json`, `components.json` (Shadcn config),
  `tailwind.config.*`, and `globals.css`.
- **Confirm:** Which Shadcn/Radix primitives are installed? What Tailwind token
  namespace is in use (`--color-*`, `--spacing-*`, etc.)?
- **MANDATORY Guardrail:** Focus ONLY on UI/design configuration. Ignore
  unrelated logic, auth, and infrastructure files. Avoid Goal Drift.

### Phase 0.5: Session Memory Init (MANDATORY — runs before Phase 1)

Before doing ANY analysis:

1. **Check for existing session file:**
   - Path pattern:
     `scratch/design-review/<project-name>/session-<YYYY-MM-DD>.md`
   - If a file for today exists, READ it to restore iteration count and
     component state.
   - If no file exists, CREATE it with this template:

```markdown
# Design Review Session

- project: <project-name>
- component: <component-being-reviewed>
- started: <ISO timestamp>
- iteration: 1
- status: IN_PROGRESS
- figma_url: (not provided)
- chromatic_build: (not provided)

## Iteration 1 — Findings

(populate after audit)

## Iteration 2 — Verification

(populate after fix)

## Decision

(populate on completion)
```

1. **Report to user:** "Session file created/restored. Currently at Iteration
   **N**. Resuming from: `<status>`."

### Gate 1: Token Alignment

- **Positive (Pass):** Colors, spacing, radius, and typography use the project's
  defined Tailwind variables or CSS custom properties. No arbitrary values like
  `text-[#3a3a3a]` or `p-[13px]`.
- **Negative (Fail):** Hard-coded hex values, magic pixel values, or inline
  styles that bypass the token system.
- **Action on Fail:** List every violation with the file + line reference.
  Propose the correct token replacement.

### Gate 2: Shadcn/Radix Primitive Alignment

- **Positive (Pass):** Component uses the appropriate `@gilly-ui` primitive
  (Button, Dialog, Select, etc.) as its base. Radix accessibility attributes
  (`aria-*`, `data-state`, keyboard handlers) are present.
- **Negative (Fail):** Custom HTML elements used where a Shadcn primitive
  exists; missing focus management or keyboard navigation.
- **Action on Fail:** Identify the correct primitive and provide a migration
  snippet.

### Gate 3: Logic Consistency

- **Positive (Pass):** Component follows Early Returns, no mixed UI/data logic,
  Zod validation on inputs, no `any` types.
- **Negative (Fail):** Nested conditionals instead of early returns, inline
  fetch calls, missing error boundaries.

### Gate 4: Storybook Figma Link Validation

- **Action:** Check if the component has a Storybook story file
  (`*.stories.tsx`). If yes, verify it has `addon-designs` parameters with a
  Figma URL.
- **If Figma URL is missing:**
  - Ask: "Do you have a Figma frame URL for this component? (Paste it here or
    press Enter to skip)"
  - If provided: update the session file with `figma_url` and include it in
    audit output.
  - If skipped: flag as "Design Debt — No Figma link" in the session file.

### Gate 5: Chromatic / Visual Regression (Optional, credentials required)

- **Trigger:** Only runs if the user has connected a Chromatic build.
- **Credential Protocol:**
  1. Prompt: "To run Chromatic validation, I need your
     `CHROMATIC_PROJECT_TOKEN`. Please paste it here (it will only be used for
     this session and not stored)."
  2. **PAUSE** — do not proceed until user responds.
  3. On receipt: use the token to reference the build; report the build URL and
     whether all stories passed visual review.
  4. If user declines: mark Chromatic gate as "SKIPPED — manual review
     required."

---

## 🔄 Iteration Management

### Iteration 1 — Full Audit

1. Run Gates 1–5 (in order).
2. Produce a **"Must Fix"** list sorted by severity:
   - 🔴 **Critical** — Accessibility failure or token violation blocking release
   - 🟡 **Recommended** — Code consistency and design alignment
   - 🟢 **Advisory** — Nice-to-have improvements
3. Update session file `Iteration 1 — Findings` section.
4. Ask: "I've completed Iteration 1. Apply these fixes, then reply
   `/design-system-review iterate` to trigger Iteration 2 verification."

### Iteration 2 — Fix Verification

1. Re-read session file to confirm we're at Iteration 2.
2. Re-run only the **failed** gates from Iteration 1.
3. Calculate alignment score: `(gates_passed / total_gates) * 100`.
4. **Decision branch:**
   - **Score ≥ 90%** → Mark as `READY_FOR_DESIGNER_GATE`:
     - Update session file `status: READY_FOR_DESIGNER_GATE`
     - Call `create_knowledge_item` with the decision summary (see KI schema
       below)
     - Notify: "✅ Component is ready for designer gate review."
   - **Score < 90%** → Mark as `ESCALATED`:
     - Update session file `status: ESCALATED`
     - Create a `DESIGN_DEBT` entry in `docs/design-debt.md`
     - Notify: "⚠️ 2 iterations reached without 90% alignment. Escalated to
       manual designer review queue. A Design Debt record has been created."

---

## 📦 Knowledge Item Schema

When a review reaches `READY_FOR_DESIGNER_GATE`, call `create_knowledge_item`
with this structure:

```json
{
  "slug": "design-decision-<component-name>-<YYYY-MM-DD>",
  "summary": "One-line summary of what was approved or what deviation was accepted.",
  "projectName": "<detected-project-name>",
  "tags": ["design-system", "ui-review", "shadcn"],
  "artifacts": [
    {
      "name": "decision-details.md",
      "content": "## Component\n<component-name>\n\n## Decision\n<approved/deviated>\n\n## Rationale\n<why>\n\n## Figma URL\n<url or N/A>\n\n## Chromatic Build\n<url or SKIPPED>\n\n## Gates Passed\n<list>\n\n## Alignment Score\n<N>%"
    }
  ],
  "references": ["<PR link if known>", "<Storybook story URL if known>"]
}
```

---

## 🔍 Critical Patterns to Detect

- **Shadow DOM bypass:** Any component using `dangerouslySetInnerHTML` to inject
  styles — flag as Critical.
- **Hardcoded breakpoints:** `sm:`, `md:` used inconsistently with the project's
  layout strategy — flag as Recommended.
- **Missing `data-testid`:** UI components without test selectors make visual
  testing brittle — flag as Advisory.

## 🛠 Companion Skills

- Run `style-logic-exporter` BEFORE this skill to extract the current token
  state. Pass the output as context when starting the audit.
- Run `accessibility-auditor` in parallel on the same component to catch WCAG
  violations that are distinct from design token issues.

## 📋 Outcome Actions

- **`READY_FOR_DESIGNER_GATE`:** Proceed to designer approval handoff. Share
  Chromatic build link and KI slug with the design team.
- **`ESCALATED`:** Route to `docs/design-debt.md` and add to the Manual Review
  queue. Schedule a sync with a designer.
- **`IN_PROGRESS`:** Wait for the user to apply Iteration 1 fixes before calling
  `/design-system-review iterate`.
