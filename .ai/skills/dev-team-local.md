---
name: dev-team-local
description:
  '[DEV-TEAM · LOCAL] Orchestrator for fully offline, single-lane execution.'
phase: build
kind: orchestrator
domain: eng
spans:
  - intent
  - specify
  - plan
  - build
  - review
targets:
  - local
minModelClass: small
ownership:
  drive: ai
  approve: human
cost: ~0 tokens
modes: [read-only, write, mcp]
surface: public
category: Orchestrators
policies:
  - four-pillars
---

# Dev Team Local Orchestrator

This is the offline analogue to the subscription-tier dev team orchestrators
(sub-pro/sub-max). It coordinates the single-lane pipeline through the same
phases (intent -> plan -> build -> review) but degrades execution to fit local
environments:

- **Single Lane**: Concurrency and worktrees are entirely disabled.
- **Local Model Loop**: Uses the identical model for all generative and critical
  steps (see `reflexion-loop-local`).
- **Offline Strictness**: Relies on a wall-clock and token budget without
  applying USD cost limits.

Usage: The execution flows exactly like `dev-team-sub-pro`, utilizing local
endpoints specified in `LOCAL_MODEL_ENDPOINT` and `LOCAL_MODEL_NAME`.

## Code Modification Convention

**REQUIREMENT:** When modifying files, you MUST use the `apply_patch` tool with
minimal SEARCH/REPLACE blocks instead of rewriting whole files.

- Never emit a full-file rewrite.
- Never restate unchanged code.
- **Rule:** Include only the lines that change plus minimal surrounding anchor
  context.
