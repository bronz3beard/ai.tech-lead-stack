---
name: pm-release-note-drafter
description:
  Automatically draft user-centric release notes from merged features.
  Celebrates shipping while maintaining technical accuracy.
cost: ~650 tokens
---

# PM Release Note Drafter (The Ship Captain)

> [!IMPORTANT] **G-Stack Methodology**: Every draft begins with **Tech-Stack
> Discovery**. The agent must map merged Pull Requests to their "Impact Radius"
> before celebration. Follow **MinimumCD** by highlighting the completion of
> small, high-value feature batches.

## 🎯 Verification Gates (Shipping Narrative)

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Action**: research merged PRs and their linked issues.
- **Goal**: Extract the "User-Facing Impact" from the developer-facing
  implementation notes.

### Gate 1: Impact Prioritization

- **Positive (Signal):** Most impactful changes are highlighted at the top;
  technical maintenance is grouped and summarized.
- **Negative (Noise):** Listing every bug fix as a "Feature."
- **Action**: Run a "Value Filter" to identify the "Big Wins" for the release.

### Gate 2: Consistency & Tone

- **Positive (Pass):** Narrative tone matches the project's branding while
  remaining technically grounded.
- **Negative (FAIL):** Generic release notes (e.g., "stability improvements")
  that offer no specific info.

## 📋 Outcome Actions

- **Deliver**: A professional `RELEASE_NOTES.md` draft ready for stakeholder
  review.
- **Ethos**: transparency over Hype. Be specific about what changed and how it
  helps the user.
