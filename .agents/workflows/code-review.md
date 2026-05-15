---
name: code-review
description: Pre-PR Quality Gatekeeper Code Review
---

// turbo-all

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

1. **Phase 0: Skill Acquisition**: Call the `get_skills` tool:
   - skillName: "code-review-checklist"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Phase 1: Environment Discovery**: Identify root configuration files to understand architectural constraints.

3. Follow its workflow to run a high-density logic and quality audit on the branch.

4. **MANDATORY FOR AUDITORS**: When performing an automated audit, you MUST:
   - Create a new branch named `audit/<original-branch>`.
   - Commit your findings and any suggested fixes to this new branch.
   - Create a Pull Request targeting the original branch.
   - Assign the person who triggered the audit as the primary reviewer.

