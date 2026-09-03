---
name: hr-endorsement-synthesizer
description:
  Synthesize resumes and raw interviewer notes into an evidence-traceable client
  shortlist of the top 3-5 applicants. Focuses on source fidelity, ranking
  integrity, and a Gemini-driven synthesis pass.
cost: ~950 tokens
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
suggests: [code-review-checklist, pr-automator, hr-interview-auditor]
---

# HR Endorsement Synthesizer (The Synthesis Engine)

> [!IMPORTANT] **G-Stack Methodology**: Every endorsement begins with **ATS
> Discovery**. The agent must gather the interview notes, resumes, and scorecards
> before synthesizing. Follow **MinimumCD** by grounding every endorsement claim
> in the smallest verifiable unit of evidence.

## 🎯 Verification Gates (Evidence & Ranking Integrity)

### Phase 0: ATS Discovery (MANDATORY)

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **FORBIDDEN:** Drafting an endorsement without interview evidence is prohibited.
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing).
  - **Chat UI (/chat):** You MUST call the internal `get_skill` tool.

- **Action:** Identify the interviewed candidates, their resumes, and their raw
  interview notes.
- **Target Records:** Inspect the `hr-interview-auditor` scorecards, resumes, the
  JD scorecard, and the agreed endorsement volume from the onboarding brief.
- **MANDATORY Guardrail:** Focus ONLY on interviewed candidates for this
  requisition. Avoid "Goal Drift" by ignoring any signal not tied to the JD
  scorecard.

### Gate 1: Evidence Fidelity

- **Positive (Signal):** Every endorsement claim maps to a resume line or an
  interviewer note.
- **Negative (Noise):** AI-introduced qualifications, inferred seniority, or
  invented metrics.
- **Action:** If Negative, strike the unsourced claim and re-run synthesis with
  the source map enforced.

### Gate 2: Ranking Integrity

- **Positive (Verified):** The ranking reflects weighted scorecard performance;
  ties break on job-relevant evidence.
- **Negative (Risk):** Ranking driven by resume prestige, recency bias, or a
  padded slate beyond the agreed 3-5.

## 🛠 Analysis Layer (The Hands)

### 1. Source Bundle

- Assemble the resume, raw interviewer notes, and scorecard for each candidate.

### 2. Constrained Synthesis (Gemini)

- Prompt Gemini to summarise **only** from the bundle, tagging each output
  sentence to its source; strike untagged claims. The recruiter approves the
  final ranking before the report ships.

## 📋 Outcome Actions

- **Deliver**: An "Endorsement Report" naming the top 3-5 applicants, each claim
  tagged to its source.
- **Ethos**: The model drafts, the recruiter decides. Gemini synthesises; it
  never adjudicates fact.
