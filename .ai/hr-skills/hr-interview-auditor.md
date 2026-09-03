---
name: hr-interview-auditor
description:
  Evaluate applicants against the requisition scorecard with evidence-backed
  ratings. Focuses on rubric coverage, evidence capture, and bias control.
cost: ~700 tokens
modes: [read-only, mcp]
surface: public
phase: review
kind: skill
domain: hiring
ownership:
  drive: human-ai
  approve: human
targets: [local, api, subscription]
minModelClass: small
consumes: [diff]
emits: [review-report]
suggests: [pr-automator, qa-handover-generator, hr-endorsement-synthesizer]
---

# HR Interview Auditor (The Signal Auditor)

> [!IMPORTANT] **G-Stack Methodology**: Every interview begins with **ATS
> Discovery**. The agent must review the resume and the JD scorecard before the
> conversation. Follow **MinimumCD** by grounding each competency rating in the
> smallest verifiable piece of behavioural evidence.

## 🎯 Verification Gates (Rubric Integrity)

### Phase 0: ATS Discovery (MANDATORY)

- **Action**: Research the applicant's resume, the JD scorecard, and the current
  Ashby stage.
- **Goal**: Map every must-have competency to at least one planned question.

### Gate 1: Rubric Coverage

- **Positive (Signal):** Every must-have competency on the scorecard was probed
  with at least one question.
- **Negative (Noise):** Whole competency areas left unassessed, or time spent on
  off-rubric tangents.
- **Action**: If Negative, re-cover the missed competency before closing the
  interview.

### Gate 2: Evidence & Bias Gate

- **Positive (Verified):** Each rating is backed by a specific example or quote,
  and references job-relevant evidence only.
- **Negative (Risk):** "Seemed strong" with no example, or affinity/halo signals
  standing in for evidence.

## 📋 Outcome Actions

- **Deliver**: Structured "Interview Notes" and a scored rubric, ready for
  `hr-endorsement-synthesizer` ingestion.
- **Ethos**: No score without evidence. A rating a client cannot trace to a
  concrete signal is void.
