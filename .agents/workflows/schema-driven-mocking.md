---
name: schema-driven-mocking
description: Automated Mock & MSW Handler Generation (Schema-First or Synthesized)
---

// turbo-all

# 🛠️ Schema-Driven Mocking Skill

This skill governs the automated generation of mock JSON data and MSW (Mock Service Worker) handlers based on an API schema (GraphQL/OpenAPI) or a synthesized schema derived from codebase conventions when a schema is not yet available.

> [!IMPORTANT]
> **Core Objective**: Prevent ad-hoc, untyped mock implementations. Ensure all generated mocks are centralized, strictly typed, and aligned with current project conventions (e.g., GraphQL schemas, custom scalars, naming casing, and error structures).

---

## 🎯 Verification Gates

### Phase 0: Discovery & Ecosystem Analysis
Before generating any mock data, the agent MUST investigate the current workspace to align with existing conventions.

- **Check 1: Existing Schema Sources**: Search for existing schema definition formats:
  - File extensions: `.graphql`, `.gql`, or `*.definition.ts` files (e.g., `libs/graphql/graphql-operation-definitions/`).
  - Generated files containing types: e.g., `libs/graphql/generated/graphql.tsx` or `graphql.schema.json`.
- **Check 2: Custom Scalars & Common Types**: Identify custom scalar formats like `Datetime`, UUID, or pagination shapes (e.g., connection/edge/nodes patterns vs. flat arrays) used in current queries/mutations.
- **Check 3: Mock Infrastructure**: Check if MSW is already configured in the repo (e.g., `mocks/handlers.ts`, `test-setup.ts`, or `client/public/sw.js`). If not, determine the correct location to bootstrap mocks (default to `mocks/` or `client/mocks/`).

### Phase 1: Input Analysis & Schema Synthesis
- **Input Check**: Did the developer provide an API schema or description?
  - **Schema Provided**: Use the schema directly as the source of truth.
  - **No Schema Provided (Backend Not Ready)**:
    1. Read the developer's requested requirements (e.g., "Mock query for fetching and updating inspector reports").
    2. Search the codebase for related domain entities (e.g., matching types in `generated/graphql.tsx` or similar files).
    3. Construct a best-practice, draft GraphQL schema (or REST endpoint template) that aligns with:
       - The casing conventions of the codebase (e.g., camelCase fields, PascalCase types).
       - Existing types (e.g. reusing `User`, `Organization`, or `PermitStatus` if referenced).
       - Common metadata headers (e.g. `id`, `createdAt`, `updatedAt`).

### Phase 2: Generation of Artifacts
- **Mock JSON Data**: Generate clean, realistic JSON stubs.
  - Place stubs under `mocks/data/` (or project equivalent, e.g., `client/mocks/data/`).
  - Create multiple data profiles representing:
    - **Success State**: Complete and populated data.
    - **Empty State**: Responding with empty arrays or null fields where applicable.
    - **Error State**: Simulating validation failures or auth errors (aligned with project error formatting).
- **MSW Handlers**: Generate TypeScript MSW handlers conforming to MSW v2 (or v1 depending on package dependencies).
  - Place handlers under `mocks/handlers/` or `mocks/handlers.ts`.
  - Ensure all mock handlers use the created JSON stubs.
  - Type the handlers strictly using generated types (e.g., from `libs/graphql/generated/graphql.tsx`).

### Phase 3: Integration & Compilation
- **Export Register**: Register new handlers inside the main handlers index (e.g., `mocks/handlers.ts` or similar server/worker setups).
- **Type Check**: Execute the TypeScript compiler (`tsc` or `nx typecheck`) to ensure all types are valid and compile cleanly.
- **Verify Execution**: Ensure there are no runtime syntax errors or broken imports.

---

## 🔄 Rollback Strategy (Non-Destructive Execution)
If the mock generation fails to compile or breaks existing mock infrastructure:
1. Revert edits to central registration files (`mocks/handlers.ts` or `test-setup.ts`).
2. Delete any newly created files in `mocks/data/*` and `mocks/handlers/*`.
3. Restore any modified files to their original git state using `git checkout -- <file>`.

---

## 📑 Deliverables
- **Mock Data File**: `mocks/data/[feature-name].json`
- **MSW Handler File**: `mocks/handlers/[feature-name].ts`
- **Updated Registration**: `mocks/handlers.ts` (or main entry point)
- **Validation Proof**: Compilation check showing no TS errors.
