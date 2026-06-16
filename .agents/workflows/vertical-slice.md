---
name: vertical-slice
description: Decompose user stories into ClickUp-ready vertical slices
---

// turbo-all

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

1. **Phase 0: Skill Acquisition**: Call the `get_skills` tool:
   - skillName: "vertical-slice-decomposer"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

2. **Phase 0 (cont): Domain & Infra Discovery**: Identify the tech stack, the
   team's domain boundary (UI contract vs API contract), the dark-release gate
   (`beta_*` cookies / `x-beta-flags`), and the mocking layer (backend-first vs
   MSW fallback). If the user attaches **design screenshots or Figma URLs**,
   treat them as in-scope spec: read Figma via the Figma MCP/connector when
   available (else request an exported frame), and extract the states/variants
   shown — each is a candidate slice boundary.

3. **Run the skill workflow**: Build the Slice Ledger from the input story/
   stories and any design frames, slice vertically (deployability test + BDD
   boundaries + design states), decide beta-flag and mock-vs-real per slice, and
   emit ClickUp-ready task blocks per the Output Contract (including the Design
   reference field).

4. **Anti-drift**: This is iterative. After any detour into a single slice's
   detail or error resolution, fold the result back into that slice, reprint the
   Ledger, and resume the decomposition queue. Never abandon a pending slice.

5. **Deliver**: A `vertical-slices.md` handoff (paste-ready for ClickUp) plus the
   final Ledger. Do NOT auto-create ClickUp items unless a ClickUp connector is
   present AND the user explicitly confirms.
