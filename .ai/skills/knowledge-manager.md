---
name: knowledge-manager
description: >
  Manage project-specific knowledge items to maintain persistent context and
  architectural memory.
cost: ~450 tokens
modes: [read-only, write, mcp]
surface: internal
internal: true
---

# Knowledge Manager

## Runtime modes

Produces a verifiable knowledge blueprint in read-only chat, and executes +
verifies the capture phase in an IDE/MCP agent.

You are an expert at capturing and retrieving architectural context and
project-specific "gotchas" using the Antigravity Knowledge Items (KI) system.

## When to use this skill

- **At the start of a task**: Call `list_knowledge_items` to see if there are
  relevant KIs for the current project.
- **When encountering complex patterns**: Call `read_knowledge_item` to
  understand established repository patterns or past decisions.
- **After completing a significant task**: Call `create_knowledge_item` to
  capture new insights, architectural decisions, or discovered edge cases that
  would benefit future agent sessions.

## Core Pillars

> [!TIP].
>
> **Methodology Alignment**: This skill strictly adheres to the four core
> pillars: **G-Stack Ethos**, **MinimumCD**, **Agent Skills**, and **Modern Web
> Guidance**.

### 1. Persistence

Knowledge Items are accessed via the MCP tools (`list_knowledge_items`,
`read_knowledge_item`, `create_knowledge_item`) and persist across
conversations. The default backend note storage is
`~/.gemini/antigravity/knowledge/`. Use them to bridge the gap between ephemeral
chat history and the long-term repository evolution.

### 2. Scoping

Knowledge Items are automatically project-scoped by default. Use the
`projectName` field to ensure items are retrieved only when relevant to the
current repository.

### 3. Contextual Injection

When reading a Knowledge Item, integrate its "artifacts" into your current
reasoning. Do not just read them; apply the lessons learned to your current code
edits.

## Available Tools

### `list_knowledge_items`

Lists slugs and summaries of all available KIs. Always start here if you suspect
relevant context exists.

### `read_knowledge_item`

Retrieves the full metadata and all artifact files for a specific KI slug.

### `create_knowledge_item`

Captures new knowledge.

- **Slug**: Use descriptive, kebab-case names (e.g., `auth-middleware-pattern`,
  `prisma-postinstall-guard`).
- **Summary**: A high-level description of what the knowledge item contains.
- **Artifacts**: A list of files containing the actual knowledge (e.g.,
  `lessons.md`, `example.ts`, `checklist.md`).
- **References**: Include conversation IDs or issue numbers for traceability.

## Workflow Example

1. **Discovery**: `list_knowledge_items({ projectName: "tech-lead-stack" })`
2. **Retrieval**: `read_knowledge_item({ slug: "prisma-migration-strategy" })`
3. **Application**: Apply the strategy to the current task.
4. **Retention**:
   `create_knowledge_item({ slug: "ki-system-integration-lessons", summary: "Lessons learned during KI system implementation", ... })`

## Verification Gate (Hard Evidence)

- **MANDATORY**: Paste the created KI's `read_knowledge_item` output as
  verification.
