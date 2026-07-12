---
id: DL-007
title: Golden pass
class: none
expected:
  passed: true
---

## Phase 0 - Stack Diagnosis

Detected stack: Node.js (v22), Next.js (App Router), Prisma, TailwindCSS, Jest.
I will respect the existing `src/lib/` structure for utilities and `src/app/`
for routes. I see `npm run lint` and `npm test` are available for verification.

## Architecture

We will add a simple utility function `formatCurrency` to handle money
formatting consistently across the app.

## Atomic Task List

1. Create currency utility and tests.
   - Add `formatCurrency` in `src/lib/currency.ts` using the built-in
     `Intl.NumberFormat` API (Modern Web Guidance). Add unit tests in
     `src/lib/__tests__/currency.test.ts` to cover standard, zero, and negative
     values.
   - Why <100 LOC: It's a single function wrapping a native API and its
     corresponding tests.
   - Verification: Run `npx jest src/lib/__tests__/currency.test.ts` to prove
     all cases pass.

## Risks & Verification

- Risk: Formatting might be incorrect for unsupported locales.
- Verification: The unit tests explicitly test the default 'en-US' locale
  fallback behavior, ensuring consistent output.
