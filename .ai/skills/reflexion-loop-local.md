---
name: reflexion-loop-local
description:
  '[LOOP · LOCAL · SAME-MODEL] Fully offline model loop with same-model
  sequential self-critique, governed by a token and wall-clock budget.'
phase: plan
kind: skill
domain: eng
ownership:
  drive: ai
  approve: human
targets:
  - local
minModelClass: small
cost: ~0 tokens
modes: [read-only, write, mcp]
surface: public
category: Plan & Harden
policies:
  - four-pillars
---

# Reflexion Loop (Local Tier)

This workflow runs the exact same sequential self-correcting plan loop as the
standard reflexion-loop, but constrained to a single model instance. Because
local models are often smaller or slower, it uses the identical model for both
the generator and the critic steps, governed by an absolute wall-clock limit
(via `REFLEXION_MAX_WALLCLOCK_MS`) and a token limit.

- **Constraints**: No USD budget is applied (since it runs locally for free).
- **Enforcement**: Model isolation is downgraded to `same-model` via the
  `TIER_POLICY`.

Usage:

```bash
npm run reflexion -- --tier local "Your feature brief"
```
