# Changelog

All notable changes to this project are recorded here. From 1.1.0 on,
release-please writes each entry from the commit messages on `main` (see
[docs/releasing.md](docs/releasing.md)); nobody edits this file by hand.

## [2.2.0](https://github.com/bronz3beard/ai.tech-lead-stack/compare/v2.1.0...v2.2.0) (2026-10-10)


### Added

* **install:** keep /tls: commands and editor files current automatically at MCP server start ([a05d44a](https://github.com/bronz3beard/ai.tech-lead-stack/commit/a05d44af8789cf2e1c8998f6a59c6e1e6b08bd1e))


### Fixed

* **doctor:** point init, doctor and uninstall commands at [@latest](https://github.com/latest) instead of [@1](https://github.com/1) ([a05d44a](https://github.com/bronz3beard/ai.tech-lead-stack/commit/a05d44af8789cf2e1c8998f6a59c6e1e6b08bd1e))
* **mcp-server:** advertise the real package version instead of a hard-coded 2.0.0 ([a05d44a](https://github.com/bronz3beard/ai.tech-lead-stack/commit/a05d44af8789cf2e1c8998f6a59c6e1e6b08bd1e))

## [2.1.0](https://github.com/bronz3beard/ai.tech-lead-stack/compare/v2.0.0...v2.1.0) (2026-10-08)


### Added

* add no-AI analyse skill ([1870010](https://github.com/bronz3beard/ai.tech-lead-stack/commit/1870010f6f9fefaae0da2b30ba69fa5f332f22dc))

## [2.0.0](https://github.com/bronz3beard/ai.tech-lead-stack/compare/v1.2.2...v2.0.0) (2026-10-08)


### ⚠ BREAKING CHANGES

* **telemetry:** the Langfuse integration is removed. TLS_LANGFUSE_PUBLIC_KEY, TLS_LANGFUSE_SECRET_KEY and TLS_LANGFUSE_BASE_URL are no longer read, traces are no longer sent to Langfuse, and GET /api/admin/sync is gone. telemetryService.recordEvent now requires a `kind`.

### Added

* **telemetry:** honest AI-usage metrics with Postgres as the single source of truth ([#148](https://github.com/bronz3beard/ai.tech-lead-stack/issues/148)) ([2d7bcfe](https://github.com/bronz3beard/ai.tech-lead-stack/commit/2d7bcfeec0184512090f243460acfe8a95573567))

## [1.2.2](https://github.com/bronz3beard/ai.tech-lead-stack/compare/v1.2.1...v1.2.2) (2026-10-05)


### Fixed

* **deps:** update dotenv 18, lucide-react 1.x and pending Dependabot bumps ([#146](https://github.com/bronz3beard/ai.tech-lead-stack/issues/146)) ([2a7a180](https://github.com/bronz3beard/ai.tech-lead-stack/commit/2a7a180a81ecbe8b86256afeef1535ede193acef))

## [1.2.1](https://github.com/bronz3beard/ai.tech-lead-stack/compare/v1.2.0...v1.2.1) (2026-10-05)


### Fixed

* **ai:** replace retired and invalid model ids and repair eval calibration ([#136](https://github.com/bronz3beard/ai.tech-lead-stack/issues/136)) ([d97b5cc](https://github.com/bronz3beard/ai.tech-lead-stack/commit/d97b5cc6fe291b93d9b69b34269315333a40cbcd))
* **deps:** upgrade to AI SDK v7 and current Claude/OpenAI models ([#138](https://github.com/bronz3beard/ai.tech-lead-stack/issues/138)) ([e35419f](https://github.com/bronz3beard/ai.tech-lead-stack/commit/e35419f645fc0c1aa6563bf763f3eacb2195a959))

## [1.2.0](https://github.com/bronz3beard/ai.tech-lead-stack/compare/v1.1.1...v1.2.0) (2026-10-03)


### Added

* **chat:** sandboxed static-HTML preview behind NEXT_PUBLIC_CHAT_HTML_PREVIEW ([4add021](https://github.com/bronz3beard/ai.tech-lead-stack/commit/4add021e7098bf71cef26093fbf115c9a2445985))
* **dashboard:** expose show-it in web chat for all roles ([4add021](https://github.com/bronz3beard/ai.tech-lead-stack/commit/4add021e7098bf71cef26093fbf115c9a2445985))
* **skills:** add show-it visual explainer skill ([4add021](https://github.com/bronz3beard/ai.tech-lead-stack/commit/4add021e7098bf71cef26093fbf115c9a2445985))
* **skills:** add show-it-deep interactive diagrams via archify, with an install guard ([4add021](https://github.com/bronz3beard/ai.tech-lead-stack/commit/4add021e7098bf71cef26093fbf115c9a2445985))


### Changed

* visual explanations guide, preview flag docs, and AI setup prompt facts ([4add021](https://github.com/bronz3beard/ai.tech-lead-stack/commit/4add021e7098bf71cef26093fbf115c9a2445985))

## [1.1.1](https://github.com/bronz3beard/ai.tech-lead-stack/compare/v1.1.0...v1.1.1) (2026-10-03)


### Fixed

* **mcp:** append the [GRAPH] footer in get_skill by matching graph nodes on name ([ad203ea](https://github.com/bronz3beard/ai.tech-lead-stack/commit/ad203ea53cdaf2ca133676d5851d80c990377e5f))
* **mcp:** print skill names in plan_pipeline instead of undefined ([ad203ea](https://github.com/bronz3beard/ai.tech-lead-stack/commit/ad203ea53cdaf2ca133676d5851d80c990377e5f))
* **skills:** set planning-expert minModelClass to large per ADR 0003 ([ad203ea](https://github.com/bronz3beard/ai.tech-lead-stack/commit/ad203ea53cdaf2ca133676d5851d80c990377e5f))
* **web:** inject frontmatter policies into /chat get_skill results ([ad203ea](https://github.com/bronz3beard/ai.tech-lead-stack/commit/ad203ea53cdaf2ca133676d5851d80c990377e5f))


### Changed

* **skills:** drop the originalRows step from skill-readiness ([ad203ea](https://github.com/bronz3beard/ai.tech-lead-stack/commit/ad203ea53cdaf2ca133676d5851d80c990377e5f))

## [1.1.0](https://github.com/bronz3beard/ai.tech-lead-stack/compare/v1.0.3...v1.1.0) (2026-09-27)


### Added

* **cli:** `doctor` checks Node.js, the settings file, which features are on, the usage-metrics database, how each editor reaches the toolbox and RTK, with `--json` for AI assistants ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))
* **cli:** `init` installs Claude Code's /tls:* commands, Cursor skills, Continue prompts, the project's workflow files and RTK (a pinned, hash-checked release), and creates the settings file ~/.tech-lead-stack/.env ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))
* **cli:** `npx -y tech-lead-stack@1 init` connects the toolbox to every editor on the computer (Claude Code, Claude Desktop, Cursor, Continue, Cline, Gemini), putting it behind a gateway such as slm-gate when one is present, and never replaces an existing connection ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))
* **cli:** `uninstall` removes what init added and keeps the settings file, RTK, clone setups and any file you edited ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))
* **config:** one settings file, ~/.tech-lead-stack/.env, is read by every editor's MCP server ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))
* **docs:** AI setup prompt (docs/agent-setup.md) that checks your computer, interviews you, sets everything up and answers questions, checked in CI against the code ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))
* **telemetry:** the npm package records usage metrics when DATABASE_URL is set, in the same database the web app's dashboard reads ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))
* **web-app:** run the web app on your own machine with `pnpm db:migrate` and `pnpm web:dev`, reading the repository's root .env ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))


### Fixed

* **cleanup:** `cleanup.sh --global` keeps a gateway such as slm-gate and removes only its link to the checkout, instead of deleting the gateway ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))
* **continue:** the Continue MCP entry is written as the list Continue reads; entries older installs wrote as a map are converted ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))
* **docs:** the README's slm-gate link ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))
* **telemetry:** the MCP server never reads the .env of the project it is started in, and never connects to a database unless DATABASE_URL is set ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))
* **web-app:** the web app and database tools read the repository's root .env, and the example DATABASE_URL matches docker-compose.yml ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))


### Changed

* .env.example lists every setting the code reads; the tiers guide covers all four tiers; the repository URL is github.com/bronz3beard/ai.tech-lead-stack everywhere ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))
* guide for moving from a downloaded folder to npm, with an optional step to keep your old settings (docs/switch-to-npm.md) ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))
* **install:** install.sh and init share the slash-command generator, the editor list, the Continue config writer and the RTK pin ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))
* **release:** releases are automated with release-please; `pnpm release:prepare` and `pnpm release:tag` are gone ([bfa0928](https://github.com/bronz3beard/ai.tech-lead-stack/commit/bfa0928d460cfa946b9d12ba19d9149d48587faf))

## [1.0.3] - 2026-09-26

### Changed

- New npm versions are now staged by the Release workflow and go live only when
  the maintainer approves them on npm with 2FA (npm staged publishing). CI can
  no longer make a version live on its own. See `docs/releasing.md`.

### Fixed

- 1.0.2 was released on GitHub but never reached npm, because npm refused the
  direct publish. This release delivers the same changes to npm.

### Security

- The dashboard's diagram parser now gets `lodash-es` 4.18.1 instead of 4.17.23,
  fixing GHSA-r5fr-rjxr-66jc (high) and GHSA-f23m-r3pf-42rh (medium). The npm
  package was not affected.

## [1.0.2] - 2026-09-26

### Changed

- The npm package is now published only by the Release workflow, through npm
  trusted publishing. No npm token exists, and every version carries an npm
  provenance statement linking it to the GitHub Actions run that built it.
  (#120)
- Dependency updates: Prisma 7.10, pg 8.23, zod 4.6 and 27 other minor and patch
  updates (#119); mermaid 12 for the dashboard's diagrams (#111); lint-staged 17
  and @testing-library/jest-dom 7 for development (#110, #108); playwright 1.63
  and python-dotenv 1.2.3 for the optional Python tooling (#103, #104).

### Security

- requests 2.34.2 for the optional Python tooling, which includes the fixes for
  CVE-2024-35195 and CVE-2024-47081. (#105)

## [1.0.1] - 2026-09-26

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

### Added

- Versioned releases. Pushing a version tag publishes a GitHub Release with
  these notes, a source archive, an SBOM and a signed build-provenance
  attestation. See `docs/releasing.md`.
- The MCP server is published to npm as `tech-lead-stack`, with the skills and
  workflows bundled, so an MCP client can run it with `npx -y tech-lead-stack`
  without cloning this repository. It runs without a database.
- `SUPPORT.md`, a rewritten `CONTRIBUTING.md` (including how to report a bug),
  and a fuller `SECURITY.md` describing what happens after a vulnerability
  report.

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
