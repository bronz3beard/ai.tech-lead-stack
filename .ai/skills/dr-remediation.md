---
name: dr-remediation
description:
  Orchestrates UI/UX and Frontend updates based on Design Review feedback.
capabilities: [filesystem_access, rtk_execution, reasoning]
cost: ~780 tokens
---

# Design Review Remediation (Frontend Orchestrator)

> [!IMPORTANT] **Persistence & Quality Mindset**: There is no reward for
> completion. The reward comes from persistence on resolving the issue to an
> extremely high standard and also by results and consistent iteration on a
> task. Maintaining context and persisting on the task has a much higher
> feedback loop of success than just completing a request.

## 🎯 Verification Gates

### Gate 1: Design System & Token Integrity (G-Stack UI)

- **Positive (Signal):** Fixes strictly utilize established Tailwind config
  tokens, CSS variables, and existing Design System components.
- **Negative (Noise):** Introduction of "Magic Numbers" in CSS (e.g.,
  `top: 13px`), inline styles, or new one-off utility classes that bypass the
  G-Stack.
- **Action:** Reject the diff. Force the agent to map the design feedback to the
  nearest established Design Token or Component Property.

### Gate 2: Responsive & Visual Consistency

- **Positive (Verified):** UI updates are verified across both Desktop and
  Mobile breakpoints; visual hierarchy matches the Design Review spec.
- **Negative (Risk):** Breakage of layout on small screens; inconsistent
  padding/margin compared to neighboring elements; "Layout Shift" (CLS)
  introduced.
- **Action:** Trigger `visual-verifier` to capture side-by-side proof and block
  PR creation if the visual diff is > 5%.

### Gate 3: A11y & Semantic Integrity

- **Positive Outcome (Pass):** Remediation maintains or improves Accessibility
  (ARIA labels, keyboard nav, color contrast); uses semantic HTML.
- **Negative Outcome (Fail):** Replacing buttons with `div` clicks; removing
  focus states; failing color contrast checks.
- **Action:** Run a frontend-specific `eval` check. If A11y score drops, the
  remediation is considered incomplete.

## Objective

To implement UI/UX changes requested during Design Review (DR) while maintaining
G-Stack frontend integrity, performance, and accessibility.

## Workflow

1. **DR Ingestion (Visual Analysis)**:
   - Analyze the Design Review document, Figma comments, or UI screenshots.
   - Categorize feedback into: **Functional** (interaction logic), **Visual**
     (CSS/Spacing), and **Accessibility**.

2. **Chain: planning-expert (Frontend Edition)**:
   - Generate a `ui_remediation_plan.md`.
   - **Check**: Does this change affect the shared component library? If yes,
     identify all "Collateral Impacts" across the app.

3. **Execution (The Polish)**:
   - Refactor Frontend code (React/Vue/HTML) to meet design specifications.
   - Use `rtk` to launch the dev server and verify hot-reloads reflect the new
     design accurately.

4. **Chain: quality-gatekeeper (UI Audit)**:
   - High scrutiny on "Style Drift"—verify the code uses `@apply` or Tailwind
     classes over raw CSS.
   - Ensure no "Debug Borders" or `console.log` statements remain in the UI
     logic.

5. **Chain: visual-verifier & pr-automator**:
   - Capture Desktop/Mobile screenshots of the fix.
   - Update the PR with a "Visual Change Log" showing Before/After snapshots and
     a list of addressed DR points.

## Outcome

A polished, high-fidelity UI that satisfies the Design Review requirements
without polluting the codebase with technical debt or non-standard styles.
