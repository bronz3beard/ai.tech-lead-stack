# Defect Library

> **File location after manual install:** `defect-library/README.md` Replace the
> existing stub README that Jules created when merging PR #72.

---

## Table of Contents

1. [What this is, in plain English](#1-what-this-is-in-plain-english)
2. [Background: what is a reflexion loop?](#2-background-what-is-a-reflexion-loop)
3. [The problem this solves: the nodding critic](#3-the-problem-this-solves-the-nodding-critic)
4. [How the defect library works](#4-how-the-defect-library-works)
5. [The Four Pillars (the critic's rubric)](#5-the-four-pillars-the-critics-rubric)
6. [The seven test cases, explained](#6-the-seven-test-cases-explained)
7. [The evaluation harness: reflexion-eval.ts](#7-the-evaluation-harness-reflexion-evalts)
8. [The CI job: evaluator-calibration](#8-the-ci-job-evaluator-calibration)
9. [The growth rule](#9-the-growth-rule)
10. [Running it yourself](#10-running-it-yourself)
11. [References](#11-references)

---

## 1. What this is, in plain English

This directory contains a set of deliberately **broken implementation plans**
and a harness to prove that your AI code reviewer can recognise and reject them.

Think of it like a fire drill for your review system. You don't wait until a
real fire to find out whether the sprinklers work. You test them deliberately,
on a schedule, with a known expected outcome. The defect library is the same
idea: every time you update the AI critic's instructions, you run this suite and
verify it still rejects plans it should reject, and still approves plans it
should approve.

There are seven test cases here: six flawed plans (DL-001 through DL-006) and
one deliberately correct plan (DL-007). The harness sends each one to the AI
critic, checks the scores and feedback against the expected outcome defined in
the file itself, and reports pass or fail.

---

## 2. Background: what is a reflexion loop?

If you have never encountered a reflexion loop before, here is the concept from
first principles.

When you ask a large language model (LLM) to write a plan or produce code, it
generates something and stops. If that output is wrong or incomplete, the model
has no built-in way to notice — it does not automatically re-examine its own
work. This is the baseline problem.

**Reflexion** (Shinn et al., NeurIPS 2023) is a framework that adds a feedback
cycle. Instead of one model generating output and stopping, you add a second
step: a different model (or the same model with a different prompt, acting in a
different role) **evaluates** the output. If the evaluation finds problems, the
original generator is given the critique and asked to try again. This repeats
until the output passes the evaluator's standard, or until a maximum number of
attempts is reached.

The key insight is that the evaluator carries **none of the generator's
self-persuasion**. When you write something yourself, you are the worst person
to review it — you know what you meant to say, so your brain fills in the gaps
and misses the errors. A separate evaluating pass does not know what the
generator intended. It only sees what the plan actually says.

In this codebase the reflexion loop works like this:

```bash
YOU (brief) → GENERATOR (Gemini) → draft plan
                    ↓
          CRITIC (Claude) → scores against four pillars + one fix
                    ↓
             ROUTER (deterministic code)
              ├── score ≥ threshold → ADJUDICATOR → final verdict + ide-prompt
              └── score < threshold, attempts remaining → back to GENERATOR
```

The generator writes the plan. The critic grades it against four non-negotiable
standards (the Four Pillars, described below). The router is pure deterministic
code — it does not call a model, it just checks a number. The adjudicator gives
a final human-readable verdict on the best plan produced. At no point does the
generator see its own critique or grade itself.

This separation is intentional. The Loop Engineering paper by HuaShu (Jun 2026)
calls this the **generator/evaluator split**: _"The evaluator carries none of
the generator's self-persuasion, defaults to doubt, and judges behaviour by
acting rather than just reading."_ The research consistently shows that models
which evaluate their own output are far more lenient than a model evaluating
output produced by someone else.

---

## 3. The problem this solves: the nodding critic

There is a failure mode in AI review pipelines that is easy to miss and
difficult to detect once it sets in: the **nodding critic**.

A nodding critic is an AI evaluator that has drifted — through prompt changes,
model updates, or gradual softening of the rubric — to the point where it
approves almost everything. It still generates scores and writes feedback. The
scores still look plausible. But it no longer actually says "no."

This is dangerous precisely because the output looks normal. You have no obvious
signal that the quality gate has stopped working. Plans that would have failed
three months ago now silently pass. The agent-generated work that reaches your
IDE looks reviewed but is not truly reviewed.

The defect library solves this by providing **known-bad inputs with known
expected outputs**. If DL-001 (a plan that bundles five files of work into one
commit and calls it atomic) ever receives a passing score, the test fails and
you know immediately that the critic has drifted.

This is equivalent to a security penetration test, or a mutation testing suite
for software. You verify the defence works by attempting to breach it yourself,
deliberately, on a schedule.

Without something like this, you have no way to distinguish:

- "the critic approved this plan because it is genuinely good"
- "the critic approved this plan because it approves everything now"

---

## 4. How the defect library works

Each test case is a Markdown file in `defect-library/plans/`. The files have two
sections:

**Frontmatter** (the YAML block at the top between `---` markers): This is the
machine-readable test assertion. It tells the harness exactly what the critic
must say for the test to pass. Example from DL-001:

```yaml
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
```

This says: the critic must mark this plan as not passed, give it an overall
score of 6 or lower, give the `atomicBatches` pillar specifically a score below
6, and its suggested fix must mention at least one of those five words.

**Body** (everything after the frontmatter): This is the plan itself — the text
that gets sent to the critic. It is written to look superficially plausible
while containing a specific flaw. The body never references the flaw directly;
it is written the way a developer who does not see the problem would write it.

The harness strips the frontmatter, sends only the body to the critic, receives
the critic's structured JSON response, and checks it against the assertions.

---

## 5. The Four Pillars (the critic's rubric)

The critic grades every plan against four standards, scoring each from 0 to 10.
These four scores plus one holistic score make up the `CritiqueSchema` (defined
in `src/lib/ai/reflexion/schema.ts`).

**Pillar 1 — G-Stack / Diagnosis-First** The plan must start from the real
project. Before any solution is proposed, the plan must state what it actually
found in the codebase: the detected language, framework version, existing
patterns, relevant configuration files. Generic, stack-agnostic advice — advice
that could apply to any project — fails this pillar. The name "G-Stack" comes
from Garry Tan's project diagnosis framework, which emphasises inspecting what
is actually present before prescribing solutions.

**Pillar 2 — MinimumCD / Atomic Batches** Every step in the plan must be a
vertical slice: a self-contained unit under 100 lines of code that is
independently testable and deployable. No "big bang" integrations where multiple
components are created together in one step. MinimumCD (minimumcd.org) is an
open standard for continuous delivery practice. Its core insight on batch size,
quoted directly: _"smaller batches of work are easier to verify, they tend to
fail small, we are less likely to suffer from sunk-cost fallacy, we amplify
feedback loops"_ — and story sizes should average as close to one day's work as
possible.

**Pillar 3 — Production-Grade Ethos** No shortcuts, no deferred testing, no
"looks right" as a verification step. Every task in the plan must end with
**hard evidence**: a command to run, output to paste, a test to execute. "We'll
add tests later" fails immediately. "Tested manually in Chrome" fails. "Run
`npm test` and paste output" passes. The standard here is what a disciplined
senior engineer would demand of a junior before approving any merge.

**Pillar 4 — Modern Web Guidance** When the work involves the web or UI, it must
use modern, accessible, secure APIs rather than legacy workarounds. The
canonical example in DL-004 is using `document.execCommand('copy')` (deprecated,
unreliable, requires DOM manipulation hacks) when the Clipboard API
(`navigator.clipboard.writeText`) has been the correct approach for years. This
pillar is marked as satisfied and not penalised when the task has nothing to do
with web or UI work.

**The holistic score** is not the average of the four pillar scores. It is the
critic's single most important output: one fatal flaw in any pillar makes the
overall score low even if the other three pillars are perfect. This is
intentional. A plan that is excellent in three dimensions but ships untested
code is not a 7.5 average — it is a failing plan.

**The single actionable fix** is equally important. The critic is instructed to
produce exactly one fix: the most valuable change for the next revision. Not a
list, not multiple options — one concrete technical sentence. This design forces
the critic to prioritise, and it means the generator knows exactly what to
address in its next attempt.

---

## 6. The seven test cases, explained

### DL-001 — Big-bang integration (`atomicBatches`)

This plan describes building a user dashboard. It has a superficially correct
Phase 0 (it names the stack). The flaw is in the task list: a single task
involves creating a page file, three separate components, Prisma queries for all
three sections, and Tailwind styling. It then justifies this as under 100 LOC
with: _"It's just wiring up the components."_ This is the classic big-bang
rationalization — bundling multiple concerns into one step and claiming it is
small because each piece individually might be small.

The expected outcome: `atomicBatches` score below 6, overall score below 6, fix
mentions splitting.

### DL-002 — Add tests later (`productionEthos`)

This plan describes adding an API endpoint and a utility function. The
verification steps are: _"Looks right, I have done this many times before"_ and
_"We will add tests for this later in a separate PR."_ The risk section says the
fix for potential memory issues will be monitoring production.

This tests whether the critic enforces the no-deferred-testing rule even when
the rest of the plan looks technically reasonable. The flaw is entirely in the
attitude toward verification.

### DL-003 — Missing Phase 0 / Generic advice (`gstackDiagnosis`)

This plan's Phase 0 says: _"I will write clean, maintainable code following
SOLID principles."_ That is not a stack diagnosis. It tells you nothing about
the actual project — not the framework, not the existing patterns, not the
relevant files. The architecture section proposes "a standard authentication
flow with JWTs" without looking at what authentication mechanism already exists
in the repo.

This is the hardest defect for the critic to catch because the plan looks
professional. It uses the right headings, it sounds confident, it mentions
security. The flaw is entirely the absence of project-specific information.

### DL-004 — Legacy web API (`modernWeb`)

This plan implements clipboard copy using `document.execCommand('copy')` — a
technique that requires creating a hidden `<textarea>`, appending it to the
document body, selecting it, copying, and removing it. The plan even
acknowledges this is a hack: _"It's a standard hack that only takes about 15
lines of code."_

The modern alternative is one line: `navigator.clipboard.writeText(text)`. The
Clipboard API has been supported in all major browsers since 2018. Using the
legacy approach in a Next.js/React codebase in 2025 is exactly what this pillar
exists to catch.

### DL-005 — Fake verification (`productionEthos`)

Similar to DL-002 but more subtle. The tasks have verification steps, but they
are not real verification: _"Looks correct"_ and _"Assumed to pass if the schema
is valid."_ The risk section says: _"The migration looks safe by inspection."_
Database migrations that drop columns or change nullable fields have destroyed
production data at companies of every size. "Looks safe by inspection" is never
acceptable for a migration.

This tests whether the critic can distinguish between the presence of a
verification section and the presence of actual, runnable verification commands.

### DL-006 — Too many LOC (`atomicBatches`)

This plan describes building an entire reporting engine — querying four database
tables, performing complex aggregations, generating a 15-page PDF with charts,
and uploading to S3 — as a single task. The justification is: _"It's just one
file, so it's atomic. It might be around 800 lines of code, but it's logically
one feature."_

This is the subtlest version of the big-bang anti-pattern: confusing a single
_file_ with a single _atomic unit_. A 800-line file is not atomic regardless of
how many features it implements. This tests whether the critic can see past the
"one file = one task" rationalization.

### DL-007 — Golden pass (no defect)

This is the only case that must **pass**. It describes adding a `formatCurrency`
utility function. Phase 0 names the exact detected stack including version
numbers. The single task uses `Intl.NumberFormat` (the correct modern API, not a
custom formatter or a third-party library). The task is genuinely under 100 LOC.
The verification step names a specific Jest command with a specific test file
path and describes what it will verify.

DL-007 exists to prevent the opposite failure mode: an over-calibrated critic
that rejects everything. If the critic fails DL-007, the rubric or prompt has
become so strict that no plan can pass, which is just as useless as a critic
that passes everything. A healthy critic should find nothing to criticise in a
plan this simple and well-formed.

---

## 7. The evaluation harness: `reflexion-eval.ts`

Located at `scripts/reflexion-eval.ts`, this is the script that runs the tests.
It is important that you understand exactly how it works, because the
correctness of the test depends on two things that are easy to get wrong.

**It uses the same prompt as the real loop.** The harness imports
`CRITIC_SYSTEM` directly from `src/lib/ai/reflexion/prompts.ts` — the same
constant the production reflexion loop uses. It does not have its own copy of
the critic instructions. This means when you run the harness, you are testing
the actual critic your loop will use, not a simulation of it. If you ever change
`CRITIC_SYSTEM`, the harness immediately tests the updated version.

**It uses the same Zod schema as the real loop.** The critic's response is
validated with `CritiqueSchema` from `src/lib/ai/reflexion/schema.ts` — the same
schema used in production. If the response does not conform (missing fields,
wrong types), the harness fails with a schema error, not a silent incorrect
result.

The harness runs each case through the Anthropic API (Claude), collects the
structured response, and checks it against the frontmatter assertions:

- `expected.passed` → must match `critique.passed`
- `expected.maxOverallScore` → `critique.score` must be ≤ this number
- `expected.pillarBelow` → the named pillar score must be ≤ the threshold
- `expected.fixMustMentionAnyOf` → `critique.actionableFix` must contain at
  least one of the listed words (case-insensitive)

It then writes a `defect-library/report.json` with the full results, and prints
a summary table to the console. Exit code 0 means all cases passed. Any non-zero
exit code means at least one case behaved unexpectedly.

You can run a single case during debugging:

```bash
rtk run reflexion-eval --case DL-003
```

You can get machine-readable output for scripting:

```bash
rtk run reflexion-eval --json
```

---

## 8. The CI job: `evaluator-calibration`

The `.github/workflows/ci.yml` file was extended with a new job called
`evaluator-calibration`. This job runs the harness automatically on GitHub
Actions.

The guard condition is worth understanding:

```yaml
if: github.event_name == 'workflow_dispatch' || secrets.ANTHROPIC_API_KEY != ''
```

This says: run if someone manually triggered the workflow, OR if the
`ANTHROPIC_API_KEY` secret is present. This has an important consequence for
forks: anyone who forks this repository without adding their own API key will
not see this job fail with a confusing "missing credentials" error — the job
simply does not run for them. For the main repository where the secret is set,
the job runs on every push.

There is a second guard on the actual run step:

```yaml
if: env.ANTHROPIC_API_KEY != ''
```

This is belt-and-suspenders. Even within the job, if the environment variable is
somehow not populated from the secret, the harness step is skipped rather than
failing with an unclear error.

**Why CI and not just a local script?** You could run this manually before every
merge. But you will not, consistently, over months. CI is the mechanism that
makes "the critic was verified this week" a fact rather than a recollection. The
Agentic Continuous Delivery specification from MinimumCD
(beyond.minimumcd.org/docs/agentic-cd/) makes this point directly: an
agent-generated change must meet the same quality bar as a human-generated
change, and the pipeline — not human memory — is the enforcer of that bar.

---

## 9. The growth rule

The `defect-library/README.md` (the stub this file replaces) defined the growth
rule in one sentence:

> _"Every 'the reviewer missed X' friction defect adds a DL case reproducing X —
> prevent the class, not the instance."_

This is the most operationally important principle in this entire system.

When the critic misses something in a real review — when a bad plan gets
approved and makes it to your IDE — the instinct is to tweak the prompt and move
on. The growth rule says: do not just fix the prompt. Write a new DL case that
reproduces the exact type of error the critic missed. Name it DL-008 (or
whatever the next number is), give it frontmatter assertions, and commit it.

This has two effects. First, running the harness after your prompt change
immediately tells you whether the fix actually worked — not on the abstract
prompt text, but on a concrete bad plan. Second, any future change that
re-introduces the same blind spot will be caught automatically, because the test
case for that class of error now exists permanently in the library.

The distinction between "prevent the class" and "prevent the instance" is
borrowed from software defect analysis. If a bug is caused by unchecked null
access, the fix is not to add one null check at the specific call site — it is
to add null checks systematically, and possibly to add a linter rule. The
specific instance is fixed either way. The class is only prevented by the
systematic response. The defect library is the systematic response applied to AI
reviewer drift.

---

## 10. Running it yourself

Prerequisites:

- `ANTHROPIC_API_KEY` set in your environment or `.env` file
- Dependencies installed: `pnpm install`

Run all cases:

```bash
rtk run reflexion-eval
```

Run one specific case (useful when debugging or writing a new case):

```bash
rtk run reflexion-eval --case DL-005
```

Output as JSON (for scripting or saving results):

```bash
rtk run reflexion-eval --json > defect-library/report.json
```

Using the npm script directly without rtk:

```bash
npm run reflexion:eval
```

**Interpreting the output:**

A row that says `PASS` means the critic behaved as expected — it rejected a plan
it was supposed to reject (DL-001 through DL-006) or approved the plan it was
supposed to approve (DL-007).

A row that says `FAIL` on DL-001 through DL-006 means the critic is too lenient
on that class of error. The fix is to strengthen the relevant section of
`CRITIC_SYSTEM` in `src/lib/ai/reflexion/prompts.ts`.

A row that says `FAIL` on DL-007 means the critic is too strict — it is
rejecting a plan that has no real flaws. This usually means a recent prompt
change made the rubric overly punishing. Do not ship a critic that cannot
approve DL-007.

**Adding a new case:**

1. Create `defect-library/plans/DL-00N-your-slug.md` where N is the next number.
2. Write the frontmatter: `id`, `title`, `class`, and `expected` block.
3. Write the plan body with exactly one flaw, written from the perspective of
   someone who does not see the problem.
4. Run `rtk run reflexion-eval --case DL-00N` to verify the harness can detect
   the flaw.
5. Commit both the case file and the updated `report.json`.

---

## 11. References

### The reflexion loop concept

**Shinn, N., Cassano, F., Gopinath, A., Narasimhan, K., & Yao, S. (2023).
Reflexion: Language agents with verbal reinforcement learning.** _Advances in
Neural Information Processing Systems 36 (NeurIPS 2023)._ arXiv:
[2303.11366](https://arxiv.org/abs/2303.11366)

The foundational paper. Proposes the framework of reinforcing language agents
through linguistic feedback rather than weight updates. The core idea is that
agents verbally reflect on task feedback and maintain reflective text in an
episodic memory buffer — the direct ancestor of what this codebase's reflexion
loop does with `actionableFix` and revision prompts. The paper showed
significant performance improvements on coding tasks specifically.

### Delivery standards and batch size

**MinimumCD.org — Minimum Viable Continuous Delivery**
[minimumcd.org](https://minimumcd.org/)

The open standard that defines Pillar 2 (Atomic Batches) in this codebase.
Maintained by a community of practitioners. Defines CI, trunk-based development,
single path to production, deterministic pipelines, and — most relevant here —
small batches.

**MinimumCD.org — Work in Small Batches**
[minimumcd.org/practices/smallbatches](https://minimumcd.org/practices/smallbatches/)

The specific practice page for batch size. Direct source of the principle
underpinning the 100-LOC limit and the requirement for independently testable
vertical slices. Quotes Accelerate (Forsgren, Humble, Kim) on the empirical
relationship between batch size and delivery performance.

**MinimumCD Practice Guide — Agentic Continuous Delivery**
[beyond.minimumcd.org/docs/agentic-cd](https://beyond.minimumcd.org/docs/agentic-cd/)

The extension of MinimumCD specifically for AI-generated changes. Defines the
constraint that agents implementing changes must not be able to promote those
changes to production, and that every change requires explicit human-owned
intent. The defect library is one implementation of ACD's requirement that
agent-generated work must be verified with the same rigour as human-generated
work.

**MinimumCD Practice Guide — Systemic Defect Fixes**
[beyond.minimumcd.org/docs/reference/practices](https://beyond.minimumcd.org/docs/reference/practices/)

The practice of detecting defects earlier and preventing them from recurring —
the direct source of the growth rule ("prevent the class, not the instance").

**Forsgren, N., Humble, J., & Kim, G. (2018). Accelerate: The Science of Lean
Software and DevOps.** IT Revolution Press.

The empirical research underpinning MinimumCD. Establishes the relationship
between continuous delivery practices, batch size, deployment frequency, and
organisational performance through four years of survey data across thousands of
organisations.

### Generator/evaluator separation

**HuaShu. (2026). Loop Engineering: The Anthropic Playbook.** _(Orange Book
v260615, Jun 2026)_

Defines the generator/evaluator split used in this codebase, and the five
anti-patterns (Nodding Loop, Amnesiac Loop, Manual Loop, Blind Loop, Tangled
Loop). The nodding loop — the specific failure this defect library guards
against — is defined as an evaluator that never says no: error rate of 0 across
≥20 runs. Also describes the Stripe Minions pipeline design principle that
"anything rule-bound is kept out of the probabilistic model" — the reason the
router and harness assertion checks are deterministic code, not AI judgement.

### AI evaluation quality and the self-review problem

**Panickssery, A., Bowman, S., & Feng, S. (2024). LLM evaluators recognize and
favor their own generations.** _Advances in Neural Information Processing
Systems 37._

Empirical confirmation of the self-review problem. Models systematically favour
their own outputs when acting as evaluators. This is the research foundation for
the design decision to use a different model (Claude) as critic for plans
generated by a different model (Gemini), rather than having the generator
self-critique.

**Jin, C. & Chen, X. (2025). Uncovering Systematic Failures of LLMs in Verifying
Code Against Natural Language Specifications.** arXiv:
[2508.12358](https://arxiv.org/abs/2508.12358)

Found systematic failures of LLMs in evaluating whether code aligns with
requirements, with complex prompting leading to higher misjudgement rates.
Motivates the structured rubric approach (four specific scored pillars) over a
single open-ended "is this good?" evaluation.

**The Specification as Quality Gate: Three Hypotheses on AI-Assisted Code
Review. (2026).** arXiv: [2603.25773](https://arxiv.org/abs/2603.25773)

Documents the "homogenisation trap": LLM-based test generation produces test
suites that mirror the generating model's error patterns, missing defects that
humans would catch. The defect library's use of human-authored bad plans (rather
than AI-generated bad plans) is a direct response to this risk.

### Continuous evaluation of AI systems

**The Pragmatic Engineer Newsletter — A pragmatic guide to LLM evals for devs
(Dec 2025).**
[newsletter.pragmaticengineer.com/p/evals](https://newsletter.pragmaticengineer.com/p/evals)

A practitioner-oriented guide to the two types of evaluators: code-based
assertions (deterministic, for objective tasks) and LLM judges (probabilistic,
for subjective quality). The defect library uses both: the assertions in
frontmatter are deterministic checks, and the critic itself is the LLM judge
being calibrated. The guide's "golden dataset" approach — assembling known
correct and incorrect examples to build a reliable test suite — is exactly what
this directory implements.
