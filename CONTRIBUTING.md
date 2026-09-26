# Contributing

Thanks for helping improve the Tech-Lead Stack. This page explains how to report
problems and how a change gets from your machine into `main`.

## Reporting a bug

1. Search
   [existing issues](https://github.com/bronz3beard/ai.tech-lead-stack/issues)
   first. If one matches, add your details there instead of opening a new one.
2. [Open a bug report](https://github.com/bronz3beard/ai.tech-lead-stack/issues/new?template=bug_report.md)
   and fill in every section of the template.
3. Include:
   - the version you are on (release tag, or the commit hash if you run from a
     clone),
   - the exact steps that trigger the problem,
   - what you expected and what happened instead, with any error output,
   - your OS, editor or agent, and the model you used.

Security problems are different: **do not open a public issue.** Follow
[SECURITY.md](SECURITY.md) instead.

For questions, use
[Discussions](https://github.com/bronz3beard/ai.tech-lead-stack/discussions).

## Making a change

### Before you start

For anything larger than a small fix, open an issue or discussion first so we
can agree on the approach before you spend time on it.

You need Node.js 22.5 or later and pnpm (the version is pinned in
`package.json`). Then:

```bash
pnpm install
```

### The workflow

This project uses trunk-based development: short-lived branches off `main`,
merged back through a pull request. The details are in
[BRANCH_MANAGEMENT.md](BRANCH_MANAGEMENT.md).

1. Fork the repository and create a branch from the latest `main`.
2. Keep the change small and focused on one thing.
3. Add or update tests for any behaviour you add or change. New functionality
   without tests will not be merged.
4. Run the checks below and make sure they all pass.
5. Open a pull request against `main` and fill in the
   [pull request template](.github/pull_request_template.md), including the
   output of the checks.
6. CI must pass and the change must be approved by a code owner. Pull requests
   are squash-merged, so your PR title becomes the commit message on `main`.

### Checks to run before opening a pull request

```bash
npm run check-types && npm test && npm run validate:skills
npm run format:check && npm run lint
```

### Coding standards

- TypeScript is strict. Avoid `any`; if you must use it, add a comment
  explaining why.
- Validate external input and API payloads with Zod.
- Formatting is enforced by Prettier, and linting by ESLint and markdownlint.
  The pre-commit hook runs them on the files you change.
- Changes to skill files (`.ai/skills/*.md`) must pass
  `npm run validate:skills`.

## Licence

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
