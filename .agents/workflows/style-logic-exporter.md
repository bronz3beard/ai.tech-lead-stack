---
name: style-logic-exporter
description: Export Tailwind v3.4 design tokens to Figma (Tokens Studio format)
---

# 🎨 Figma Token Exporter

// turbo-all

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

1. **Phase 0: Skill Acquisition**: Call the `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing):
   - skillName: "style-logic-exporter"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

> Supersedes the previous "Style Logic Exporter" skill. This workflow produces a
> machine-readable `figma-tokens.json` in **Tokens Studio v2** format, directly
> importable into Figma via the [Tokens Studio plugin](https://tokens.studio/).
> Compatible with Tailwind v3.4.

## Objective
To prevent design decay — when Tailwind tokens in code silently diverge from what
designers see in Figma — by providing an automated, repeatable export of the project's
current token state directly from `tailwind.config.ts`.

---

## ⛔️ Guardrails
1. Always export from the **target client project**, not from the Tech-Lead Stack itself.
2. The `figma-tokens.json` output is read-only for designers. Designers should
   **not** edit the JSON manually; changes must originate in `tailwind.config.ts`.
3. After exporting, run `pnpm tsc --noEmit` on the target project to confirm no
   config regressions were introduced.

---

## 🛠 Execution Steps

### Step 1: Identify the Target Project
- Confirm the absolute path to the target project (e.g., `/Users/dev/repos/gilly/client`).
- Verify a `tailwind.config.ts` (or `.js`) exists at the root.

### Step 2: Run the Token Exporter
From the **Tech-Lead Stack** root directory, execute:
```bash
npx ts-node scripts/export-tokens.ts --project <ABSOLUTE_PATH_TO_TARGET_PROJECT>
```
*(Example: `npx ts-node scripts/export-tokens.ts --project /Users/dev/repos/gilly/client`)*

### Step 3: Verify the Output
- Confirm `figma-tokens.json` was created in the target project root.
- Check the console output for the token count — a well-configured Tailwind project
  should export 50+ tokens.
- Open the file and spot-check that color values match the known brand palette.

### Step 4: Provide the JSON to the Designer
Report the output to the designer/PM with the following message:
> *"Tokens exported successfully. Import `figma-tokens.json` from the repo root
> into Figma via: Tokens Studio Plugin → `Load` → `From file`. The file contains
> [N] tokens covering colors, spacing, typography, border radius, and font families."*

### Step 5: Chromatic Sync Note (Optional)
If this export is being done as part of a design review, remind the team:
> *"After importing to Figma, run a Chromatic snapshot to confirm the rendered
> component matches the updated token values."*

---
**Completion:** Summarize what was exported (token count breakdown by category) and
confirm the `figma-tokens.json` file path.
