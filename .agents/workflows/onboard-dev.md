---
name: onboard-dev
description: Codebase Onboarding Intelligence
---

// turbo-all

1. **Phase 0: Tech-Stack Discovery (MANDATORY)**: Identify root configuration files to identify the language, framework, and dependency management.

2. Call the tech-lead-stack.get_codebase_onboarding_intelligence tool:
   - skillName: "codebase-onboarding-intelligence"
   - projectName: "<NAME_FROM_PACKAGE_JSON>" (Look at your root package.json "name" field or current directory name)
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

3. Follow its workflow to map out tech stack, patterns, and vitals.
