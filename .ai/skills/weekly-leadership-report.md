---
name: weekly-leadership-report
description:
  Extracts technical progress from Git history and ClickUp sprints using browser
  automation to synthesize high-fidelity leadership reports.
cost: ~1200 tokens
---

# Weekly Leadership Report

> [!IMPORTANT] **G-Stack Ethos**: Diagnosis before Advice. Perform a silent
> environmental audit before data extraction. **Silent Execution Rule**: Do NOT
> output intermediate plans, thoughts, or tool-call reasoning. Perform all
> gathering silently and ONLY output the final markdown code block.

## Phase 0: Discovery & Diagnosis (Silent)

Before data extraction, verify the environment:

1. **Git Audit**: Verify current directory is a git repository. Run
   `git rev-parse --is-inside-work-tree`.
2. **Versioning Check**: Detect the last two major git tags to determine the
   versioning span.
3. **Authentication Audit**: Verify that `chrome-devtools-mcp` can access an
   active session. Take a tiny screenshot or check page title of a known URL to
   ensure the user is logged into ClickUp.
4. **Project Identification**: Identify the project name from the root directory
   or `package.json`.

## Phase 1: Action (Data Intelligence)

### 1. Git Intelligence (Team-Wide)

- **Log Extraction**: Run `git log origin/main --since="7 days ago" --oneline`.
- **Role Analysis**:
  - **DEVS**: Analyze changes in `src/`, `prisma/`, and core logic.
  - **QA**: Analyze `*.test.ts`, `tests/`, and PR titles containing "QA".
  - **DESIGN**: Analyze `public/assets`, CSS/SCSS, and UI components.
- **Milestone Filter**: Group changes into "MIGRATIONS", "FEATURES", and
  "UI/UX".

### 2. ClickUp Scraping (Browser-Based)

- **Navigation**: Use `mcp_chrome-devtools-mcp_navigate_page` to the provided
  Sprint URLs.
- **Extraction**: Use `mcp_chrome-devtools-mcp_take_snapshot` or
  `mcp_chrome-devtools-mcp_take_screenshot` to identify tasks in `DONE`,
  `READY FOR QA`, and `CODE REVIEW`.
- **Metadata**: Extract `Target version` and `Environment` tags from the task
  view.

### 3. Synthesis

- Consolidate Git commits and ClickUp task statuses.
- Map the versioning spans detected in Phase 0 to the current achievements.

## MinimumCD & Quality Verification

1. **Integrity Gate**: Verify the Git log is not empty. If empty, alert the user
   regarding the date range.
2. **Authentication Gate**: If ClickUp navigation fails due to login screens,
   halt and request the user to refresh their Chrome session.
3. **Format Gate**: Ensure the final output is wrapped in a **single Markdown
   code block** for easy copy-pasting.
4. **Content Audit**: Ensure "Minor Concerns" captures roles that appear
   inactive in the git log (e.g., no QA commits = potential bottleneck).

## 📝 Report Template (FORCE OUTPUT INTO CODE BLOCK)

\`\`\`markdown

## Weekly Leadership Report - [Project Name]

[Project Name] [Date]

~ Status [🟢🟡🔴] [Brief high-level health summary]

~ Brief MIGRATIONS [vX.X.X] [Feature Name] 🆗 [Status] [vY.Y.Y] [Feature Name]
🆗 [Status]

OTHER FEATURES [vA.B.C] [Feature Name] 🆗 [Status]

~ Minor Concerns ‼️ [Document bottlenecks, team fatigue, or role-specific
challenges (e.g., QA falling behind)]

~ Achievements & fails 🥇🥈🥉 [Section for major technical milestones, migration
progress, or notable failures/learnings] \`\`\`
