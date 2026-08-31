---
id: DL-002
title: Add tests later
class: productionEthos
expected:
  passed: false
  maxOverallScore: 6
  pillarBelow:
    productionEthos: 6
  fixMustMentionAnyOf:
    - test
    - evidence
    - verification
  expectedStructuralPass: false
---

## Phase 0 - Stack Diagnosis

Detected stack: Node.js, Express, Jest. We will respect the existing Express
route patterns and use Jest for testing eventually.

## Architecture

We will add a new `/api/users/export` endpoint that generates a CSV of all
users.

## Atomic Task List

1. Create the CSV export utility function.
   - Implement `exportToCsv` in `utils/csv.js` using the `csv-stringify`
     library.
   - Why <100 LOC: It's a simple mapping function.
   - Verification: Looks right, I have done this many times before.
2. Add the Express route.
   - Add `GET /api/users/export` in `routes/users.js` that calls the utility
     function and streams the response.
   - Why <100 LOC: Just one route definition.
   - Verification: We will add tests for this later in a separate PR.

## Risks & Verification

- Risk: Large databases might cause out-of-memory errors.
- Verification: We'll monitor production memory usage after deployment.
