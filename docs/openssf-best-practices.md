# OpenSSF Best Practices badge

This project is registered on the OpenSSF Best Practices site as
[project 14956](https://www.bestpractices.dev/projects/14956). This page gives
the answer and the evidence for every question on its two forms:

- **Passing** — the classic badge:
  <https://www.bestpractices.dev/en/projects/14956/passing>
- **Baseline level 1** — the OpenSSF Baseline (OSPS v2026.08.28), level 1:
  <https://www.bestpractices.dev/en/projects/14956/baseline-1>

Each answer below was checked against the repository. If something changes and
an answer stops being true, change the answer on the site too.

## Before you fill in the forms

1. **Merge the pending pull request and release v1.0.3** (see
   [releasing.md](releasing.md)). Several answers link to the releases page.
2. **Dismiss the one open CodeQL alert.** It flags the `no-verify` TLS mode in
   `packages/core/src/lib/prisma.ts`, which is a deliberate opt-in
   (`DATABASE_SSL_MODE=no-verify`, off by default, logged as a warning). On
   GitHub: **Security** → **Code scanning** → the "Disabling certificate
   validation" alert → **Dismiss alert** → **Won't fix**, with the comment:
   _"Only reachable when an operator explicitly sets
   DATABASE_SSL_MODE=no-verify; the default is verify-full and the mode logs a
   warning."_
3. **Answer the two "secure development knowledge" questions for yourself.**
   They ask whether you personally know secure design and common vulnerability
   types. Only mark them Met if that is true.

## How the forms work

- Every question has **Met**, **Unmet**, **N/A** (not always offered) and **?**
  (unanswered). Pick one, then paste the text from the "Paste this" column into
  the box under it. Some questions require a URL in that box.
- The form is split into tabs. Click **Save and continue** at the bottom of each
  tab; nothing is saved until you do.
- The site fills in some answers automatically from GitHub. If an automatic
  answer matches the table, leave it.
- For the passing badge, every **MUST** needs Met or N/A. A **SUGGESTED**
  question may stay Unmet without losing the badge.

`R` below stands for `https://github.com/bronz3beard/ai.tech-lead-stack`.
Replace it with the full address when you paste.

## Passing form

### Basics tab

| Question                    | Answer | Paste this                                                                                                                                                                                                         |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `description_good`          | Met    | `R#readme` — the first paragraph says what the stack does.                                                                                                                                                         |
| `interact`                  | Met    | `R/blob/main/SUPPORT.md` — how to get it, report bugs, suggest features and contribute.                                                                                                                            |
| `contribution`              | Met    | `R/blob/main/CONTRIBUTING.md`                                                                                                                                                                                      |
| `contribution_requirements` | Met    | `R/blob/main/CONTRIBUTING.md#coding-standards`                                                                                                                                                                     |
| `floss_license`             | Met    | Released under the MIT License.                                                                                                                                                                                    |
| `floss_license_osi`         | Met    | MIT is approved by the Open Source Initiative.                                                                                                                                                                     |
| `license_location`          | Met    | `R/blob/main/LICENSE`                                                                                                                                                                                              |
| `documentation_basics`      | Met    | `R#documentation` — setup, configuration and usage guides in `docs/`.                                                                                                                                              |
| `documentation_interface`   | Met    | The npm package is an MCP server. Each of its tools publishes its purpose and its inputs as JSON Schema through MCP's `tools/list`, which MCP clients display. Usage: `R/blob/main/docs/running-the-mcp-server.md` |
| `sites_https`               | Met    | GitHub, npm and the web app are served only over HTTPS.                                                                                                                                                            |
| `discussion`                | Met    | GitHub Discussions (`R/discussions`) and Issues (`R/issues`): searchable, linkable, open to anyone, no proprietary client.                                                                                         |
| `english`                   | Met    | All documentation is in English, and reports are accepted in English.                                                                                                                                              |
| `maintained`                | Met    | Actively maintained: see `R/commits/main` and `R/releases`.                                                                                                                                                        |

### Change Control tab

| Question              | Answer | Paste this                                                                                                                                                  |
| --------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repo_public`         | Met    | `R`                                                                                                                                                         |
| `repo_track`          | Met    | Git records every change, its author and its date.                                                                                                          |
| `repo_interim`        | Met    | Changes land on `main` through pull requests between releases: `R/pulls?q=is%3Apr+is%3Amerged`                                                              |
| `repo_distributed`    | Met    | Git.                                                                                                                                                        |
| `version_unique`      | Met    | Every release has its own Semantic Versioning number, recorded as a git tag: `R/releases`                                                                   |
| `version_semver`      | Met    | Semantic Versioning, e.g. v1.0.3. See `R/blob/main/docs/releasing.md`                                                                                       |
| `version_tags`        | Met    | Every release is an annotated git tag: `R/tags`                                                                                                             |
| `release_notes`       | Met    | `R/releases` — each release's notes are its hand-written `CHANGELOG.md` section, never the git log.                                                         |
| `release_notes_vulns` | N/A    | No publicly known vulnerability has been found in the project's own code. SECURITY.md commits to listing any fixed vulnerability by its CVE or advisory ID. |

### Reporting tab

| Question                        | Answer | Paste this                                                                                                        |
| ------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| `report_process`                | Met    | `R/blob/main/CONTRIBUTING.md#reporting-a-bug`                                                                     |
| `report_tracker`                | Met    | GitHub Issues: `R/issues`                                                                                         |
| `report_responses`              | Met    | No bug reports from other people in the last 12 months. Every issue filed has been triaged in GitHub Issues.      |
| `enhancement_responses`         | Met    | No enhancement requests from other people in the last 12 months. Every issue filed has been triaged.              |
| `report_archive`                | Met    | `R/issues?q=is%3Aissue` — all reports and replies stay public and searchable.                                     |
| `vulnerability_report_process`  | Met    | `R/blob/main/SECURITY.md`                                                                                         |
| `vulnerability_report_private`  | Met    | `R/security/advisories/new` — GitHub private vulnerability reporting, described in SECURITY.md.                   |
| `vulnerability_report_response` | N/A    | No vulnerability reports were received in the last 6 months. SECURITY.md commits to acknowledging within 14 days. |

### Quality tab

| Question                      | Answer | Paste this                                                                                                                                                |
| ----------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`                       | Met    | `pnpm install && pnpm run build` rebuilds everything from source; CI does this on every pull request: `R/actions/workflows/ci.yml`                        |
| `build_common_tools`          | Met    | pnpm, TypeScript, esbuild and Next.js.                                                                                                                    |
| `build_floss_tools`           | Met    | Every build tool is open source.                                                                                                                          |
| `test`                        | Met    | Jest and `node:test` suites, run with `npm test` and `npm run test:scripts` (listed in `R/blob/main/CONTRIBUTING.md`) and on every pull request by CI.    |
| `test_invocation`             | Met    | `npm test`.                                                                                                                                               |
| `test_most`                   | Unmet  | Test coverage is not measured yet.                                                                                                                        |
| `test_continuous_integration` | Met    | CI runs every test on every pull request and every push to `main`: `R/actions/workflows/ci.yml`                                                           |
| `test_policy`                 | Met    | `R/blob/main/CONTRIBUTING.md#the-workflow` — "New functionality without tests will not be merged."                                                        |
| `tests_are_added`             | Met    | Recent features shipped with tests: `R/pull/116` (release script tests) and `R/pull/117` (npm package tests and an install-and-start smoke test).         |
| `tests_documented_added`      | Met    | `R/blob/main/CONTRIBUTING.md#the-workflow`                                                                                                                |
| `warnings`                    | Met    | TypeScript strict mode, ESLint, markdownlint and Prettier, all run in CI.                                                                                 |
| `warnings_fixed`              | Met    | Lint reports 0 errors. The 215 remaining ESLint warnings (mostly `no-explicit-any`) are fewer than 1 per 100 lines across 27,000 lines of dashboard code. |
| `warnings_strict`             | Met    | TypeScript runs in strict mode in every package.                                                                                                          |

### Security tab

| Question                         | Answer | Paste this                                                                                                                                                                                                |
| -------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `know_secure_design`             | Met\*  | The maintainer applies secure-design principles: secure defaults (TLS verify-full, stage-only npm publishing), least privilege in CI, input validation with Zod.                                          |
| `know_common_errors`             | Met\*  | The maintainer knows the OWASP Top 10 and counters them: parameterised queries (Prisma), Zod validation, CodeQL, secret scanning, dependency updates.                                                     |
| `crypto_published`               | Met    | Only published algorithms: AES-256-GCM (Node.js `crypto`), bcrypt, and TLS.                                                                                                                               |
| `crypto_call`                    | Met    | Cryptography comes from Node.js `crypto` and `bcryptjs`; nothing is implemented in-house.                                                                                                                 |
| `crypto_floss`                   | Met    | Node.js, OpenSSL and bcryptjs are open source.                                                                                                                                                            |
| `crypto_keylength`               | Met    | Encryption uses 256-bit AES keys, and any other key length is rejected at startup.                                                                                                                        |
| `crypto_working`                 | Met    | No MD4, MD5, DES or RC4. AES-GCM uses a fresh random 96-bit IV for each encryption.                                                                                                                       |
| `crypto_weaknesses`              | Met    | No SHA-1 or CBC mode in any security mechanism.                                                                                                                                                           |
| `crypto_pfs`                     | Met    | TLS connections use Node.js/OpenSSL defaults, which negotiate ECDHE key exchange (perfect forward secrecy).                                                                                               |
| `crypto_password_storage`        | Met    | Dashboard passwords are stored as bcrypt hashes with a per-user salt.                                                                                                                                     |
| `crypto_random`                  | Met    | Keys and IVs come from `crypto.randomBytes`. `Math.random` is only used for non-security IDs and retry jitter.                                                                                            |
| `delivery_mitm`                  | Met    | Delivered only over HTTPS (GitHub, npm). Releases carry signed build-provenance attestations, and npm versions carry provenance statements.                                                               |
| `delivery_unsigned`              | Met    | No hash is ever fetched over HTTP.                                                                                                                                                                        |
| `vulnerabilities_fixed_60_days`  | Met    | No medium-or-higher vulnerability has been public for more than 60 days unpatched. Dependabot alerts and security updates are on, and `npm audit` reports 0 vulnerabilities in the published npm package. |
| `vulnerabilities_critical_fixed` | Met    | Dependabot security updates open fix pull requests automatically; critical fixes are released as a patch version.                                                                                         |
| `no_leaked_credentials`          | Met    | GitHub secret scanning and push protection are on, with no alerts. `.env` files are ignored by git.                                                                                                       |

\* Only if true for you — see "Before you fill in the forms".

### Analysis tab

| Question                                 | Answer | Paste this                                                                                                                                      |
| ---------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `static_analysis`                        | Met    | CodeQL (JavaScript/TypeScript and GitHub Actions) runs on every pull request, every push to `main` and weekly: `R/actions/workflows/codeql.yml` |
| `static_analysis_common_vulnerabilities` | Met    | CodeQL's security queries look for common vulnerabilities (injection, XSS, insecure TLS, and more).                                             |
| `static_analysis_fixed`                  | Met    | Confirmed CodeQL findings are fixed; the only open one was reviewed and dismissed as a deliberate, off-by-default opt-in.                       |
| `static_analysis_often`                  | Met    | On every pull request and every push to `main`.                                                                                                 |
| `dynamic_analysis`                       | Unmet  | No dynamic analysis tool is used yet.                                                                                                           |
| `dynamic_analysis_unsafe`                | N/A    | Written in TypeScript/JavaScript, which is memory-safe.                                                                                         |
| `dynamic_analysis_enable_assertions`     | Unmet  | No dynamic analysis tool is used yet.                                                                                                           |
| `dynamic_analysis_fixed`                 | N/A    | No dynamic analysis tool is used.                                                                                                               |

## Baseline level 1 form

| Question        | Answer | Paste this                                                                                                                                                                   |
| --------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OSPS-AC-01.01` | Met    | GitHub requires two-factor authentication for all contributors; the site usually fills this in.                                                                              |
| `OSPS-AC-02.01` | Met    | Personal repository: collaborators are only added by the owner's explicit invitation, one at a time.                                                                         |
| `OSPS-AC-03.01` | Met    | A ruleset on `main` blocks direct pushes; changes land only through pull requests: `R/rules/14183873`                                                                        |
| `OSPS-AC-03.02` | Met    | The same ruleset blocks deleting `main` and force-pushing to it.                                                                                                             |
| `OSPS-BR-01.01` | Met    | Workflows never paste untrusted text into scripts: the release tag is read from the environment and rejected unless it is strict SemVer (`R/blob/main/scripts/release.mjs`). |
| `OSPS-BR-01.03` | Met    | Pull request CI uses `pull_request`, never `pull_request_target`, so code from forks gets no secrets. Publishing runs only for `v*` tags in a protected environment.         |
| `OSPS-BR-03.01` | Met    | Every official channel (GitHub, npm, the web app) is HTTPS only.                                                                                                             |
| `OSPS-BR-03.02` | Met    | Distributed over HTTPS through GitHub Releases and npm, with signed build-provenance attestations and npm provenance.                                                        |
| `OSPS-BR-07.01` | Met    | Secret scanning and push protection are on, and `.env` files are ignored by git.                                                                                             |
| `OSPS-DO-01.01` | Met    | `R#documentation`                                                                                                                                                            |
| `OSPS-DO-02.01` | Met    | `R/blob/main/CONTRIBUTING.md#reporting-a-bug`                                                                                                                                |
| `OSPS-GV-02.01` | Met    | GitHub Discussions and Issues: `R/discussions`                                                                                                                               |
| `OSPS-GV-03.01` | Met    | `R/blob/main/CONTRIBUTING.md`                                                                                                                                                |
| `OSPS-LE-02.01` | Met    | MIT License, approved by the OSI.                                                                                                                                            |
| `OSPS-LE-02.02` | Met    | Released assets are MIT licensed too.                                                                                                                                        |
| `OSPS-LE-03.01` | Met    | `R/blob/main/LICENSE`                                                                                                                                                        |
| `OSPS-LE-03.02` | Met    | The LICENSE file is inside the npm package and the source archive attached to every release: `R/releases`                                                                    |
| `OSPS-QA-01.01` | Met    | `R`                                                                                                                                                                          |
| `OSPS-QA-01.02` | Met    | Public git history records every change, its author and its date: `R/commits/main`                                                                                           |
| `OSPS-QA-02.01` | Met    | `package.json` files and `pnpm-lock.yaml` list every direct dependency.                                                                                                      |
| `OSPS-QA-04.01` | Met    | `R#peripherals--sibling-apps`                                                                                                                                                |
| `OSPS-QA-05.01` | Met    | No build output or executables are committed; release files are built by CI.                                                                                                 |
| `OSPS-QA-05.02` | Met    | The only binary files committed are a few PNG screenshots and a favicon, which can be reviewed visually.                                                                     |
| `OSPS-VM-02.01` | Met    | `R/blob/main/SECURITY.md`                                                                                                                                                    |

## Keeping the badge

These answers stay true only while the following stay true. Check them before
each yearly review of the forms:

- Dependabot security alerts are fixed within 60 days. `deepmerge-ts` (used only
  by Prisma's command-line config loader) has an alert published on 17 August
  2026, so it must be fixed by 16 October 2026.
- Vulnerability reports are acknowledged within 14 days (SECURITY.md).
- The `main` ruleset, secret scanning, push protection and CodeQL stay on.
- Every release has hand-written notes in `CHANGELOG.md`, listing fixed
  vulnerabilities by CVE or advisory ID.
- New features come with tests.
