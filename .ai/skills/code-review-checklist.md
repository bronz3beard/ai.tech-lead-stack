---
name: code-review-checklist
description:
  Lightweight Pre-Commit Review Checklist. Focuses on Spec Compliance and Rapid
  Verification before GitHub submission.
cost: ~600 tokens
---

# Pre-Commit QA Checklist (The Fast Review)

> [!TIP] **Speed + Accuracy**: Use this checklist to catch 80% of issues before
> they reach the official PR stage.

## 📋 Quality Gates

### 1. Spec & Logic Check

- [ ] **Accurate:** Does the code exactly match the requirements?
- [ ] **Edge Cases:** Are empty states and error boundaries handled?
- [ ] **Cleanup:** Are all `console.log` and debug comments removed?

### 2. G-Stack & Structural alignment

- [ ] **Next.js:** Uses Server Components where possible.
- [ ] **React:** Refs passed as props (React 19).
- [ ] **Types:** Zero `any` casts (use `Zod` for validation).
- [ ] **Styles:** Tailwind classes use complete strings.

### 3. Verification Evidence

- [ ] **Tests:** Unit/Integration tests pass.
- [ ] **Output:** Verification evidence (e.g., screenshot, terminal logs) is
      ready.

## 🛠 Outcome Actions

- **On Pass:** Proceed to `rtk pr create`.
- **On Fail:** Fix issues and re-run this checklist.
