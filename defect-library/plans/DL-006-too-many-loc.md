---
id: DL-006
title: Single task exceeding 100 LOC
class: atomicBatches
expected:
  passed: false
  maxOverallScore: 6
  pillarBelow: { atomicBatches: 6 }
  fixMustMentionAnyOf: ['split', 'atomic', 'size', 'loc', 'large']
---

## Phase 0 - Stack Diagnosis

Detected stack: Node.js, Express, PostgreSQL.

## Architecture

We will build an entire reporting module that generates complex PDF reports from
multiple database tables.

## Atomic Task List

1. Implement the Reporting Engine.
   - Create `src/reporting/engine.ts`. This file will contain the logic to query
     the `users`, `orders`, `invoices`, and `payments` tables, perform complex
     aggregations in memory, format the data, and use `pdfkit` to draw a 15-page
     PDF report with charts and tables, and finally upload it to an S3 bucket.
   - Why <100 LOC: It's just one file, so it's atomic. It might be around 800
     lines of code, but it's logically one feature.
   - Verification: Run `npm run test` on the new reporting test suite.

## Risks & Verification

- Risk: PDF generation might be slow.
- Verification: We will run a load test to verify performance.
