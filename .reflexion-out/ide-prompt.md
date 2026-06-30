# IDE Implementation Prompt (reviewed by the Reflexion Loop — score 8/10)

You are implementing a plan that has ALREADY been generated and critiqued
against the Four Pillars (G-Stack / Atomic Batches / Production Ethos / Modern
Web). Do not re-plan from scratch. Implement it as atomic commits (<100 LOC
each), running the stated verification gate after every slice before moving on.

## Original brief
Add token-bucket rate limiting to the public API

## Reviewed plan to implement
## Phase 0 - Stack Diagnosis
- **Runtime**: Node.js >= 22.0.0 (per `package.json`).
- **Framework**: Next.js (detected via `tsconfig.json` and `next-env.d.ts`).
- **Language**: TypeScript (Strict mode enabled, `moduleResolution: bundler`).
- **Patterns**: Mixed-environment codebase using Next.js for web/API and Bash/Node for tooling.
- **Constraints**: Rate limiting must function within Next.js Middleware (Edge Runtime). This limits available libraries (no native Node.js `crypto` or `fs` during execution) and requires highly optimized O(1) logic to avoid blocking the request pipeline.

## Architecture
The implementation will use a **Token Bucket** algorithm implemented as a decoupled service. 
- **Storage Strategy**: An `IRateLimitStore` interface will support an initial `InMemoryStore` (using a simple `Map`). This is designed for single-instance or "sticky" environments; the interface allows a future `RedisStore` for distributed environments.
- **Client Identification**: IP-based identification using a robust extraction utility that prioritizes `request.ip` (provided by the Edge runtime) and falls back to sanitized `x-forwarded-for` headers.
- **Middleware Integration**: A `src/middleware.ts` implementation will intercept `/api/*` routes, check the bucket, and respond with `429 Too Many Requests` when tokens are exhausted.
- **Headers**: Adheres to IETF draft standards (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`).

## Atomic Task List

### 1. Define Rate Limit Interfaces & Configuration
- **What**: Create `src/lib/rate-limit/types.ts` defining `RateLimitConfig`, `BucketState`, and `RateLimitResult`.
- **Why**: Provides the contract for the engine and store, ensuring type safety in the Edge environment. (<30 LOC).
- **Verification**: `npx tsc --noEmit` passes.

### 2. Implement Token Bucket Logic (Core Engine)
- **What**: Create `src/lib/rate-limit/bucket.ts`. A pure function `consume(state: BucketState, config: RateLimitConfig): RateLimitResult`.
- **Why**: Separates mathematical refill/consumption logic from state management. Makes the algorithm easily testable without mocks. (<60 LOC).
- **Verification**: Unit tests covering: full bucket consumption, partial refills over time, and exhaustion scenarios.

### 3. Implement In-Memory Store
- **What**: Create `src/lib/rate-limit/memory-store.ts`. Implements `IRateLimitStore` using a standard `Map<string, BucketState>`.
- **Why**: Provides state persistence for the local dev server and single-node deployments. (<40 LOC).
- **Verification**: Unit test: `set` a key, `get` it back, and ensure `deleteOldEntries` (optional/basic) works.

### 4. Implement Robust IP Extraction Utility
- **What**: Create `src/lib/rate-limit/get-ip.ts`. Logic: `request.ip ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'`.
- **Why**: Critical for security. Prevents spoofing by prioritizing the platform-provided `request.ip` and sanitizing headers. (<30 LOC).
- **Verification**: Unit tests with mocked `NextRequest`: 1) Valid `request.ip`, 2) Missing `request.ip` with `x-forwarded-for` list, 3) Missing both (fallback to local), 4) Malformed headers.

### 5. Create Rate Limiter Service
- **What**: Create `src/lib/rate-limit/limiter.ts`. A class that brings together the store, the bucket logic, and the IP utility into a single `check(req: NextRequest)` method.
- **Why**: High-level API for the middleware to keep the entry point clean. (<50 LOC).
- **Verification**: Test script simulating 10 rapid calls using the limiter instance; verify the transition from 200 (Success) to 429 (Failure).

### 6. Next.js Middleware Integration
- **What**: Implement `src/middleware.ts`. Filter for `/api/`, call the limiter, and map the result to `NextResponse` with appropriate status and `RateLimit-*` headers.
- **Why**: Enforces the limit at the Edge, before expensive API route handlers execute. (<60 LOC).
- **Verification**: Run local dev; execute `curl -I http://localhost:3000/api/hello`. Verify `RateLimit-Limit` header is present.

### 7. End-to-End Integration Test
- **What**: Create `scripts/test-rate-limit.sh`. A bash script that uses `curl` in a loop until a `429` status code is returned.
- **Why**: Final confirmation that all layers (IP extraction, Store, Engine, Middleware) work in unison.
- **Verification**: Script must exit 0 only if a 429 is received and the `RateLimit-Remaining` header is `0`.

## Risks & Verification

### Risk: IP Spoofing
- **Detail**: Clients may send fake `x-forwarded-for` headers to bypass limits.
- **Mitigation**: Task 4 explicitly prioritizes `request.ip` (populated by Vercel/Next.js runtime from secure upstream) and only treats the first entry of `x-forwarded-for` as a fallback. 
- **Verification**: Automated unit test in Task 4 specifically simulates a multi-IP `x-forwarded-for` header and asserts only the first index is extracted.

### Risk: Edge Runtime Compatibility
- **Detail**: The `src/lib/rate-limit` code must not use Node.js-specific globals (like `process.env` access without fallbacks or native `crypto`).
- **Mitigation**: Use standard Web APIs only.
- **Verification**: Middleware will fail to compile/run in Next.js dev mode if non-Edge-compatible APIs are used.

### Risk: Memory Leak
- **Detail**: The `InMemoryStore` Map could grow indefinitely with unique IP addresses.
- **Mitigation**: Implement a basic TTL-based cleanup or a maximum Map size in the `memory-store.ts`.
- **Verification**: Unit test in Task 3 verifying that the Map size does not exceed a defined threshold or that old entries are evictable.

## Execution rules
- One vertical slice per commit; never batch unrelated changes.
- After each slice, run its verification gate and paste the evidence.
- If reality diverges from the plan, stop and surface the conflict before coding.