// turbo-all

# 🛠️ Schema-Driven Mocking Skill

This skill governs the automated generation of frontend MSW mock JSON data, handler resolvers, and scenarios based on the API schema (GraphQL) or a synthesized schema derived from codebase conventions when a schema is not yet available.

> [!IMPORTANT] > **Core Objective**: Prevent ad-hoc, untyped mock implementations. Ensure all generated mocks are centralized, strictly typed, and aligned with current project conventions (e.g., GraphQL schemas, custom scalars, naming casing, and error structures).
>
> **MANDATORY EXECUTION GUARD (NON-NEGOTIABLE)**: To execute this workflow, the agent **MUST ALWAYS** load and read the skill file `.ai/skills/mock-graphql-data.md` (located in the frontend repository: `gilly/`). Bypassing the skill or implementing mocks using ad-hoc, custom patterns is strictly prohibited!

---

## 🎯 Verification Gates

### Phase 0: Discovery & Ecosystem Analysis

Before generating any mock data, the agent MUST investigate the current workspace to align with existing conventions.

- **Check 1: Existing Schema Sources**: Search for existing schema definition formats:
  - File extensions: `libs/graphql/generated/graphql.tsx` or `libs/graphql/generated/graphql.schema.json`.
- **Check 2: Custom Scalars & Common Types**: Identify custom scalar formats like `Datetime`, `UUID`, or pagination shapes (e.g., connection/edge/nodes patterns vs. flat arrays) used in `libs/graphql/generated/graphql.tsx`.
- **Check 3: Mock Infrastructure**: Check the files under `client/mocks/` to locate the target folders:
  - `core-fixtures/queries/` and `core-fixtures/mutations/` for JSON stubs.
  - `handlers/queries.ts` and `handlers/mutations.ts` for MSW resolvers.
  - `scenarios/index.ts` for scenario overrides.

### Phase 1: Schema Updates & Migrations First (MANDATORY)

Before writing any mock JSON fixtures or creating MSW resolvers:

- **Greenfield Feature**: First, write/define the GraphQL query or mutation definitions inside `libs/graphql/graphql-operation-definitions/` so that the code generator can generate the corresponding TS operations.
- **Brownfield Feature**: If new fields or operations are needed on the client, update the query/mutation definitions in `libs/graphql/graphql-operation-definitions/` first.

### Phase 2: CodeGen Type Generation (MANDATORY)

You **MUST** generate the TypeScript types before proceeding with mocks so that the mocks can be implemented with strict typing:

1. **Client Types**: Run the frontend code generator to update GraphQL types:
   ```bash
   pnpm run client:codegen
   ```
2. **Strict Typing Guard**:
   - **NO MANUAL TYPES**: Writing manual typescript type definition files (like `*.types.ts`) or defining inline custom interfaces anywhere under `mocks/` is strictly prohibited.
   - **ZERO ANY POLICY**: Using `any` or loose, untyped resolvers is strictly forbidden. Every single query, mutation, and scenario handler resolver must be strongly typed.

### Phase 3: Generation of Artifacts

- **Mock JSON Data**: Generate clean, realistic JSON stubs.
  - Place stubs under `client/mocks/core-fixtures/queries/` or `client/mocks/core-fixtures/mutations/` (excluding the top-level `"data"` wrapper).
  - Create multiple data profiles representing success, empty, and error states.
- **GraphQL MSW Resolver Handlers**: Generate type-safe resolver handlers mapping to core-fixtures.
  - Place resolver mapping inside `client/mocks/handlers/queries.ts` or `client/mocks/handlers/mutations.ts`.
  - **Strict Typing**: Import the exact operation types (e.g. `ComplaintByIdQuery`, `ComplaintByIdQueryVariables`) from `libs/graphql/generated/graphql` or `@gilly-graphql`. Do not use fallback `(variables: any) => any` resolvers without type definitions. Do not use `any` for resolver variables or return types.
  - Ensure all mock resolvers return `HttpResponse.json({ data: ... })` with the correct JSON stubs.
  - **Node.js Compatibility**: Ensure handlers are strictly Node-compatible (no browser-only APIs such as `window` or `document`).
  - **Beta Flags / Dark Releases**: If configuring a frontend-side mock fallback, check beta flags inside cookies or the `x-beta-flags` header. If active, return the mock payload; otherwise, return `undefined` to fall through to the real API.
  - **Scenarios Support**: For custom testing scenarios, register scenario resolvers inside `client/mocks/scenarios/index.ts` keyed by the scenario name (e.g. `auth-error`, `slow-network`), switching based on the `x-mock-scenario` header or `mock-scenario` cookie.

### Phase 4: Integration & Compilation

- **Export Register**: Register new handlers inside `client/mocks/handlers/queries.ts` or `client/mocks/handlers/mutations.ts` so they export to the main registries in `client/mocks/handlers/index.ts`.
- **Type Check**: Execute the TypeScript compiler check on `client` to ensure all types are valid and compile cleanly:
  ```bash
  pnpm run client:check-types
  ```
- **Verify Execution**: Ensure there are no runtime syntax errors or broken imports when running client tests or starting the client development environment.

---

## 🔄 Rollback Strategy (Non-Destructive Execution)

If the mock generation fails to compile or breaks existing mock infrastructure:

1. Revert edits to handler registries (`client/mocks/handlers/queries.ts`, `client/mocks/handlers/mutations.ts`, or `client/mocks/scenarios/index.ts`).
2. Delete any newly created JSON stubs in `client/mocks/core-fixtures/queries/*` and `client/mocks/core-fixtures/mutations/*`.
3. Restore any modified files to their original git state using `git checkout -- <file>`.

---

## 📑 Deliverables

- **Core Fixture File**: `client/mocks/core-fixtures/[queries|mutations]/[OperationName].json`
- **Updated Handlers**: `client/mocks/handlers/[queries|mutations].ts`
- **Updated Scenario Registry (Optional)**: `client/mocks/scenarios/index.ts`
- **Validation Proof**: Compilation check (`pnpm run client:check-types` output) showing no TS errors.
