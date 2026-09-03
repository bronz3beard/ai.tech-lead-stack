---
name: ui-spec-generator
description: >
  Architectural discovery engine for generating base skeleton UI components
  aligned with G-Stack modularity.
cost: ~850 tokens
modes: [read-only, mcp]
surface: public
category: Design & UI
phase: specify
kind: skill
domain: eng
ownership:
  drive: human-ai
  approve: human
targets: [local, api, subscription]
minModelClass: small
consumes: [intent-brief]
emits: [spec]
suggests: [planning-expert, vertical-slice-decomposer]
---

# UI Spec Generator (The Skeleton Engine)

## Runtime modes

Produces a verifiable UI spec blueprint in read-only chat, and executes +
verifies the generation phase in an IDE/MCP agent.

> [!IMPORTANT] **Diagnosis before Advice**: This skill follows the **G-Stack
> Ethos**. You must resolve the project structure and design system path
> (Discovery Phase) before generating any code. **MinimumCD** dictates that we
> generate small, atomic skeletons that are easily verifiable.
>
> **Methodology Alignment**: This skill strictly adheres to the four core
> pillars: **G-Stack Ethos**, **MinimumCD**, **Agent Skills**, and **Modern Web
> Guidance**.

## 🎯 Implementation Loop

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **IDE / MCP-enabled Agent:** You MUST call the MCP `get_skills` tool (which
    may be prefixed as `mcp_tech-lead-stack_get_skills` or
    `tech-lead-stack_get_skills` depending on client prefixing).
- **Action:** Identify root configuration files (`package.json`,
  `components.json`, `tailwind.config.ts`).
- **Design System Discovery (3-Tier Protocol):**
  1. **Tier 1 — Project Settings:** Check for `designSystemPath` in project
     settings.
  2. **Tier 2 — Monorepo Detection:** Inspect `pnpm-workspace.yaml`,
     `workspaces`, etc.
  3. **Tier 3 — Fallback:** Use standard `src/components/` or `components/`
     patterns.

### Step 1: Pattern Alignment (G-Stack)

- **Action:** Review 2-3 existing components to understand naming
  (`kebab-case`), export patterns, and Storybook co-location.
- **Constraint:** Maintain strict parity with the project's existing
  architectural decisions.

### Step 2: Skeleton Generation (MinimumCD)

- **Action:** Implement atomic UI atoms and page-level routes.
- **Constraint:** Use only Shadcn primitives and project-specific Tailwind
  tokens. **NO** arbitrary CSS.
- **Tooling:** Always run `npx shadcn-ui@latest add <component>` before
  implementation.

### Step 3: Handoff & Verification (Agent Skills)

- **Action:** Generate `task.md` for the developer.
- **Verification:** Ensure all code is strictly typed (TypeScript) and passes
  local linting checks.
- **Notification:** Update the team via the notification API once the branch is
  pushed.

## 🛠 Outcome Actions

- **Deliver:** Success notification with branch name and component output path.
- **Handoff:** Provide the synthesized `task.md` for developer implementation.
