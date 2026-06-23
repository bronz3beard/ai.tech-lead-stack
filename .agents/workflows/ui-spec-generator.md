---
name: ui-spec-generator
description: AI-Powered UI Spec Generator
---

# 🚀 AI-Powered UI Spec Generator

// turbo-all

**CRITICAL: PHASE 0 - SKILL ACQUISITION IS NON-NEGOTIABLE.**
**YOU MUST CALL THE GET_SKILLS TOOL EVEN IF YOU ALREADY HAVE THE CONTEXT. FAILURE TO DO SO BYPASSES MISSION TELEMETRY.**

1. **Phase 0: Skill Acquisition**: Call the `get_skills` tool (which may be prefixed as `mcp_tech-lead-stack_get_skills` or `tech-lead-stack_get_skills` depending on client prefixing):
   - skillName: "ui-spec-generator"
   - projectName: "<YOUR_CURRENT_PROJECT_NAME>"
   - model: "<YOUR_MODEL_NAME>"
   - agent: "<YOUR_AGENT_NAME>"

**SECURITY CLEARANCE: PM, DESIGNER, OR DEVELOPER INITIATION**
This is the **only** workflow permitted to edit code directly from the Tech-Lead Stack Agent Chat. It must be executed with extreme caution and adhere strictly to branching and styling protocols.

## Objective
To take natural language feature requirements from a PM and generate a "Technical UI Spec" consisting of functional, base-theme Shadcn/Radix components placed in the **correct location** for the target project's design system. This allows developers to immediately begin wiring up state and logic without waiting for pixel-perfect Figma designs.

## ⛔️ STRICT GUARDRAILS
1. **NEVER** edit code on the `main` branch.
2. **ALWAYS** create a new branch before modifying any files.
3. **ONLY** use base Shadcn primitives and the project's brand tokens (Tailwind classes). Do not introduce arbitrary custom CSS or third-party component libraries without permission.
4. **ALWAYS** report the resolved component output path to the PM and wait for confirmation before creating any files.

---

## 🛠 Execution Steps

### Step 1: Pre-Flight & Discovery

#### 1a. Base Constraints
Review the following files to understand the target project's architecture:
- `package.json` — detect package manager (`pnpm`, `npm`, `yarn`), workspaces config, and monorepo structure.
- `components.json` — Shadcn configuration and component alias paths.
- `tailwind.config.ts` — brand tokens and theme extensions.

#### 1b. Component & Design Mapping
- Analyze the requirements and map them to standard Shadcn components.
- **Source of Truth Check**: If a Figma Link was provided during initiation, scrape the link (using `firecrawl_scrape`) to extract layout, colors, and typography constraints before generating code.


#### 1c. 🗂️ Design System Discovery (3-Tier Protocol)
Determine where new UI atom components should be created. Execute the following tiers **in order**, stopping at the first match:

**Tier 1 — Project Settings (Highest Priority)**
Query the Tech-Lead Stack API for the project's configured `designSystemPath`:
```bash
curl -s <TECH_LEAD_STACK_URL>/api/projects/<PROJECT_ID>/settings \
  -H "Authorization: Bearer $TECH_LEAD_API_KEY"
```
If `settings.designSystemPath` is set (e.g. `libs/gilly-ui/src/components`), **use it directly**. Skip Tier 2 and Tier 3.

**Tier 2 — Monorepo Auto-Detection**
If no configured path, inspect the project root for monorepo signals:
- `pnpm-workspace.yaml` or `package.json` `"workspaces"` field
- `turbo.json` or `nx.json`
- A `packages/` or `libs/` directory

If a monorepo is detected, find the UI library package by looking for:
- A sub-package whose `package.json` `"scripts"` includes `storybook`
- A sub-package with a `src/components/` directory and UI-related dependencies (e.g., `@radix-ui/*`, `class-variance-authority`)

Use `<detected-ui-lib>/src/components/<feature>/` as the target path.

**Tier 3 — Fallback (Single App)**
If no monorepo is detected:
- Check if `src/components/` exists → use `src/components/<feature>/`
- Check if `components/` exists → use `components/<feature>/`
- If neither exists → **create** `src/components/<feature>/` and use it.

#### 1d. Confirm Output Path With PM
Before proceeding to branching, report the resolved path to the PM:
> *"I have resolved the component output path to: `<resolved-path>`. Is this correct?"*

**Do not proceed to Step 2 until the PM confirms.**

#### 1e. Codebase Pattern Review
Review 2–3 existing components in the resolved output path to understand:
- File naming conventions (`kebab-case.tsx` vs `PascalCase.tsx`)
- Import patterns (barrel exports via `index.ts` vs direct imports)
- Whether Storybook story files are co-located (`ComponentName.stories.tsx`)

---

### Step 2: Branching Protocol
You **must** execute these commands to ensure a clean workspace before editing code:
```bash
git checkout main
git pull
git checkout -b feature/ui-spec-<feature-name>
```
*(Replace `<feature-name>` with a concise, kebab-case representation of the feature).*

---

### Step 3: Skeleton Generation
1. For each required Shadcn component, run the add command using the project's detected package manager **before** writing any code that imports it:
   ```bash
   npx shadcn-ui@latest add <component>
   ```
2. Implement the requested feature inside the resolved output path from Step 1c.
   - Place **page-level** files at: `app/(routes)/[feature]/page.tsx`
   - Place **reusable UI atoms** at: `<resolved-component-path>/<feature>/`
   - If Storybook stories are co-located in this project, create a `<ComponentName>.stories.tsx` stub alongside each new atom.
3. Use dummy data or mocked interfaces where backend APIs are not yet defined.
4. Ensure all code is strictly typed (TypeScript) and uses Tailwind CSS for layout.
5. **Figma Alignment**: If a Figma link was provided, ensure the generated Tailwind classes match the extracted tokens from Step 1b.
6. Follow the exact naming and import patterns identified in Step 1e.

---

### Step 4: Commit & Push
Once the code is implemented and verified locally via linting or visual inspection (if applicable):
```bash
git add .
git commit -m "feat(ui-spec): generate base skeleton for <feature-name>"
git push -u origin feature/ui-spec-<feature-name>
```

---

### Step 5: Task Handoff & Dev Notification
1. Generate a `task.md` document for the developer in the root of the target project outlining:
   - **Component Location:** `<resolved-component-path>/<feature>/`
   - **Note:** All Shadcn/Radix components have already been added and installed. The developer only needs to run `pnpm install` (or the project's package manager) to sync their local `node_modules`.
   - The data wiring required to make the skeleton fully functional (API calls, Prisma queries, React Query hooks, form actions, etc.).
2. Hit the Tech-Lead Stack API to notify the developers that the branch is ready:
   ```bash
   curl -X POST <TECH_LEAD_STACK_URL>/api/notify/devs \
     -H "Content-Type: application/json" \
     -d '{"projectId": "<YOUR_PROJECT_ID>", "branchName": "feature/ui-spec-<feature-name>", "message": "UI Spec generated for <feature-name>. Components at: <resolved-component-path>/<feature>/"}'
   ```

---
**Completion:** Summarize the operation for the PM in the chat, including:
- The branch name
- The exact component output path used (and which discovery tier resolved it)
- Confirmation that the developers have been notified
