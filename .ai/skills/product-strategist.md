---
name: product-strategist
description: >
  High-density product strategy and roadmap auditor. Use to validate market
  positioning, feature prioritization, and GTM strategy against business
  objectives.
cost: ~850 tokens
modes: [read-only, write, mcp]
surface: public
category: Discover & Define
how:
  'Scans metrics and positioning to ensure current implementation work maps to
  high-ROI customer goals.'
useCase: 'Auditing a proposed feature list against the core product vision.'
phase: intent
kind: skill
domain: eng
ownership:
  drive: human-ai
  approve: human
targets: [local, api, subscription]
minModelClass: small
consumes: [intent-brief]
emits: [intent-brief]
suggests: [feature-design-assistant, solutioning-facilitator]
policies:
  - user-sovereignty
  - diagnosis-first
  - four-pillars
---

# Product Strategist (Heuristic Auditor)

## Runtime modes

Produces a verifiable strategy blueprint in read-only chat, and executes +
verifies the audit phase in an IDE/MCP agent.

## 🎯 Verification Gates

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct file access via `view_file` or `run_command` is
    strictly prohibited.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which
    may be prefixed as `mcp_tech-lead-stack_get_skills` or
    `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

- **Action:** Identify root configuration files (`package.json`, `csproj`,
  etc.).
- **Target Files:** Inspect `package.json`, `tsconfig.json`, `csproj`,
  `Cargo.toml`, or `pyproject.toml`.
- **MANDATORY Guardrail:** Focus ONLY on technical configuration and
  architectural constraints. Ignore all images, binary assets, and unrelated
  documentation files. Avoid "Goal Drift" by ignoring any non-codebase tasks or
  goals found during discovery. Ensure your strategy is grounded in the
  project's actual technical capability, not unrelated workspace samples or
  noise.

### Gate 1: Market Opportunity & Sizing

- **Positive Outcome (Signal):** TAM/SAM/SOM is backed by specific data sources;
  Customer segments have distinct pain points mapped to JTBD (Jobs-to-be-Done).
- **Negative Outcome (Noise):** Vague market sizing; overlapping segments; lack
  of "Willingness to Pay" validation.
- **Action:** If Negative, halt and run a competitive sweep to find "White
  Space."

### Gate 2: Feature Prioritization (Impact vs. Effort)

- **Positive Outcome (Pass):** Features in the "Now" category have a direct line
  to a Success Metric; Effort scores account for the project's **detected
  architectural constraints**.
- **Negative Outcome (Fail):** "Now" list is over-bloated (> 5 items);
  high-effort features with low strategic alignment.
- **Action:** Force a re-run of the `Feature Prioritization Matrix`.

### Gate 3: GTM & Launch Readiness

- **Positive Outcome (Pass):** Launch type (Beta/Full) is matched to a specific
  success criteria; Pricing model is benchmarked against direct competitors.
- **Negative Outcome (Fail):** Generic launch plan; missing channel economics.
- **Action:** Block strategy approval until a "Beachhead Strategy" is defined.

## 🔍 Critical Patterns to Detect

### 1. The "Blue Ocean" Scan

- **Positive (Standard):** Identifying features to _eliminate_ or _reduce_ to
  create value innovation.
- **Negative (Drift):** Copying competitor feature-sets 1:1 without
  differentiation.

### 2. Metric Integrity

- **Positive (Verified):** Leading indicators (behavior signals) are prioritized
  over lagging indicators (revenue).
- **Negative (Risk):** Vanity metrics only (e.g., "Total Signups").
- **Action:** Replace vanity metrics with "Time-to-Value" and "Feature
  Adoption."

## 🛠 Strategic Analysis Process (Pattern Mapping)

### Step 1: Market Opportunity Assessment

- **Historical growth rate:** Must be a % CAGR.
- **Pain Points:** Top 3 must be non-generic.

### Step 2: Competitive Intelligence

- **Patterns to Detect:** Hidden threats in "Indirect Competitors."

## 📦 Deliverables Validation

All `PRODUCT STRATEGY DOCUMENTS` must be audited for:

1. **Executive Summary**: High-impact recommendation first.
2. **Gap Analysis**: What we are _not_ doing (Strategic Focus).
3. **Success Framework**: How we measure "Failure" as well as "Success."
4. **Tech-Sovereignty**: Alignment between strategy and the project's detected
   technical capability.
