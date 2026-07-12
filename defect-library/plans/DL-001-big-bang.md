---
id: DL-001
title: Big-bang integration
class: atomicBatches
expected:
  passed: false
  maxOverallScore: 6
  pillarBelow: { atomicBatches: 6 }
  fixMustMentionAnyOf: ['split', 'atomic', 'slice', 'batch', 'break']
---

## Phase 0 - Stack Diagnosis

Detected stack: Next.js 14, React 18, Tailwind CSS, Prisma. We will respect the
existing App Router structure and use Tailwind for styling.

## Architecture

We will build a new user dashboard that fetches user profile data, recent
activity, and notifications.

## Atomic Task List

1. Create the new User Dashboard page.
   - This task involves creating the `app/dashboard/page.tsx`,
     `components/Profile.tsx`, `components/ActivityFeed.tsx`, and
     `components/Notifications.tsx`. We will also add the Prisma queries for all
     three sections in `lib/data.ts` and style everything with Tailwind.
   - Why <100 LOC: It's just wiring up the components.
   - Verification: Run `npm run build` to ensure it compiles.

## Risks & Verification

- Risk: The dashboard might not load if the database is down.
- Verification: The `npm run build` step ensures no syntax errors exist.
