# Evaluate & Tune Output Harnesses (Expert Prompt)

> **Purpose:** Run this prompt periodically to analyze the `voice_logs.db`
> database. The AI will identify hallucination patterns and automatically output
> code modifications to strengthen the TTS Output Harness (`spoken-guard.ts` &
> `guard-client.ts`).

---

**Copy and paste the following prompt into your Agent CLI (e.g., Cursor, Claude,
Antigravity) at the root of the project:**

```text
/plan Audit and tune the TTS output harness using runtime data from `peripherals/voice-relay/voice_logs.db`.

### Phase 1: Database Inspection & Triage
1. Inspect the SQLite schema of `peripherals/voice-relay/voice_logs.db`.
2. Query the last 200 entries where `raw_spoken != repaired_spoken` or where guardrail flags were triggered. Group results by `task_class` (focusing on `sequence`, `arithmetic`, `definition`).
3. Extract exact offending strings representing top recurring failure modes:
   - Markdown artifacts (code fences, backticks, headers, bullet symbols, bold/italic markers).
   - Conversational preambles/epilogues (e.g., "Sure, here is...", "Hope this helps!").
   - Hallucinated formatting & meta-talk (e.g., "Alternative Formats", "Note:", "Output:").

### Phase 2: Layer Analysis (L1 Deterministic vs. L2 LLM Judge)
- **L1 Misses (Cost Leak):** Did `raw_spoken` contain obvious static artifacts that `repaired_spoken` had to fix? Tighten L1 regexes in `spoken-guard.ts` so these fail instantly without burning L2 LLM judge tokens.
- **L2 Misses (Safety Leak):** Did `repaired_spoken` still contain unpronounceable syntax or meta-talk? Update the L2 judge prompt in `guard-client.ts` with explicit counterexamples.
- **Root Cause (Prompt Leak):** If a specific `task_class` violates constraints >30% of the time, update the `[STRICT HARNESS]` system prompt in `backends.ts`.

### Phase 3: Implementation
Propose and apply exact diffs to:
1. `peripherals/voice-relay/src/spoken-guard.ts`:
   - Extend `CODE_SYNTAX_RE`, `PREAMBLE_PATTERNS`, and `EPILOGUE_PATTERNS`.
   - Ensure regexes are generalized (use word boundaries `\b`, case-insensitivity `i`, and wildcard whitespace) rather than verbatim single-sentence matches.
   - Adjust `validateByTaskClass` length budgets if needed.
2. `peripherals/voice-relay/src/guard-client.ts`:
   - Update judge system instructions with newly observed failure modes.
3. `peripherals/voice-relay/src/backends.ts` (if systemic failure is identified).

### Phase 4: Automated Test Generation & Verification
1. Open `peripherals/voice-relay/test/spoken-guard.test.ts` (or create if missing) and append new test assertions for **every single failure mode** discovered in Phase 1:
   - **Rejection Tests (True Negatives):** Use the actual raw strings extracted from `voice_logs.db` as test cases to assert that `spoken-guard.ts` now flags or strips them deterministically.
   - **False-Positive Guard Tests (True Positives):** Add clean, edge-case voice strings (e.g., valid math phrasing, valid sequential steps) to verify the new regexes do not break legitimate spoken outputs.
2. Run the test suite (`npm test`, `pnpm test`, or `vitest`) to prove:
   - All legacy test cases still pass.
   - All newly added regression test assertions pass.
3. Present the test run output alongside the final code diff.
```
