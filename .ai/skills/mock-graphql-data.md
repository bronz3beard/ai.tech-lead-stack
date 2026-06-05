---
name: mock-graphql-data
description:
  Expert guide for generating mock GraphQL data, schema structures, and MSW
  interceptor handlers within the gilly frontend codebase.
cost: ~900 tokens
---

# GraphQL Mock & Handler Generator (The Simulation Engine)

> [!IMPORTANT] > **G-Stack Methodology**: Every mocking task begins with
> **Tech-Stack Discovery**. Do not create ad-hoc mock objects. Ensure mock
> definitions mirror the GraphQL operation definitions and types, and follow
> **MinimumCD** by adding small, type-checked mock states.
>
> **MANDATORY TECHNICAL PROMPT DIRECTIVE**: The agent **MUST** read, load, and
> strictly follow the instructions in the codebase's
> `client/mocks/TECHNICAL_PROMPT.md` file to complete the implementation of
> mocks.

---

## 🎯 Verification Gates

### Phase 0: Tech-Stack Discovery (MANDATORY)

- **Skill Usage Enforcement (NON-NEGOTIABLE):**
  - **Action**: Identify root graphql configuration, handler files, and MSW
    registry.
  - **Target Files**: Inspect `package.json`,
    `client/mocks/handlers/queries.ts`, `client/mocks/handlers/mutations.ts`,
    and `client/mocks/handlers/index.ts`.
  - **MANDATORY Guardrail**: Focus ONLY on technical GraphQL configuration.
    Ensure mock definitions match the active schema expected by queries and
    mutations.

### Gate 1: Operation Alignment

- **Positive (Signal)**: Mocks match the exact operation name (Query/Mutation)
  and data structure expected by the schema.
- **Negative (Noise)**: Ad-hoc mock shapes, missing fields, or incorrect scalar
  types (e.g. string for a Datetime or Int).

### Gate 2: Directory Architecture Enforcement

All mocks, fixtures, scenarios, and environments MUST be created strictly within
the following layout structure under `client/mocks/`:

```text
client/mocks/
├── core-fixtures/              # Core default data (success states)
│   ├── queries/                # Organized by GraphQL operation type
│   │   └── [QueryName].json    # e.g., ComplaintById.json
│   └── mutations/              # Organized by GraphQL operation type
│       └── [MutationName].json # e.g., CreateComplaint.json
│
├── scenarios/                  # Dynamic scenario overrides & state variations
│   ├── index.ts                # Scenario Registry and cookie/header switcher (Controller)
│   └── [scenario-name].ts      # Custom scenario handlers (e.g., auth-error.ts, slow-network.ts)
│
├── handlers/                   # Core MSW GraphQL Handlers
│   ├── index.ts                # Bundles queries + mutations handlers
│   ├── queries.ts              # Maps GET-like GraphQL queries to core-fixtures
│   └── mutations.ts            # Maps POST/PUT-like mutations to core-fixtures
│
└── env/                        # Segregated environment-level setups
    ├── node/                   # Setup for Server-Side / Node dev and backend environments
    │   ├── server.ts           # Exports MSW setupServer instance for Node.js
    │   └── init.ts             # Starts MSW nodeServer and binds global __MOCKS__
    ├── unit-tests/             # Setup for Jest / CI unit tests
    │   ├── server.ts           # setupServer with isolated handlers
    │   └── matchers.ts         # Test-specific assertion helper utilities
    └── e2e/                    # Setup for Playwright E2E tests
        └── server.ts           # setupServer parsing cookies/headers for scenarios
```

---

## 🛠 Execution Workflow

### Phase 1: Operation Definition & Type Generation First (MANDATORY)

Before generating any mock JSON fixtures or writing resolver handlers, the
GraphQL operations and TypeScript types must be generated.

> [!CAUTION] > **NO MANUAL TYPE DEFINITIONS**: Creating manual TypeScript type
> files (e.g., `*.types.ts` or `get-audit-logs.types.ts`) or defining inline
> custom interfaces anywhere under `mocks/` is strictly prohibited. All types
> must be automatically generated via codegen.
>
> [!WARNING] > **ZERO TOLERANCE FOR `any`**: Using `any` or loose, untyped MSW
> handlers is strictly forbidden. Every single query, mutation, and scenario
> handler resolver must be strongly typed. Input variables and resolver return
> types must use definitions imported directly from generated GraphQL types in
> `@gilly-graphql` or `libs/graphql/generated/graphql`.

1. **GraphQL Operation Definition (Greenfield/Brownfield Features)**:
   - Define or update the GraphQL query/mutation definitions inside
     `libs/graphql/graphql-operation-definitions/` first.
   - Run the codegen to generate updated TypeScript definitions:

     ```bash
     pnpm run client:codegen
     ```

2. **Casing & Naming Standards**:
   - **GraphQL Fields**: All exposed GraphQL fields must be strictly `camelCase`
     to maintain schema consistency.
   - **Enum Values**: All custom GraphQL Enum values must be in
     `SCREAMING_SNAKE_CASE` / `UPPERCASE` (e.g., `CREATED`, `UPDATED`,
     `DELETED`).
   - Do NOT scan or mirror existing codebase inconsistencies; strictly enforce
     these camelCase and UPPERCASE Enum rules for all new additions.

3. **MSW Handler Registration Key**:
   - The query or mutation name key registered in MSW handlers must exactly
     match the operation field name in the generated schema (e.g.,
     `getAuditLogs` or `getPermitJointApplication`). Do NOT register or maintain
     duplicate PascalCase/camelCase keys.

4. **ESM / CommonJS Interoperability Checks**:
   - Check the project's `tsconfig.json` target and module resolution options.
   - If any edited/created file mixes ES `import`/`export` and CommonJS
     `module.exports` or `require()`, it must be refactored to standard ESM
     `export` syntax to prevent TypeScript compilation and builder conflicts.

### Phase 2: Scenario Discovery & Interactive Consultation (MANDATORY)

Before writing any scenario files, the agent **MUST** consult with the developer
to determine override requirements:

1. **Explain and Illustrate Scenarios**: Explain to the developer what mock
   scenarios are (temporary state overrides triggered via headers/cookies) and
   showcase existing examples.
2. **Ask and Invite Input**: Ask if they want a specific scenario created for
   the target feature (e.g. validation failure, empty states, database
   timeouts).
3. **Structure Follow-up Questions**: Ask clarifying questions so that the
   generated mock scenario works immediately with no manual intervention.

### Phase 3: Generation of Mocks & Handlers

1. **Create Core Fixtures**:
   - Save static GraphQL success data to
     `client/mocks/core-fixtures/queries/[QueryName].json` or
     `client/mocks/core-fixtures/mutations/[MutationName].json`.
2. **Register Main Handlers**:
   - In `client/mocks/handlers/queries.ts` or
     `client/mocks/handlers/mutations.ts`, define the MSW handler matching the
     operation name, returning the JSON fixture file inside
     `HttpResponse.json({ data: ... })`.
   - Update `client/mocks/handlers/index.ts` to export all query and mutation
     handlers.
3. **Register Scenario Overrides**:
   - Save scenario handlers in `client/mocks/scenarios/[scenario-name].ts`.
   - Register the new scenario handler in `client/mocks/scenarios/index.ts`.

---

## 📋 Outcome Actions & Safety

### Deliverables

- Target JSON stubs, MSW resolvers, and scenario configurations written to the
  exact layout directories under `client/mocks/`.

### Mandatory Developer Hand-Off Summary (MANDATORY)

Upon successfully completing the frontend mock implementation and ensuring all
typechecks and unit tests pass, the agent **MUST** output a detailed hand-off
summary informing the developer what was done and that they are ready to
transition to the frontend.

The summary **MUST** follow this exact format:

```text
Yes, you are fully ready to begin frontend integration.

Here is the checklist of what is complete and ready on the backend:

- **GraphQL Types & Schema**: [Details of schema extensions and concrete types added, and confirming GenQL type generation is complete]
- **Mock Interceptor**: [Details of query or mutation handlers registered under their respective mock flags]
- **Core Fixtures**: [Details of core fixture JSON files generated, e.g. "320 realistic audit log items are compiled in GetAuditLogs.json"]
- **Scenarios**: [Details of active mock scenarios configured, e.g. "auth-error" and "slow-network" overrides]
- **How to Fetch**: When making requests from the frontend client, pass the following headers to hit the mock data:
  - `x-beta-flags: [flagName]` to trigger the interceptor.
  - `x-mock-scenario: [scenarioName]` (optional) to test edge cases.

Everything is pushed to your branch, so you can pull/checkout the matching branch in your frontend repository and begin querying [queryOrMutationName]!
```

### Verification Command

Verify that the project compiles cleanly after mock generation:

```bash
pnpm run client:check-types
```

### Rollback Plan

If errors are introduced:

1. Discard new mock files:

   ```bash
   rm -f client/mocks/core-fixtures/queries/[QueryName].json
   rm -f client/mocks/core-fixtures/mutations/[MutationName].json
   ```

2. Revert mocks registry changes.
