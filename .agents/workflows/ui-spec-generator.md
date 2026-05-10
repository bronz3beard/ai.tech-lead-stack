---
name: ui-spec-generator
description: AI-Powered UI Spec Generator
---

# 🚀 AI-Powered UI Spec Generator

**SECURITY CLEARANCE REQUIRED: PM INITIATION ONLY**
This is the **only** workflow permitted to edit code directly from the Tech-Lead Stack Agent Chat. It must be executed with extreme caution and adhere strictly to branching and styling protocols.

## Objective
To take natural language feature requirements from a PM and generate a "Technical UI Spec" consisting of functional, base-theme Shadcn/Radix components. This allows developers to immediately begin wiring up state and logic without waiting for pixel-perfect Figma designs.

## ⛔️ STRICT GUARDRAILS
1. **NEVER** edit code on the `main` branch.
2. **ALWAYS** create a new branch before modifying any files.
3. **ONLY** use base Shadcn primitives and the project's brand tokens (Tailwind classes). Do not introduce arbitrary custom CSS or third-party component libraries without permission.

---

## 🛠 Execution Steps

### Step 1: Pre-Flight & Discovery
1. Identify the current target repository constraints by reviewing `package.json`, `components.json`, and `tailwind.config.ts`.
2. Analyze the PM's requirements and map them to standard Shadcn components (e.g., "data table" -> `DataTable`, "calendar" -> `Calendar`, `Popover`).
3. Ensure alignment with the 3 pillars of the ethos and methodology. Review existing patterns in the codebase to ensure consistency in component implementation and file structure.

### Step 2: Branching Protocol
You **must** execute these commands to ensure a clean workspace before editing code:
```bash
git checkout main
git pull
git checkout -b feature/ui-spec-<feature-name>
```
*(Replace `<feature-name>` with a concise, kebab-case representation of the feature).*

### Step 3: Skeleton Generation
1. Implement the requested feature inside the appropriate directory (e.g., `app/(routes)/[feature]/page.tsx` or `components/features/[feature].tsx`).
2. Use dummy data or mocked interfaces where backend APIs are not yet defined.
3. Ensure all code is strictly typed (TypeScript) and uses Tailwind CSS for layout.

### Step 4: Commit & Push
Once the code is implemented and verified locally via linting or visual inspection (if applicable):
```bash
git add .
git commit -m "feat(ui-spec): generate base skeleton for <feature-name>"
git push -u origin feature/ui-spec-<feature-name>
```

### Step 5: Task Handoff & Dev Notification
1. Generate a `task.md` document for the developer in the root of the target project outlining:
   - The required `npx shadcn-ui@latest add <component>` commands if new primitives are needed.
   - The data wiring required to make the skeleton fully functional.
2. Hit the Tech-Lead Stack API to notify the developers that the branch is ready:
   ```bash
   curl -X POST <TECH_LEAD_STACK_URL>/api/notify/devs \
     -H "Content-Type: application/json" \
     -d '{"projectId": "<YOUR_PROJECT_ID>", "branchName": "feature/ui-spec-<feature-name>", "message": "UI Spec generated for <feature-name>"}'
   ```
   *(Note: The PM or the environment should provide the correct `<TECH_LEAD_STACK_URL>` and `<YOUR_PROJECT_ID>`).*

---
**Completion:** Summarize the operation for the PM in the chat, providing the branch name and confirming the developers have been notified.
