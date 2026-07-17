---
name: design-system-review
description: >
  AI-augmented design review with a strict 2-iteration guard, sequential memory
  persistence, and KI creation. Enforces Shadcn/Radix token alignment, layout
  fidelity against the Figma frame, and coordinates designer quality gates.
cost: ~1400 tokens
modes: [read-only, write, mcp]
surface: public
---

# Design System Review (Iteration Guard)

## Runtime modes

Produces a verifiable design blueprint in read-only chat, and executes +
verifies the audit phase in an IDE/MCP agent.

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
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which
    may be prefixed as `mcp_tech-lead-stack_get_skills` or
    `tech-lead-stack_get_skills` depending on client prefixing).
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

### Gate 4: Layout Fidelity (MANDATORY for any UI-facing change — BLOCKING)

This gate exists because token alignment and primitive alignment do NOT prove
the built UI matches the design. A component can use every correct token and
Shadcn primitive and still be the wrong width, the wrong proportions, or reflow
its sub-elements incorrectly. Layout requirements stated in prose ("side by
side", "wider", "stacked") are CONSEQUENCES of building to the frame, never the
instruction. Build to the frame; the prose is a hint, the frame is the spec.

- **Fetch the design source at plan and review time (NON-NEGOTIABLE):** Retrieve
  the specific Figma node for this component via the Figma MCP `get_figma_data`
  tool — the actual frame, not a prose summary or a Phase-0 recollection. The
  Figma MCP `get_figma_data` fetch MUST happen when the plan/acceptance criteria
  are produced, and the plan MUST embed the actual fetched measurements. A plan
  that only PROMISES to fetch during execution, or that states goals like 'match
  Figma constraints' without concrete numbers, FAILS this gate and MUST NOT be
  approved. Follow the **Credential Protocol** in the header if the Figma MCP is
  not yet authenticated.
  - **Tool-name-robustness note:** The Figma fetch tool's base name is
    `get_figma_data` (from the figma-developer-mcp server) but MAY be exposed
    with a client prefix (e.g. `mcp_Figma_get_figma_data`). Use whichever name
    is actually present in the tool list. If NO Figma fetch tool is available,
    STOP and tell the human — do not proceed from memory or produce a plan
    without fetched numbers.
  - **Anti-deferral clause:** Deferring the fetch to execution is NOT
    acceptable. 'The execution step will call get_figma_data' is not a
    substitute for fetching now and recording the numbers. The frame is the
    spec; the numbers are the acceptance criteria.
  - **Required "Frame read" block:** This block must appear per screen/component
    IN THE PLAN, listing the concrete values pulled from the fetched node, e.g.:
    container width + max-width, column widths + gaps, key spacing/vertical
    rhythm, button width, and any breakpoint-specific values. If these numbers
    are absent, the plan is incomplete by definition.
  - If no Figma node/URL is available for this component, do NOT silently pass.
    Mark this gate `BLOCKED — no design source` and escalate per Gate 5 (Design
    Debt); a UI change with no design source cannot be verified as matching the
    design.
- **Render the built result:** Capture the implemented component (delegate to
  `visual-verifier` for the actual capture at the mandatory
  Desktop/Tablet/Mobile resolutions). For interactive screens, exercise the
  relevant states (default, focus, error, loading).
- **Produce an itemised Layout Deviation Report** comparing built vs frame. Each
  line is **MATCH** or **DEVIATION** with the specific difference:
  - Container / card width and max-width at each breakpoint.
  - Column widths and gaps for multi-column areas (e.g. side-by-side fields).
  - Element placement and vertical rhythm (label → input → helper/error
    spacing).
  - Responsive reflow: how sub-elements (helper text, requirement lists, labels)
    rearrange across breakpoints — a single list must not fragment across
    columns unless the frame shows it that way.
  - Button width, alignment, and inline-link placement.
- **Positive (Pass):** Every line in the Layout Deviation Report is MATCH across
  Desktop, Tablet, and Mobile.
- **Negative (Fail):** Any DEVIATION line. A DEVIATION is a 🔴 **Critical**
  finding — it BLOCKS completion. The component returns to the developer with
  the report until it is all-MATCH, or a specific deviation is explicitly waived
  by the Tech-Lead at a gate (record the waiver in the session file).
- **Action on Fail:** List each DEVIATION with the frame's target value vs the
  built value (e.g. "card max-width: frame 1100px, built ~720px"), and the
  concrete fix. Paste the final all-MATCH report as the gate's evidence.

> [!CAUTION] **Test-pass is not design-pass.** `check-types` and unit tests
> passing say nothing about visual fidelity. A UI-facing change is NOT complete
> until this gate's Layout Deviation Report is all-MATCH (or an explicit
> Tech-Lead waiver is recorded). Never mark a UI slice complete on tests alone.

### Gate 5: Storybook Figma Link Validation

- **Action:** Check if the component has a Storybook story file
  (`*.stories.tsx`). If yes, verify it has `addon-designs` parameters with a
  Figma URL.
- **If Figma URL is missing:**
  - Ask: "Do you have a Figma frame URL for this component? (Paste it here or
    press Enter to skip)"
  - If provided: update the session file with `figma_url` and include it in
    audit output.
  - If skipped: flag as "Design Debt — No Figma link" in the session file.

### Gate 6: Chromatic / Visual Regression (Optional, credentials required)

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

1. Run Gates 1–6 (in order). Gate 4 (Layout Fidelity) is BLOCKING for any
   UI-facing change.
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
