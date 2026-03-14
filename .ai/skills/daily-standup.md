---
name: daily-standup
description:
  Analyzes local git activity and task progress to generate a professional daily
  status update.
capabilities: [filesystem_access, shell_access]
---

# Daily Standup Report

## Objective

Generate a concise, high-impact status update based on actual repository
activity from the last 24 hours.

## Workflow Execution

1. **Activity Discovery**:
   - Identify all active branches.
   - Run
     `git log --author="$(git config user.name)" --since="24 hours ago" --pretty=format:"%s"`
     across the project.
2. **Context Synthesis**:
   - Categorize activity into: **Features**, **Bug Fixes**, **Reviews**, and
     **Ops**.
   - Cross-reference commit messages with ClickUp task IDs if present.
3. **Drafting**:
   - **Yesterday**: What was actually pushed/merged.
   - **Today**: What is currently "In Progress" (based on uncommitted changes or
     active branch).
   - **Blockers**: Identify any open TODOs or failing tests (using the `eval`
     tool) that are preventing progress.
4. **Formatting**: Output the report in a format suitable for Slack, ClickUp, or
   a Standup meeting.

## Output Structure

- **🚀 Accomplishments**: List of completed items with impact notes.
- **📅 Today's Focus**: Current priority tasks.
- **🛑 Impediments**: Technical blockers or pending reviews.
