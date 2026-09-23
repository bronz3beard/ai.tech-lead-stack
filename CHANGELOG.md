# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### ⚠️ Breaking — Langfuse credentials are renamed

The stack now reads its Langfuse credentials from `TLS_`-prefixed variables
only:

| Before                | After                     |
| --------------------- | ------------------------- |
| `LANGFUSE_PUBLIC_KEY` | `TLS_LANGFUSE_PUBLIC_KEY` |
| `LANGFUSE_SECRET_KEY` | `TLS_LANGFUSE_SECRET_KEY` |
| `LANGFUSE_BASE_URL`   | `TLS_LANGFUSE_BASE_URL`   |

This applies to the MCP server, the dashboard (including its Vercel deployment)
and `scripts/migrate-analytics.ts`.

**Why.** When a gateway such as slm-gate spawns this stack, it passes its own
environment down, and dotenv never overrides a variable that is already set.
With the generic names, the stack picked up the gateway's keys and wrote every
skill run into the gateway's Langfuse project, next to the gateway's own trace
for the same run. That doubled the gateway project's trace count and diluted
every average with records that had no scores or session.

**What happens if you do not rename.** Runs are still recorded in Postgres and
shown on the dashboard, but nothing is sent to Langfuse, and the dashboard's
Langfuse sync is skipped. The old names are deliberately not read as a fallback,
because that fallback is exactly how the gateway's keys leaked in.

**To migrate:**

1. Rename the three variables in `.env` (see `.env.example`).
2. Rename them in every deployment environment, e.g. Vercel → Project → Settings
   → Environment Variables, then redeploy.
3. Rebuild the MCP server (`npm run mcp:build`) and restart every MCP client, or
   the gateway that spawns the stack.

A gateway's own `LANGFUSE_*` variables are unaffected. It keeps writing to its
own project.

### Changed

- Every trace and generation the stack sends to Langfuse now carries environment
  `tls` and the tag `source:tls`, so a project shared with another emitter can
  tell the records apart. Trace names are unchanged (`skill:<name>`).
- Each dashboard card and chart now states its data source and window, e.g.
  `Source: TLS store · Latest 1,000 runs`. Every card reads the stack's Postgres
  store, not Langfuse, so its numbers are not comparable with Langfuse's. The
  default view is labelled as the latest 1,000 runs, which is what it loads; the
  Activity Timeline previously called this "entire history".
- The dashboard footer no longer names Langfuse as the data provider.

### Fixed

- The dashboard's date-range picker now filters results. `from` and `to` are
  whole UTC days, `to` inclusive, and an explicit range takes precedence over a
  `timeframe` preset. Previously the server ignored both values.
