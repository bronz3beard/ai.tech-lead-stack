# Agent Analytics Dashboard - Architecture Design

## 🎯 Verification Gates Context

**1. Core Goal:** Launch a React 19 / Next.js 16+ application featuring both a
global public dashboard and a user-scoped authenticated dashboard to visualize
agent workflow and skill usage. **2. Success Metric:** The application
successfully authenticates users via Passport (email/password), runs in a local
Docker environment with Postgres, and displays real-time execution analytics
driven by Langfuse integrations. **3. Scope/Timeline:** Medium (1-2 weeks). **4.
Architectural Layers:** UI (React/Next.js Server Components), API (Next.js route
handlers/actions), Data (Postgres via Docker), Analytics (Langfuse).

---

## 🛠 Strategic Design Process

### Phase 2: Approach Exploration (The Fork)

- **Option A (The G-Stack Way - Recommended):** Next.js 16 App Router utilizing
  React 19 functional components. UI built with Tailwind CSS, CVA, and Shadcn
  UI. Authentication uses standard Passport.js `local` strategy adapted for
  Next.js API routes/actions or if more simple use next auth (auth.js) with
  email password. Postgres runs in a local `docker-compose` stack alongside a
  local Langfuse container for agent-agnostic analytics.

**Decision:** Option A perfectly aligns with the `user_global` tech stack rules.

---

### Phase 3: Architectural Presentation

#### 1. The Data Model

Postgres will handle core application state, while Langfuse handles the
high-volume telemetry.

- **`users` table:** `id` (UUID), `email` (unique), `password_hash`,
  `created_at`.
- **`sessions` table:** Standard session storage for Passport.
- **Langfuse Mapping:** Langfuse natively tracks `userId`. When a skill is
  executed by an authenticated user, the telemetry trace includes their Postgres
  `User.id`. For public executions, it uses an `anonymous` flag.

#### 2. The Logic

- **Authentication:** Passport.js `local` strategy handles email/password
  validation. Passwords hashed via `bcrypt`. Sessions managed via secure
  HTTP-only cookies. Early returns and Zod validation applied to all
  login/register payloads.
- **Skill Telemetry:** A generic `withAnalytics(skill, context)` wrapper wraps
  all agent-agnostic skills. It initializes a Langfuse trace, logs
  inputs/outputs, and records performance latency.
- **Dashboard Aggregation:** Next.js Server Components (`use cache` where
  appropriate) fetch aggregation metrics directly from the Langfuse API (e.g.,
  total executions, average latency, top skills, success rates) using `userId`
  for the authenticated view and global scope for the public view.

#### 3. The Interface

- **Shadcn UI & Styling:** Utilizing `Card`, `Button`, `Input`, `Form`
  components. Charts rendered via Shadcn's chart components (built on Recharts).
- **Public Dashboard (`/`):** Global counter cards (Total Skills Run, Active
  Workflows) and a bar chart of top skills universally.
- **Auth Dashboard (`/dashboard`):** Protected route. Matches the public layout
  but filters Langfuse data strictly to the logged-in `User.id`.

#### 4. The Proof

- **Unit Tests (Jest):** Logic assertions for the `withAnalytics` Langfuse
  wrapper and Passport authentication strategies.
- **Component Tests:** Rendering states for Dashboard metric cards (loading,
  error, success).
- **Manual Verification:** Spin up `docker-compose`, register a user, execute a
  mock skill, and visually verify the count increments on both the global and
  user-scoped dashboards.

---

## 📦 Deliverables Validation & Tasks

### Implementation Tasks (Prioritized)

1. **[2h] Docker Setup:** Create `docker-compose.yml` defining Postgres and
   Langfuse local instances.
2. **[3h] Next.js Initialization:** Scaffold Next.js 16 app with Tailwind, CVA,
   and Shadcn UI. Setup strict TypeScript `tsconfig`.
3. **[4h] Authentication:** Implement Passport.js or nextauth (auth.js) local
   strategy, Next.js API route handlers for login/register, and Postgres schema
   (via Prisma).
4. **[3h] Langfuse Wrapper:** Build the generic agent telemetry wrapper for any
   skill using Next.js Server Actions.
5. **[4h] UI Dashboards:** Build the global and authenticated dashboard layouts
   using Server Components and Shadcn charts.

### Filing/Testing Strategy

- **New Files:** `docker-compose.yml`, `src/lib/auth.ts`,
  `src/lib/analytics.ts`, `src/app/page.tsx`, `src/app/dashboard/page.tsx`.
- **Testing:** Add `src/lib/__tests__/auth.test.ts` and
  `src/lib/__tests__/analytics.test.ts`.

### 🔄 Mandatory Rollback Strategy

If the Next.js/Passport integration or local Langfuse container causes critical
failures:

1. **DB Rollback:** Revert any Postgres migrations applied during the feature
   branch.
2. **Code Reversal:** Revert the merge commit for this feature branch to restore
   the repository to the pre-dashboard state.
3. **Container Teardown:** Run `docker-compose down -v` to wipe local
   experimental data volumes for Postgres and Langfuse.
4. **Fallback:** If local Langfuse is too heavy for the Docker environment,
   fallback to Langfuse Cloud for analytics telemetry.
