---
id: DL-007
title: Golden pass
class: none
expected:
  passed: true
  expectedStructuralPass: true
---

## Phase 0 - Stack Diagnosis

Detected stack: Node.js (v22), Next.js (App Router), Prisma, TailwindCSS, Jest.
I will respect the existing `src/lib/` structure for utilities and `src/app/`
for routes. I see `npm run lint` and `npm test` are available for verification.
The existing `src/components/OrderSummary.tsx` renders the order total with
`amount.toFixed(2)`, which drops the currency symbol and thousands separators.

## Architecture

We will add a simple utility function `formatCurrency` to handle money
formatting consistently across the app, and ship it with its first real
call-site so the change is a complete vertical slice, not dead code.

## Atomic Task List

1. Create currency utility and tests. Add `formatCurrency` in
   `src/lib/currency.ts` using the built-in `Intl.NumberFormat` API (Modern Web
   Guidance). Add unit tests in `src/lib/__tests__/currency.test.ts` to cover
   standard, zero, and negative values, plus an explicit `de-DE` locale
   (`1.234,50 €`). Why <100 LOC: It's a single function wrapping a native API
   and its corresponding tests. Verification: Run
   `npx jest src/lib/__tests__/currency.test.ts && npm run lint` to prove all
   cases pass with no lint errors.
2. Use the utility in the order summary. Replace the inline `amount.toFixed(2)`
   in `src/components/OrderSummary.tsx` with `formatCurrency(amount)`. Extend
   `src/components/__tests__/OrderSummary.test.tsx` to assert the rendered total
   reads `$1,234.50`. Why <100 LOC: one call-site swap in
   `src/components/OrderSummary.tsx` plus one assertion. Verification: Run
   `npx jest OrderSummary && npm run lint` and confirm the new assertion passes.

## Risks & Verification

- Risk: Formatting might be incorrect for unsupported locales.
- Verification: The unit tests cover the default 'en-US' output and an explicit
  'de-DE' locale, so both the fallback and a non-default locale are proven.
- Gate before the PR: `npm run lint && npm test` must pass on the branch.
- Rollback: each task is its own commit; reverting task 2 restores the previous
  order-summary output without touching the utility.
