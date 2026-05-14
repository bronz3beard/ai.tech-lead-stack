---
name: pr-design-review-init
description: Start an AI-powered design review from an existing GitHub PR URL.
---

# 🛠 PR Design Review Initiation (Developer Start)

**ROLE: DEVELOPER**
This workflow allows a developer to bypass the code-generation phase and trigger an AI design audit on an existing Pull Request.

## Objective
To take a GitHub PR URL, extract the relevant branch and component metadata, create a `DesignReviewSession` in the Tech-Lead Stack, and trigger the `design-system-review` audit.

---

## 🛠 Execution Steps

### Step 1: PR Metadata Discovery
1. **Analyze the URL**: Scrape the provided GitHub PR URL using `firecrawl_scrape`.
2. **Extract Key Info**:
   - **Component Name**: Extract from the PR title or by inspecting the file diff (e.g., if `ProjectCard.tsx` was modified).
   - **Branch Name**: Identify the source branch of the PR.
   - **Project ID**: Map the GitHub repository to the internal Tech-Lead Stack `projectId`.
3. **Report Findings**: Summarize the detected component and branch to the developer.

### Step 2: Session Creation
1. Call the Tech-Lead Stack API to create the session:
   ```bash
   curl -X POST <TECH_LEAD_STACK_URL>/api/design-review \
     -H "Content-Type: application/json" \
     -d '{
       "projectId": "<PROJECT_ID>",
       "component": "<COMPONENT_NAME>",
       "prUrl": "<PR_URL>",
       "initiatedBy": "DEVELOPER"
     }'
   ```
2. Capture the `sessionId` from the response.

### Step 3: Trigger AI Audit
1. Automatically transition to the `design-system-review` workflow using the new `sessionId`.
2. **Instruction**: "Session created. Starting the automated Design System Audit now..."

---

**Completion:** Confirm to the developer that the session is live and provide a link to the Design Review Dashboard for that project.
