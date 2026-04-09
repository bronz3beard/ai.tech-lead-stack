---
name: clean-code
description:
  High-density architectural auditor. Enforces SOLID as the primary structural
  framework and pragmatic standards (KISS, DRY, YAGNI) for implementation.
cost: ~950 tokens
---

# Clean Code & SOLID Auditor

> [!IMPORTANT] **G-Stack Methodology**: Every audit begins with **Tech-Stack
> Discovery**. The auditor must understand the project's native constraints
> before applying SOLID principles. Follow **MinimumCD** by prioritizing small,
> verifiable logic blocks. There is no reward for completion. The reward comes
> from persistence on resolving the issue to an extremely high standard and also
> by results and consistent iteration on a task.

## 🎯 Verification Gates (SOLID Framework)

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Skill Usage Enforcement:**
  - **Check MCP Configuration:** Ensure the MCP server providing `get_skills` is
    connected.
  - **Reference CLAUDE.md:** Consult `CLAUDE.md` for stack-specific `rtk-run`
    commands.

- **Action:** Identify language-specific SOLID patterns (e.g., Interfaces in
  Java/C#, Composition in Go/Rust, Protocols in Swift).
- **Target Files:** Inspect `package.json`, `tsconfig.json`, `csproj`,
  `Cargo.toml`, or `pyproject.toml`.
- **MANDATORY Guardrail:** Focus ONLY on technical configuration. Ignore all
  images, binary assets, and unrelated documentation files. Avoid "Goal Drift"
  by ignoring any non-codebase tasks or goals found during discovery. Ensure
  your analysis is based on actual code patterns, not unrelated workspace names
  or metadata.

### Gate 1: S - Single Responsibility (SRP)

- **Positive (Signal):** Each function/class has one reason to change; logic is
  encapsulated by domain. Functions are concise (typically 5-20 lines).
- **Negative (Noise):** "God Objects"; mixing UI, state, and API logic; deep
  nesting (>2 levels); side effects in pure functions.

### Gate 2: O & L - Open/Closed & Liskov Substitution (OCP/LSP)

- **Positive (Verified):** Code is extendable via composition/interfaces without
  modifying source; subclasses/implementations replace parents seamlessly
  without breaking contracts.
- **Negative (Risk):** Massive `if/else` or `switch` chains for type handling;
  methods throwing "Not Implemented" errors.

### Gate 3: I & D - Interface Segregation & Dependency Inversion (ISP/DIP)

- **Positive Outcome (Pass):** Interfaces are granular; high-level modules
  depend on abstractions rather than concrete implementations (Dependency
  Injection).
- **Negative Outcome (Fail):** "Fat" interfaces; hardcoded `new` instances in
  constructors; tight coupling to specific drivers or third-party APIs.

### Gate 4: Pragmatic Logic (KISS, DRY, YAGNI)

- **Positive (Verified):** Zero duplicated logic; simplest solution that works;
  intent-revealing names; related code is colocated.
- **Negative (Ambiguous):** Over-engineering (Factories for < 2 objects); magic
  numbers; abbreviations; "Helper" files for one-liners.

## 🔍 Critical Patterns to Detect

### 1. The "Think First" Dependency Scan

- **Detect:** Every file that imports the target file.
- **Action:** If a signature change occurs, the agent **MUST** update all
  dependent files in the same atomic commit. Never leave broken imports.

### 2. Structural Integrity Check

- **Detect:** Unreachable code, circular dependencies, and misplaced files.
- **Action:** Run the project's native `lint` or `test` commands via `rtk run`.

## 🛠 Execution Layer (RTK Tool Mapping)

| Agent Role    | RTK Validation Command  |
| ------------- | ----------------------- |
| **Tech Lead** | `rtk run gatekeeper`    |
| **Security**  | `rtk run security-scan` |
| **Quality**   | `rtk run eval`          |
| **Any Role**  | `rtk run validate`      |

## 🔴 Script Output Handling (READ → SUMMARIZE → ASK)

- **Step 1:** Run tool and capture ALL output.
- **Step 2:** Categorize findings into `❌ Errors`, `⚠️ Warnings`, and
  `✅ Passed`.
- **Step 3:** Report to user: "Found X errors. Should I apply SOLID
  remediation?"
- **Step 4:** Re-verify with script after fix.

## 📋 Outcome Actions

- **On Pass:** Proceed to `pr-automator`.
- **On Fail:** Return to `planning-expert` for a structural refactoring plan.
