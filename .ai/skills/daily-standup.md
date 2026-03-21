---
name: daily-standup
description:
  Analyzes local git activity and task progress to generate a comprehensive
  2-day rolling standup report following a strict template.
capabilities: [filesystem_access, shell_access]
cost: ~500 tokens
---

# Daily Standup Report

> [!IMPORTANT] **Persistence & Quality Mindset**: There is no reward for
> completion. The reward comes from persistence on resolving the issue to an
> extremely high standard and also by results and consistent iteration on a
> task. Maintaining context and persisting on the task has a much higher
> feedback loop of success than just completing a request.

## 🎯 Verification Gates

### Gate 1: Activity Significance

- **Positive (Signal):** Detects meaningful feature commits, merged PRs, and
  resolved ClickUp tickets.
- **Negative (Noise):** Includes "Merge branch 'main'", typo fixes, or automated
  dependency bumps.
- **Action:** Filter all Negative noise to keep the standup concise and
  high-impact.

### Gate 2: Tone & Format

- **Positive (Pass):** Output is concise, uses emojis for scannability, and
  clearly identifies Blockers.
- **Negative (Fail):** Uses overly technical jargon or reads like a raw Git log.
- **Action:** Re-format content into the "Accomplishments / Focus / Impediments"
  specific structure.

## Objective

Generate a concise, high-impact status update based on actual repository
activity from the last 24 hours.

## Workflow Execution

1. **Activity Discovery**:
   - Identify all active branches.
   - Run
     `git log --author="$(git config user.name)" --since="2 days ago" --pretty=format:"%s"`
     across the project.
2. **Context Synthesis**:
   - Categorize activity into: **Features**, **Bug Fixes**, **Reviews**, and
     **Ops**.
   - Cross-reference commit messages with ClickUp task IDs if present.
3. **Drafting**:
   - Summarize the last 2 days of work (rolling date) based on the collected
     context.
   - **Only output a template of an update that follows the format below.**
   - Do NOT automate a Slack message or anything like that.

## Output Structure

⭐️ Feature: [Briefly describe the main functionality or goal of the day with
ticket link if applicable.] ✅ Delivered: [Write what you completed or delivered
yesterday. For example, "Finished the API implementation" or "Submitted
documentation to the client” with ticket link if applicable.] ➡️ Needs Review:
[List the tasks or deliverables that need review by a teammate, lead, or client.
For example, "Waiting for feedback on the new design from the team." with ticket
link if applicable.] ⏳ Waiting On: [Describe what you’re waiting for, whether
it’s from the client, a teammate, or an external dependency. For example,
"Waiting for the client’s confirmation on the sprint scope." with ticket link if
applicable.] 📝 Plans for Today: [Explain what you’ll work on today. Be clear
and specific about your daily objectives. For example, "Working on the filter
component for the product page." with ticket link if applicable.] 📅 Plans for
Tomorrow: [Detail your planned objectives for the next day. This could include
new tasks or a continuation of the current ones. For example, "Completing the
remaining unit tests." with ticket link if applicable.] 🧉 Other Information:
[Include any additional information that might be relevant, such as blockers,
priority changes, or personal circumstances affecting your work.]
