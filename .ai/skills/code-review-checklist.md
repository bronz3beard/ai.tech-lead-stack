---
name: code-review-checklist
description:
  Lightweight Pre-Commit Review Checklist. Focuses on Spec Compliance and Rapid
  Verification before GitHub submission.
cost: ~650 tokens
---

# Pre-Commit QA Checklist (The Fast Review)

> [!TIP] **Methodology Alignment**: Use this checklist to catch 80% of issues
> before they reach the official PR stage. Always follow **MinimumCD** (small
> batches) and **G-Stack Ethos** (User Sovereignty).

## 📋 Quality Gates

### 1. Spec & Logic Check

- [ ] **Accurate:** Does the code exactly match the requirements?
- [ ] **Edge Cases:** Are empty states and error boundaries handled?
- [ ] **Cleanup:** Are all debug logs and temporary comments removed?

### 2. Ecosystem & Methodology Alignment

- [ ] **Architecture:** Follows the primary architectural patterns of the
      detected framework (e.g., Server Components for Next.js, Dependency
      Injection for .NET, etc.).
- [ ] **Safety:** Input validation implemented globally (e.g., Zod, JSON Schema,
      Built-in Type Guards).
- [ ] **Consistency:** Naming and file structure match the project's established
      standard.
- [ ] **DRY/KISS:** Logic is simple, clear, and avoids premature abstraction.

### 3. Accessibility (A11y) Smoke Test

- [ ] **Semantics:** No interactive `div` elements used where `button` or `a`
      should exist.
- [ ] **Readability:** All images have `alt` text (empty `alt=""` for
      decorative).
- [ ] **Focus:** Interactive elements have visible focus rings and consistent
      tab-order.
- [ ] **Labels:** Form inputs have associated `<label>` tags or `aria-label`.

### 4. Verification Evidence

- [ ] **Tests:** Unit/Integration tests pass for the changed logic.
- [ ] **Evidence:** Verification evidence (e.g., screenshot, terminal logs,
      trace files) is captured in the artifacts directory.

## 🛠 Outcome Actions

- **Suggested:** Proceed to create a PR (e.g., `rtk run create-pr`) if required.
- **On Fail:** Fix issues and re-run this checklist.
