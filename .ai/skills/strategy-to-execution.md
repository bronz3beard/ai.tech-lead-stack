---
name: strategy-to-execution
description:
  Orchestrator that translates Product Strategy into G-Stack Technical
  Implementation Plans.
cost: ~420 tokens
---

# Strategy-to-Execution (The Bridge)

> [!IMPORTANT] **Persistence & Quality Mindset**: There is no reward for
> completion. The reward comes from persistence on resolving the issue to an
> extremely high standard and also by results and consistent iteration on a
> task. Maintaining context and persisting on the task has a much higher
> feedback loop of success than just completing a request.

## Objective

To ensure that architectural decisions are directly mapped to product value
propositions and market differentiators.

## 🎯 Orchestration Pipeline

### Phase 1: Strategic Extraction

- **Input:** Product Strategy Document / Roadmap.
- **Action:** Extract the "Now" features and "Unique Value Propositions" (UVPs).
- **Verification:** Ensure every extracted feature has a defined "Success
  Metric."

### Phase 2: Technical Translation (Chain: planning-expert)

- **Action:** For each "Now" feature, trigger `planning-expert`.
- **Constraint:** The implementation plan MUST explicitly state how the code
  supports the "UVP."
- **Example:** If the UVP is "Real-time sync," the plan must prioritize
  WebSockets/Postgres Listen over polling.

### Phase 3: Risk & Compliance Audit (Chain: security-audit)

- **Action:** Run a `security-audit` on the proposed architecture.
- **Verification:** Ensure "Growth Strategy" components (like referral systems)
  don't introduce exfiltration risks.

### Phase 4: Quality Gatekeeping (Chain: quality-gatekeeper)

- **Action:** Initialize the development branch and set up the
  `PULL_REQUEST_TEMPLATE.md` with the "Strategic Goal" pre-filled.

## 🛠 Outcome Actions

- **Positive (Aligned):** Implementation plan is generated and mapped to a
  ClickUp Epic.
- **Negative (Misaligned):** Technical debt/complexity outweighs the SAM/SOM
  opportunity.
- **Action on Negative:** Generate a "Feasibility Gap Report" for the Product
  Strategist to review.
