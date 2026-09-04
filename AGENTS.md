# AGENTS.md

> Read automatically by Jules — and by Cursor, Copilot, and most other
> AGENTS.md-aware tools — at the start of every task. This is the persistent
> version of the "Standing Rules" block in
> `docs/designs/2026-07-08-jules- prompts.md`. Once this file is committed to
> the repo root, you no longer need to paste that block before each prompt.
>
> This file is the cross-tool entry point. `.ai/agents.md` remains the internal,
> MCP/skill-oriented convention for IDE agents working in a local checkout
> (Antigravity, Cursor, VS Code) — the two complement each other and should not
> drift apart. Deeper per-workstream detail lives in `docs/designs/` and in each
> PROMPT's own text; this file stays short on purpose.

## Commands

```bash
npm run check-types && npm test && npm run validate:skills   # run + paste output before opening any PR
npm run format:check && npm run lint                          # must also pass
```

## Stack quirks

This project pins a Next.js version with breaking changes from what most
training data expects — APIs, conventions, and file structure may differ. Read
the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js
code. Heed deprecation notices. This is Pillar 1 in practice: ground decisions
in what's actually installed, not what's familiar.

## MCP tool naming

If your client connects to the `tech-lead-stack` MCP server (e.g. Cursor,
Antigravity, or a web chat UI) and a tool call like `get_skills` or
`verify_mission_alignment` fails as "not found," the client may have prefixed
the tool name — check for `mcp_tech-lead-stack_<tool>` or
`tech-lead-stack_<tool>` in your available tools list and call the resolved
name. Not applicable if your environment doesn't connect to this MCP server.

## Four Pillars — non-negotiable, and how your output is graded

1. **G-Stack / Diagnosis-First** — Phase 0 before any code: read `package.json`,
   `tsconfig.json`, `prisma/schema.prisma`, and the files named in your task.
   Ground every decision in what actually exists here.
2. **MinimumCD / Atomic Batches** — vertical slices under 100 LOC per commit,
   each independently verifiable. Never one big-bang commit.
3. **Production-Grade Ethos** — no "tests later," no "seems right." Every slice
   ends with real command output pasted into the PR. Catching yourself
   rationalizing a shortcut is the signal to stop and do it properly instead.
4. **Modern Web Guidance** — UI/web-facing code uses Server Components, Zod
   validation, semantic HTML/ARIA. No legacy workarounds.

## Policies & Execution

Agent policies and constraints are centrally enforced across the entire AI lifecycle. Note these critical architecture changes:
- **Nine Phases**: All work is categorized into exactly nine phases (intent, specify, plan, build, maintain, review, scale, deploy, polish). Every skill frontmatter and telemetry metadata payload MUST declare a valid phase.
- **Typed Artifact Handoffs**: Skills no longer pass arbitrary context. Deliverables (spec, plan, diff, etc.) are explicitly typed and handed off via Knowledge Items (KIs).
- **New MCP Tools**: We've introduced `plan_pipeline` to sequence orchestrators and `approve_knowledge_item` to formalize KI handoffs. Note that `get_skill` now appends a dependency graph footer outlining upstream/downstream connections.
- **Dynamic Policies (`.ai/policies`)**: Policy documents are loaded dynamically into agent contexts to guide operational decisions without hardcoding logic.
- **Hooks Layer (`.ai/hooks`)**: Ownership gates and capability boundaries are strictly enforced at MCP call-time and validated in CI via a dedicated hooks enforcer.
- **Execution Targets**: You operate under one of four execution tiers (`local`, `sub-pro`, `sub-max`, `byo`). Each has specific latency, context, and capability budgets (e.g., `local` enforces single-lane pipeline).

## Git discipline

Work only on the feature branch named in your task. Never merge, never touch
`main`, never force-push. Deliver via a single PR. (Extends `.ai/agents.md`,
which forbids `git push`/`git add` for agents in local checkouts — as a cloud
agent you may commit, but to **your own branch only**.)

## Code style

Strict TypeScript, no `any` without a justifying comment, early returns, Zod
validation on every API payload and external input.

## Scope

Don't rename, move, or "improve" files outside your task. If something
out-of-scope looks broken, write it in the PR under **"Observed friction"**
instead of fixing it — friction reports are first-class input here, not noise.
