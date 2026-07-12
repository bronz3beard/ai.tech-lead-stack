# Defect Library

## Purpose

The Defect Library is used to test the code review workflow (the Reflexion
Loop's Critic). A loop whose evaluator has never said "no" has no real check. We
seed this library with deliberately flawed implementation plans to assert that
the reflexion CRITIC rejects each one for the right reasons. We also include a
golden PASS case to ensure the critic doesn't drift into rejecting everything.

## Violation-Class Taxonomy (The Four Pillars)

Every defect must map to one of the Four Pillars evaluated by the critic:

1. **gstackDiagnosis:** Missing or generic Phase-0 stack discovery (ignoring the
   actual project).
2. **atomicBatches:** "Big bang" integration steps, lack of vertical slicing, or
   steps that clearly exceed 100 LOC.
3. **productionEthos:** "Add tests later" attitude, lack of evidence-bearing
   verification, or "looks right" shortcuts.
4. **modernWeb:** Using legacy web APIs where modern, performant, accessible,
   and secure alternatives exist.

## The Growth Rule

"Every 'the reviewer missed X' friction defect adds a DL case reproducing X —
prevent the class, not the instance." When the critic allows a bad plan to pass,
we don't just tweak the prompt. We create a new case in this library reproducing
the class of error to prevent it from ever happening again.

## How to Run

You can run the full evaluator calibration test suite using the `rtk` tool:

```bash
# Ensure ANTHROPIC_API_KEY is set in your environment
export ANTHROPIC_API_KEY=your_key_here

# Run all cases
rtk run reflexion-eval

# Run a specific case
rtk run reflexion-eval --case DL-003

# Output as JSON
rtk run reflexion-eval --json
```
