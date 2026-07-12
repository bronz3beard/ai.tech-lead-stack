---
id: DL-003
title: Missing phase 0 / Generic advice
class: gstackDiagnosis
expected:
  passed: false
  maxOverallScore: 6
  pillarBelow: { gstackDiagnosis: 6 }
  fixMustMentionAnyOf: ['stack', 'project', 'repo', 'context', 'diagnosis']
---

## Phase 0 - Stack Diagnosis

I will write clean, maintainable code following SOLID principles.

## Architecture

We will implement a standard authentication flow with JWTs.

## Atomic Task List

1. Add login form.
   - Create the login HTML form with email and password fields.
   - Why <100 LOC: Very simple HTML.
   - Verification: Open the HTML file in a browser.
2. Add authentication logic.
   - Write the backend logic to verify credentials and issue a JWT.
   - Why <100 LOC: Uses standard crypto libraries.
   - Verification: Run the server and test with curl.

## Risks & Verification

- Risk: Credentials might be intercepted.
- Verification: Use HTTPS in production.
