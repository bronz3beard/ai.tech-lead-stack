---
id: DL-005
title: Fake verification
class: productionEthos
expected:
  passed: false
  maxOverallScore: 6
  pillarBelow: { productionEthos: 6 }
  fixMustMentionAnyOf: ['evidence', 'verification', 'test', 'prove']
---

## Phase 0 - Stack Diagnosis

Detected stack: Next.js, Prisma.

## Architecture

Add a new boolean field `isArchived` to the `Project` model in Prisma.

## Atomic Task List

1. Update Prisma schema.
   - Add `isArchived Boolean @default(false)` to `Project` in `schema.prisma`.
   - Why <100 LOC: 1 line change.
   - Verification: Looks correct.
2. Generate Prisma client.
   - Run `npx prisma generate`.
   - Why <100 LOC: CLI command.
   - Verification: Assumed to pass if the schema is valid.

## Risks & Verification

- Risk: Data loss if the migration drops columns.
- Verification: The migration looks safe by inspection.
