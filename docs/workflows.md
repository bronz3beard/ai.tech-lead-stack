# Workflow Catalogue

[← Back to the README](../README.md)

There are 51 workflows available across three domains. `--ide claude-code`
installs all three by default (narrow it with `--domains`). The Cursor and
Continue adapters still cover `.agents/workflows/` only, so for those clients
the `pm-` and `hr-` suites must be copy-pasted or registered manually.

## Engineering (`.agents/workflows/`)

| Workflow                                | Description                                                                               |
| :-------------------------------------- | :---------------------------------------------------------------------------------------- |
| **accessibility-audit**                 | Specialized audit for Web Accessibility (A11y).                                           |
| **ask**                                 | A Q&A workflow to chat with the Agent about the codebase.                                 |
| **audit-tech-debt**                     | Technical Debt Audit                                                                      |
| **changelog**                           | Generate Changelog                                                                        |
| **clean-code-audit**                    | Clean Code Audit                                                                          |
| **code-review**                         | Pre-PR Quality Gatekeeper Code Review                                                     |
| **competitive-analysis**                | Port of the blog's /competitive-analysis - compare this stack against external sources.   |
| **design-requirements-to-architecture** | Feature Design Assistant                                                                  |
| **design-system-review**                | AI-augmented design review with a 2-iteration guard.                                      |
| **dev-team**                            | The flagship orchestration workflow for an agentic dev team                               |
| **feature-orchestrator**                | Three-Phase Feature Engine (Research -> Plan -> Implement)                                |
| **init**                                | Master Setup                                                                              |
| **mission-architect**                   | Master Feature Orchestration                                                              |
| **onboard-dev**                         | Codebase Onboarding Intelligence                                                          |
| **plan**                                | Implementation & Bug Planning                                                             |
| **plan-quick**                          | Ultra-lean strategic planning.                                                            |
| **pr-automator**                        | PR Automator (with Mandatory UI Verification & Draft Mode)                                |
| **pr-design-review-init**               | Start an AI-powered design review from an existing GitHub PR URL.                         |
| **qa-handover**                         | Generate a QA handover + universal smoke-test criteria document and deliver it to ClickUp |
| **reflexion-loop**                      | ✨ Special feature Requires API keys - run the two-model self-correcting plan loop        |
| **regression-bug-fix**                  | Unified Feedback & Regression Fix                                                         |
| **security-audit**                      | Security Audit                                                                            |
| **standup-daily-summary**               | Daily Standup Report                                                                      |
| **strategy-target-evaluation**          | Product Strategy Audit                                                                    |
| **style-logic-exporter**                | Export Tailwind v3.4 design tokens to Figma                                               |
| **ui-spec-generator**                   | AI-Powered UI Spec Generator                                                              |
| **verify-changes**                      | Visual Smoke Test                                                                         |
| **vertical-slice**                      | Decompose user stories into ClickUp-ready vertical slices                                 |
| **weekly-leadership-report**            | Weekly Leadership Status Report (Team-Wide)                                               |

## Product Management (`.agents/pm-workflows/`)

| Workflow                     | Description                                                  |
| :--------------------------- | :----------------------------------------------------------- |
| **pm-action-item-mapper**    | Maps meeting notes into actionable items.                    |
| **pm-backlog-auditor**       | Audits backlog for stale or blocked tickets.                 |
| **pm-context-summarizer**    | Summarizes project context for stakeholders.                 |
| **pm-design-system-auditor** | Reviews designs against the established system.              |
| **pm-effort-estimator**      | Estimates developer effort for new features.                 |
| **pm-newsletter-generator**  | Generates an internal product update newsletter.             |
| **pm-progress-translator**   | Translates dev progress to business value.                   |
| **pm-release-note-drafter**  | Drafts comprehensive release notes.                          |
| **pm-risk-detector**         | Identifies potential risks in the roadmap.                   |
| **pm-story-augmenter**       | Augments basic user stories with acceptance criteria.        |
| **pm-task-specifier**        | Creates detailed technical specifications from requirements. |

## Human Resources (`.agents/hr-workflows/`)

| Workflow                       | Description                                       |
| :----------------------------- | :------------------------------------------------ |
| **hr-ad-distributor**          | Distributes job ads across channels.              |
| **hr-candidate-sourcer**       | Sources candidates based on job requirements.     |
| **hr-endorsement-synthesizer** | Synthesizes feedback into candidate endorsements. |
| **hr-intake-specifier**        | Gathers hiring manager requirements.              |
| **hr-interview-auditor**       | Audits interview feedback for consistency.        |
| **hr-jd-drafter**              | Drafts comprehensive job descriptions.            |
| **hr-pipeline-translator**     | Translates pipeline metrics into hiring reports.  |
