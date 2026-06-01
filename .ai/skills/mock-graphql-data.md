---
name: mock-graphql-data
description:
  Expert guide for generating mock GraphQL data, schema structures, and MSW
  handlers within the gilly codebase.
cost: ~900 tokens
---

# GraphQL Mock & Handler Generator (The Simulation Engine)

> [!IMPORTANT] **G-Stack Methodology**: Every mocking task begins with
> **Tech-Stack Discovery**. Do not create ad-hoc mock objects. Ensure mock
> definitions mirror the generated types in `libs/graphql/generated/graphql.tsx`
> and follow **MinimumCD** by adding small, type-checked mock states.

## 🎯 Verification Gates

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **Action:** Identify root graphql configuration, codegen commands, and MSW
    setup.
  - **Target Files:** Inspect `package.json`,
    `libs/graphql/generated/graphql.tsx`, and
    `libs/graphql/graphql-operation-definitions/`.
  - **MANDATORY Guardrail:** Focus ONLY on technical GraphQL configuration.
    Ignore all images, binary assets, and unrelated documentation files. Ensure
    mock definitions mirror the actual GraphQL fields and types in the
    workspace.

### Gate 1: Operation & Type Alignment

- **Positive (Signal):** Mocks match the exact operation name (Query/Mutation)
  and data structure generated in `libs/graphql/generated/graphql.tsx`.
- **Negative (Noise):** Ad-hoc mock shapes, missing fields, or incorrect scalar
  types (e.g. string for a Datetime or Int).

### Gate 2: Directory Architecture Enforcement

All mocks, fixtures, scenarios, and environments MUST be created strictly within
the following layout structure under `client/mocks/`:

```text
client/mocks/
├── core-fixtures/              # Core default data (success states)
│   ├── queries/                # Organized by GraphQL operation type
│   │   └── [QueryName].json
│   └── mutations/              # Organized by GraphQL operation type
│       └── [MutationName].json
│
├── scenarios/                  # Dynamic scenario overrides & state variations
│   ├── index.ts                # Scenario Registry and cookie/header switcher (Controller)
│   └── [scenario-name].ts      # Custom scenario handlers (e.g. auth-error, slow-network)
│
├── handlers/                   # Core MSW GraphQL Handlers
│   ├── index.ts                # Bundles queries + mutations handlers
│   ├── queries.ts              # Maps GET-like GraphQL queries to core-fixtures
│   └── mutations.ts            # Maps POST/PUT-like mutations to core-fixtures
│
└── env/                        # Segregated environment-level setups
    ├── local-dev/              # Setup for local PWA Next.js dev server (browser.ts, init.ts)
    ├── unit-tests/             # Setup for Jest / CI unit tests (server.ts, matchers.ts)
    └── e2e/                    # Setup for Playwright E2E tests (server.ts)
```

---

## 🛠 Execution Workflow

### Phase 1: Operation Analysis & Extraction

1. Locate the target query/mutation definition file under
   `libs/graphql/graphql-operation-definitions/` (e.g.,
   `complaints.definition.ts`).
2. Run codegen to verify the operations are up-to-date:

   ```bash
   pnpm run client:codegen
   ```

### Phase 2: Scenario Discovery & Interactive Consultation (MANDATORY)

Before writing any scenario files, the agent **MUST** consult with the developer
to determine override requirements:

1. **Explain and Illustrate Scenarios**: Explain to the developer what mock
   scenarios are (temporary state overrides triggered via headers/cookies) and
   showcase existing examples (e.g., `auth-error` simulating expired Cognito
   sessions or `slow-network` injecting latency).
2. **Ask and Invite Input**: Ask if they want a specific scenario created for
   the target feature (e.g. validation failure, empty states, database
   timeouts).
3. **Structure Follow-up Questions**: Ask clarifying questions so that the
   generated mock scenario works immediately with no manual intervention.
   - _Example questions_: "Should the error status be a 400 with a custom
     validation payload, or a 500 server error?", "What fields should trigger
     the validation error?"

### Phase 3: Generation of Mocks & Handlers

1. **Create Core Fixtures**:
   - Save static GraphQL success data to
     `client/mocks/core-fixtures/queries/[QueryName].json` or
     `client/mocks/core-fixtures/mutations/[MutationName].json`.
2. **Register Main Handlers**:
   - In `client/mocks/handlers/queries.ts` or
     `client/mocks/handlers/mutations.ts`, define the MSW handler matching the
     operation name, returning the JSON fixture file.
   - Update `client/mocks/handlers/index.ts` to export all query and mutation
     handlers.
3. **Register Scenario Overrides**:
   - Save scenario handlers in `client/mocks/scenarios/[scenario-name].ts`.
   - Register the new scenario handler in `client/mocks/scenarios/index.ts`.

### Phase 4: Verification & Debugging Strategy

If type compilation checks fail or mocks do not resolve correctly, the agent
must run the following debugging flow:

1. **Type Definition Alignment**: Compare the JSON mock stub keys directly
   against the generated TypeScript types in
   `libs/graphql/generated/graphql.tsx`. Confirm that no required fields are
   omitted.
2. **Scalar Formatting Verification**: Inspect custom scalars (e.g. make sure
   UUIDs are in valid hex format, Datetime values are correct ISO-8601 strings,
   and numbers are not wrapped in quotes).
3. **Handler Scope and Registration Check**: Verify
   `client/mocks/handlers/index.ts` is successfully bundling the handlers. Check
   that browser workers/Node servers are initialized without warnings.
4. **Iterative Compilation Loop**: Run `pnpm client:check-types` after every fix
   attempt. Do not present the solution to the developer until the command exits
   successfully with `0`.

---

## 📋 Outcome Actions & Safety

### Deliverables

- Target JSON stubs, MSW handlers, and scenario configurations written to the
  exact layout directories under `client/mocks/`.

### Rollback Plan

If type validation fails or errors are introduced:

1. Discard new mock files:

   ```bash
   rm -f client/mocks/core-fixtures/queries/[QueryName].json
   rm -f client/mocks/core-fixtures/mutations/[MutationName].json
   rm -f client/mocks/handlers/[handler-name].ts
   rm -f client/mocks/scenarios/[scenario-name].ts
   ```

2. Revert mock index changes:

   ```bash
   git checkout -- client/mocks/handlers/queries.ts client/mocks/handlers/mutations.ts client/mocks/handlers/index.ts client/mocks/scenarios/index.ts
   ```

3. Verify compilation is restored:

   ```bash
   pnpm client:check-types
   ```
