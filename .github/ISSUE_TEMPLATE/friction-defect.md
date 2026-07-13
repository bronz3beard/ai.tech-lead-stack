---
name: Friction Defect
description: Report an issue where a skill or agent behaved poorly, required excessive rework, or deviated from its prompt.
labels: ["friction"]
---

### Observed vs Expected Behavior
**Observed:**
[Describe what the agent did wrong]

**Expected:**
[Describe what the agent should have done]

### Skill Involved
[Which skill was running? e.g. dev-team-orchestrator, feature-orchestrator, vertical-slice-decomposer]

### Reproduction
[How to trigger this defect? Include inputs, states, or prompts if possible]

### Rework Count
[How many loops were required to resolve this? (Triggers at >=2 rework loops on one gate)]

### Proposed Prevention Class
[What rule, validation, or prompt change would prevent this entire *class* of errors, not just this instance?]

### Link to DL Case
[Link to the Defect Library case this will become per `defect-library/README.md`]
