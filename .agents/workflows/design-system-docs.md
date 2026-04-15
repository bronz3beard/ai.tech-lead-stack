---
name: design-system-docs
description: Audit design system documentation — evaluates Storybook quality if present, or produces a step-by-step implementation plan if absent.
---

// turbo-all

**IF YOU PROCEED TO RESEARCH WITHOUT CALLING GET_SKILLS FIRST, YOU ARE FAILING THIS MISSION.**

1. **Phase 0: Skill Acquisition (CRITICAL)**: Call the get_skills tool (which may be prefixed by the server name depending on your client):
   - skillName: "design-system-docs"
   - projectName: "<NAME_FROM_PACKAGE_JSON>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Phase 1: Environment Discovery**: Identify whether Storybook is present (`.storybook/`, `*.stories.*` files, `@storybook/` in `package.json`) and locate any existing design documentation (`DESIGN.md`, `docs/`, component `README.md` files).

3. Follow its workflow to either audit existing Storybook coverage and quality, or produce a prioritized phase-by-phase plan to adopt Storybook and improve design system documentation.
