# The Web App

[← Back to the README](../README.md)

The repo provides a hosted web surface at
[https://ai-tech-lead-stack.vercel.app](https://ai-tech-lead-stack.vercel.app).
**Note:** The website/chat surface is READ-ONLY and returns a plan plus a
copy-paste IDE prompt; only the IDE/MCP surface edits code.

| Route                              | Purpose                                  |
| :--------------------------------- | :--------------------------------------- |
| `/chat`                            | Read-only advisory interface             |
| `/dashboard`                       | Agentic Health telemetry                 |
| `/reflexion`                       | Web frontend for the Reflexion loop      |
| `/skills/roles`                    | Role definitions                         |
| `/skills/solutioning`              | Collaborative solutioning interface      |
| `/skills/new`                      | New skill scaffolding                    |
| `/feature-development/discovery`   | Phase 0 Discovery interface              |
| `/feature-development/in-progress` | Implementation tracker                   |
| `/design-review`                   | Design system and PR review interface    |
| `/onboarding`                      | Onboarding interface for new devs        |
| `/settings`                        | API keys and Agent routing configuration |

## Run it on your own machine

You need Node.js 22.5 or later, pnpm (`corepack enable` turns it on), and a
Postgres database. The steps below use Docker for the database; any Postgres
works if you change `DATABASE_URL`.

1. Get the code and install it:

   ```bash
   git clone https://github.com/bronz3beard/ai.tech-lead-stack.git tech-lead-stack
   cd tech-lead-stack
   pnpm install
   ```

2. Create your settings file. Everything lives in this one `.env` at the top of
   the repo; the web app and the database tools both read it.

   ```bash
   cp .env.example .env
   ```

   Then fill in two values:
   - `NEXTAUTH_SECRET`: paste the output of `openssl rand -base64 32`.
   - `ENCRYPTION_KEY`: paste the output of `openssl rand -hex 32`. Keep it safe:
     if it changes, API keys saved in `/settings` can no longer be read.

   `DATABASE_URL` already points at the Docker database from the next step.

3. Start the database and create its tables:

   ```bash
   docker compose up -d db
   pnpm db:migrate
   ```

4. Start the web app, then open http://localhost:3000 and sign up with an email
   and password:

   ```bash
   pnpm web:dev
   ```

   To see every project, add your email to `SUPER_ADMIN` in `.env`. GitHub
   sign-in is optional; it needs `GITHUB_ID` and `GITHUB_SECRET` from a
   [GitHub OAuth app](https://github.com/settings/developers) whose callback URL
   is `http://localhost:3000/api/auth/callback/github`.

**Usage metrics.** The dashboard shows what the MCP server records. Both must
use the same database: an MCP server started from this clone reads the same
`.env`, so it already does.

## Hosting it yourself

Host it wherever you like: a Node.js server, a container platform, or a
serverless host such as Vercel. Whichever you pick:

1. **Use a hosted Postgres** (for example Neon, Railway or Supabase) and put its
   connection string in `DATABASE_URL`. Managed hosts need TLS settings; see
   `DATABASE_SSL_MODE` in [`.env.example`](../.env.example).
2. **Set the same variables as your `.env`** in the host's settings, with
   `NEXTAUTH_URL` changed to your public address. If you use GitHub sign-in,
   change the OAuth app's callback URL to match.
3. **Create or update the tables** from your computer, pointed at the hosted
   database. Run it again after each upgrade:

   ```bash
   DATABASE_URL="<hosted connection string>" pnpm db:migrate
   ```

4. **Build and start:**

   ```bash
   pnpm --filter @bronz3beard/tls-dashboard build
   pnpm --filter @bronz3beard/tls-dashboard start
   ```

Point every MCP server whose usage you want to see at the same `DATABASE_URL`.
