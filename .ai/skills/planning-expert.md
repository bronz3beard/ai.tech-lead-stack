---
name: planning-expert
description:
  Converts task descriptions into G-Stack optimized implementation plans.
---

# Planning Expert

## Objective

Transform a task URL or description into a structured `implementation_plan.md`.

## Workflow

1. **Analyze**: Ingest requirements from ClickUp/Jira. Use web-search if a URL
   is provided.
2. **Schema First**: If the change involves data, define the DB schema
   (Postgres) first.
3. **Logic Mapping**: Map out which files need to be created or modified.
4. **Test Strategy**: List exactly which unit and integration tests are required
   for a "Green" status.
5. **Output**: Create a step-by-step checklist for the coding agent to follow.
