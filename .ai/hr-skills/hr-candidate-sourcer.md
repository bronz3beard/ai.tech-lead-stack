---
name: hr-candidate-sourcer
description:
  Source passive candidates and enrich the pipeline with match-scored prospects.
  Bridges the gap between the JD requirement set and the live talent market.
cost: ~800 tokens
modes: [read-only, mcp]
surface: public
phase: build
kind: skill
domain: hiring
ownership:
  drive: human-ai
  approve: human
targets: [local, api, subscription]
minModelClass: small
consumes: [plan]
emits: [diff]
suggests: [code-review-checklist, pr-automator]
---

# HR Candidate Sourcer (The Precision Scout)

> [!IMPORTANT] **G-Stack Methodology**: Every sourcing run begins with **ATS
> Discovery**. The HR agent must understand the requisition's must-haves and the
> existing candidate pool before searching. Follow **MinimumCD** by identifying
> the smallest set of high-signal profiles that move the search forward.

## 🎯 Verification Gates (Match & Compliance)

### Phase 0: ATS Discovery (MANDATORY)

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Direct sourcing without requisition context is prohibited.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

- **Action:** Identify the JD must-haves and enumerate candidates already in the
  Ashby pipeline for this requisition.
- **Target Records:** Inspect the finalized JD, the Ashby candidate list, and
  prior outreach history.
- **MANDATORY Guardrail:** Focus ONLY on profiles that map to a stated must-have.
  Avoid "Goal Drift" by ignoring keyword-only matches or already-contacted
  candidates.

### Gate 1: Match Signal

- **Positive (Signal):** The profile evidences the must-have skills, seniority,
  and location constraints from the JD.
- **Negative (Noise):** Keyword-only matches, wrong seniority, or ineligible
  location.
- **Action:** If Negative, expand to adjacent titles and skill synonyms rather
  than lowering the bar.

### Gate 2: Outreach Compliance & Dedupe

- **Positive (Verified):** The candidate is not in-pipeline, not inside the
  outreach cooldown window, and sourcing respects platform and privacy norms.
- **Negative (Risk):** Re-contacting a live candidate or scraping restricted
  data.

## 📋 Outcome Actions

- **Deliver**: A compliance-checked "Sourcing Longlist" with a match score and
  status per prospect.
- **Ethos**: Signal over volume. A short list of well-matched, uncontacted
  prospects beats a wide net of noise.
