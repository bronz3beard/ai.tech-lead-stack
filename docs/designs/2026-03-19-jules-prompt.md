# Prompt for Google Jules

**Context:** We are building a new feature: an "Agent Analytics Dashboard". The
user wants a simple React app using Next.js 16 (App Router), React 19, and
Shadcn UI. It must feature a global public dashboard and an authenticated
dashboard (scoped to the user). It will track agent workflow and skill usage
using Langfuse.

**Your Task:** Implement the "Agent Analytics Dashboard" exactly as specified in
the architectural design document located at
`docs/designs/2026-03-19-agent-analytics-dashboard.md`.

**Strict Technical Requirements (User Rules):**

1. **Framework:** React 19+ & Next.js 16+ (App Router). Prefer Server
   Components. Use `use cache` where applicable.
2. **Styling:** Tailwind CSS + CVA for variants. Use complete strings for
   dynamic classes. Incorporate Shadcn UI components.
3. **Database & Auth:** Use Postgres. Use Passport.js `local` strategy for
   email/password sign-in or nextauth (auth.js) with email password.
4. **Local Env:** Provide a `docker-compose.yml` for local Postgres and
   Langfuse.
5. **Analytics:** Integrate Langfuse Node SDK to wrap agent-agnostic skills.
   Ensure metrics can be aggregated for both public viewing (global stats) and
   authenticated viewing (user-scoped).
6. **Code Quality:** strict TypeScript (`strict: true`). Early returns. Validate
   all inputs/API payloads with Zod.

**Execution Steps:**

1. Read `docs/designs/2026-03-19-agent-analytics-dashboard.md`.
2. Scaffold the Next.js application if not already present, or integrate into
   the existing workspace.
3. Set up the `docker-compose.yml` with Postgres and Langfuse.
4. Implement the Database schema and Passport authentication flow.
5. Create the generic Langfuse telemetry wrapper for skills (`withAnalytics`).
6. Build the UI: `/` for the public dashboard, and `/dashboard` for the
   authenticated user view. Use Shadcn charts to display execution metrics.
7. Ensure your implementation includes a robust rollback strategy as defined in
   the design document.

Please begin by reading the design document and setting up the local Docker
environment.
