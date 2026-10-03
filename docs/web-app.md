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

## Optional: preview web pages in the chat

Setting: `NEXT_PUBLIC_CHAT_HTML_PREVIEW`. It is off unless you turn it on.

### What it does

Some answers in `/chat` contain a small web page, written as code. The
[`show-it`](skills.md) skill does this when a picture explains something better
than words: a bar chart comparing sizes, for example, or a diagram with labels.

- **With the setting off** (the default), you see the code with a copy button,
  the same as any other code in the chat. To see the page itself, you would copy
  the code into a file and open it in your browser.
- **With the setting on**, two buttons appear above that code: **Source** and
  **Preview**. Source shows the code, and is what you see first. Preview shows
  the page itself, right there in the chat.

Diagrams written in mermaid already appear as pictures in the chat, with or
without this setting. This setting only adds the Preview button to web-page
code.

### Why it exists

`show-it` answers questions with pictures instead of paragraphs. In editors such
as Claude Code or Cursor, it saves its web pages as files you can open. The web
chat can't save files for you, so without a preview a web-page answer arrives as
code you have to copy out before you can see what it shows. The preview removes
that step.

### Why it is off by default

The page is written by an AI, so the web app does not trust it. Preview shows it
inside a locked box:

- **It cannot run programs.** No JavaScript runs, so the page cannot click,
  type, open pop-ups, or change anything. It can only be looked at.
- **It cannot reach the internet.** It cannot load images, fonts or anything
  else from another website, so it cannot track you or send information
  anywhere.
- **It cannot see the rest of the web app.** It has no access to your login,
  your other chats, or the page around it.

These locks are tested. Even so, it is a new way of showing AI-written content,
so you decide whether to turn it on. Turning it off brings back exactly the
behaviour from before.

### Turn it on, on your own computer

1. Open the `.env` file at the top of the repository folder. This is the file
   you made in [Run it on your own machine](#run-it-on-your-own-machine). It is
   **not** `~/.tech-lead-stack/.env`; that file is for your coding apps, not for
   the web app.
2. Add this line, or remove the `#` in front of it if it is already there:

   ```bash
   NEXT_PUBLIC_CHAT_HTML_PREVIEW="true"
   ```

3. Restart the web app: stop it (press Ctrl+C where it is running), then start
   it again:

   ```bash
   pnpm web:dev
   ```

4. To check it works, open `/chat` and ask for a visual web page, for example
   `/show-it show a bar chart of the sizes of our five largest skills as an HTML page`.
   When the code appears, click **Preview**.

### Turn it on, on a hosting service

Add `NEXT_PUBLIC_CHAT_HTML_PREVIEW` with the value `true` in your host's
environment variable settings, the same place you put `DATABASE_URL`. Then
**redeploy**. Saving the setting on its own does nothing until the app is built
again; most hosts, including Vercel, rebuild when you redeploy.

### Turn it off

Delete the line, put a `#` in front of it, or change `true` to `false`. Then
restart (on your own computer) or redeploy (on a hosting service).

### Why the long name, and why the restart?

The Preview button runs in your browser, not on the server. The web app is built
with Next.js, and Next.js only lets a setting reach the browser when its name
starts with `NEXT_PUBLIC_`. It copies the setting's value into the app at the
moment the app starts or is built, which is why a change needs a restart or
redeploy. Because the value ends up in the browser, settings with this prefix
must never hold a secret. This one doesn't: it is just `true` or not.

### Where it does not apply

Only the web app's `/chat` page. It changes nothing in Claude Code, Cursor or
any other coding app. There, `show-it` saves web pages as files in
`.ai/output/visuals/` inside your project, and you open them in your browser.
