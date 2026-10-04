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
The existing `src/components/OrderSummary.tsx` (a Server Component) renders the
order total with `amount.toFixed(2)`, which drops the currency symbol and
thousands separators. In `prisma/schema.prisma`, `Order.total` is a `Decimal`
and `Order.currency` is an ISO 4217 code; the page passes the request locale
(from the `[locale]` route segment) down to `OrderSummary`. `tsconfig.json` sets
`"lib": ["dom", "dom.iterable", "esnext"]`. ES2023 types the argument of
`Intl.NumberFormat.prototype.format` as
`number | bigint | StringNumericLiteral`, so a `Decimal` string must be cast to
that template-literal type.

## Architecture

We will add
`formatCurrency(amount: Prisma.Decimal | number, currency: string, locale: string): string`,
built on the native `Intl.NumberFormat`. Currency comes from the order record
and the locale is always passed explicitly, never taken from the runtime
default, so server and client output cannot diverge (no hydration mismatch). A
`Decimal` is passed as its `toFixed()` string, cast to `StringNumericLiteral`
(decimal.js `toFixed()` never uses exponent notation, unlike `toString()`), so
no precision is lost to a float conversion. Only a malformed locale falls back
(to `en-US`); an unknown currency is never replaced, because showing a EUR order
as `$…` is worse than an unformatted amount. The utility is built and hardened
first and only then wired into `OrderSummary`, so no step ships a page that can
throw on user-controlled input.

## Atomic Task List

1. Add the hardened utility, test-first. In `src/lib/currency.ts`, add
   `formatCurrency` with the signature above: validate the locale with
   `Intl.getCanonicalLocales` (fall back to `en-US` on `RangeError`), and for a
   currency `Intl` rejects, log a warning and return the raw ISO code with a
   plainly formatted amount (`ABCD 1,234.50`) instead of throwing or
   substituting USD. Tests in `src/lib/__tests__/currency.test.ts` assert
   `$1,234.50`, `$0.00` and `-$1,234.50` for USD/en-US, the `xx-!!` locale
   fallback and the `ABCD` raw-code output. Why <100 LOC: about 25 lines in
   `src/lib/currency.ts` and about 35 lines of tests, two files. Verification:
   Run `npx jest currency && npx tsc --noEmit && npm run lint` and confirm all
   five cases pass.
2. Pin locale and precision behaviour (tests only). Add cases to
   `src/lib/__tests__/currency.test.ts`: EUR/de-DE renders `1.234,50` then
   U+00A0 (non-breaking space) then `€`; JPY/ja-JP renders `￥1,235` with no
   decimals; a `Prisma.Decimal` of `9007199254740993.10` renders
   `$9,007,199,254,740,993.10` (a float would give `…994.00`). Why <100 LOC:
   three test cases, about 20 lines, in one file. Verification: Run
   `npx jest currency && npm run lint` and confirm the three new cases pass.
3. Wire it into the order summary. Replace the inline `amount.toFixed(2)` in
   `src/components/OrderSummary.tsx` with
   `formatCurrency(order.total, order.currency, locale)`, and extend the
   existing OrderSummary test to assert a USD order in `en-US` renders
   `$1,234.50`. Why <100 LOC: a one-line call-site swap plus one assertion.
   Verification: Run `npx jest OrderSummary && npx tsc --noEmit && npm run lint`
   and confirm the new assertion passes.

## Risks & Verification

- Risk: locale-dependent output differs between server and client (hydration
  mismatch). Closed by passing the locale explicitly into a Server Component;
  the de-DE test pins the exact non-breaking-space output.
- Risk: money precision. Closed by formatting `Decimal.toFixed()` output; the
  large-`Decimal` test in task 2 proves no float drift.
- Risk: currencies without minor units. Closed by the JPY test.
- Risk: a malformed `[locale]` segment crashing the page. Closed in task 1,
  before any call-site exists, by the `xx-!!` fallback test.
- Risk: showing the wrong currency. Closed by never substituting a currency; the
  task 1 `ABCD` test asserts the raw-code output and the warning.
- Gate before the PR: `npx tsc --noEmit && npm run lint && npm test` must pass
  on the branch.
- Rollback: each task is its own commit; reverting task 3 restores the previous
  order-summary output, and tasks 1 and 2 add no user-visible change.
