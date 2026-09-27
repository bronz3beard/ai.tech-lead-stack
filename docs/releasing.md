# Releasing

Releases are automated, as in slm-gate. Nobody edits `CHANGELOG.md`, bumps a
version or creates a tag by hand:

1. [release-please](https://github.com/googleapis/release-please) reads the
   commit messages on `main` and keeps a **release pull request** open, titled
   like `chore(main): release 1.1.0`. It holds the next version in
   `packages/core/package.json` and its `CHANGELOG.md` entry, and updates both
   as more work lands.
2. Merging that pull request creates the tag `v1.1.0` and its GitHub Release.
3. The tag starts the [Release workflow](../.github/workflows/release.yml),
   which attaches the build files to that release and stages the npm package
   [`tech-lead-stack`](https://www.npmjs.com/package/tech-lead-stack).
4. The npm version goes live only when you approve it on npm, with 2FA.

The npm package is built from `packages/core`, which is called
`@zenithfoundry/tech-lead-stack` inside this repository. Only the published
package uses the name `tech-lead-stack`
([scripts/stage-npm-package.mjs](../scripts/stage-npm-package.mjs) sets it).

## How commit messages become the changelog

Commit messages follow
[Conventional Commits](https://www.conventionalcommits.org/). The type decides
the version bump and the changelog section
([release-please-config.json](../release-please-config.json)):

| Commit starts with                                | Changelog section | Version bump  |
| ------------------------------------------------- | ----------------- | ------------- |
| `feat:`                                           | Added             | minor (1.1.0) |
| `fix:`                                            | Fixed             | patch (1.0.4) |
| `docs:`, `refactor:`, `perf:`, `revert:`, `deps:` | Changed           | none          |
| `chore:`, `ci:`, `test:`, `build:`, `style:`      | not listed        | none          |
| any type with `!`, or a `BREAKING CHANGE:` footer | noted as breaking | major (2.0.0) |

This repository squash-merges, so a pull request becomes one commit, titled by
the pull request. To list several changes from one pull request, put them in its
description between these lines, one Conventional Commit per line:

```text
BEGIN_COMMIT_OVERRIDE
feat(cli): add init
fix(cleanup): keep a gateway such as slm-gate
END_COMMIT_OVERRIDE
```

release-please reads the merged pull request's description and uses those lines
instead of its title. You can still edit the description after merging, until
the release pull request is merged.

## One-time setup: the release GitHub App

release-please must act as a GitHub App, not the workflow's own token: a tag or
pull request made with that token starts no other workflows, so CI would not run
on the release pull request and the Release workflow would never start.

1. Create an App under your account: **Settings** → **Developer settings** →
   **GitHub Apps** → **New GitHub App**. Name it, for example,
   `tech-lead-stack-release`. Untick **Webhook → Active**. Under **Repository
   permissions**, set **Contents** and **Pull requests** to **Read and write**.
   Choose **Only on this account**, then create it.
2. On the App's page, note the **Client ID**, then **Generate a private key** (a
   `.pem` file downloads).
3. **Install App** → install it on `bronz3beard/ai.tech-lead-stack` only.
4. Give the repository the ID and the key:

   ```bash
   gh variable set RELEASE_APP_CLIENT_ID --repo bronz3beard/ai.tech-lead-stack --body "<Client ID>"
   gh secret set RELEASE_APP_PRIVATE_KEY --repo bronz3beard/ai.tech-lead-stack < ~/Downloads/<app-name>.<date>.private-key.pem
   ```

5. Delete the downloaded `.pem` file.

Until this is done, the **Release Please** workflow fails on every push to
`main`, and nothing is released.

## Making a release

### 1. Merge the release pull request

When the release pull request lists what you want to ship, check its CI and
merge it:

```bash
gh pr list --label "autorelease: pending"          # the release pull request
gh pr checks <number> --watch
gh pr merge <number> --squash
```

To release a version other than the one it proposes, for example a test version,
add `Release-As: 1.2.0-rc.1` as a footer on a commit to `main`
(`git commit --allow-empty -m "chore: release 1.2.0-rc.1" -m "Release-As: 1.2.0-rc.1"`).
A version with a `-` suffix is marked as a pre-release on GitHub and published
to npm under the `next` tag.

### 2. Watch the workflow

Open the **Actions** tab and follow the **Release** run. It:

1. checks the tag is a valid version, matches `packages/core/package.json`,
   points at a commit on `main`, and has changelog notes,
2. runs the full CI checks on the tagged commit,
3. builds a source archive, an SBOM (a list of every dependency, in SPDX format)
   and the npm package, and checks that the package installs and starts,
4. signs all of them with a build-provenance attestation,
5. attaches all of the above to the GitHub Release release-please created, and
6. stages that same package on npm. It is not live yet.

If any check fails before the npm step, nothing is published. Fix the problem on
`main`, then re-run the failed **Release** run from the Actions tab (**Re-run
failed jobs**). If the fix changed code, release the next patch version instead:
merge the fix with a `fix:` commit and release-please opens a new release pull
request.

### 3. Approve the npm release

When the **Stage on npm** job is green, the version is waiting on npm. Approve
it in either place; both ask for your 2FA:

- **On npmjs.com:** open
  [the package](https://www.npmjs.com/package/tech-lead-stack), go to the
  **Staged Packages** tab, review the version, and click **Approve**.
- **In a terminal** (npm 11.15.0 or later, e.g. `npx npm@11.20.0 …`):

  ```bash
  npx npm@11.20.0 stage list tech-lead-stack         # shows the stage-id
  npx npm@11.20.0 stage approve <stage-id>
  ```

Then check it is live: `npm view tech-lead-stack version`.

If you spot a problem before approving, reject it instead
(`npx npm@11.20.0 stage reject <stage-id>`), fix the problem, and release the
next patch version. npm does not accept a version number that is already staged
or published, so never try to reuse one.

## Rehearsing without releasing

Run the **Release** workflow from the Actions tab (**Run workflow**). It
performs every check, builds the assets for the current version and smoke-tests
the npm package, but it creates no release, signs nothing and publishes nothing.

To try the npm package locally:

```bash
pnpm run mcp:build
node scripts/stage-npm-package.mjs
npm pack ./.tmp/npm-package --pack-destination .tmp
node scripts/smoke-npm-package.mjs .tmp/tech-lead-stack-<version>.tgz
```

## Verifying a release

Anyone can confirm that a downloaded asset was built by this repository's
release workflow:

```bash
gh attestation verify tech-lead-stack-1.3.0-source.tar.gz --repo bronz3beard/ai.tech-lead-stack
```

and that an installed npm package came from this repository:

```bash
npm audit signatures
```

## How npm publishing is set up

The Release workflow stages each version on npm with
[trusted publishing](https://docs.npmjs.com/trusted-publishers) and
[staged publishing](https://docs.npmjs.com/staged-publishing/): npm trusts this
repository's `release.yml`, running in the `npm-publish` environment, to _stage_
a version, and only the maintainer can make it live, with 2FA. No npm token
exists anywhere. npm adds a provenance statement to every version staged this
way.

The package's settings on npmjs.com (**Settings** → **Trusted Publisher**) must
stay as:

- publisher: GitHub Actions
- user: `bronz3beard`, repository: `ai.tech-lead-stack`
- workflow: `release.yml`, environment: `npm-publish`
- allowed actions: **only `npm stage publish`**; leave `npm publish` unticked,
  so CI can never make a version live on its own
- publishing access: "Require two-factor authentication and disallow tokens"

npm does not let you edit a connection. To change any of these, delete it and
add a new one with every value above. If you rename the workflow file or the
environment, update the connection first, or the stage step fails with
`403 … OIDC permission denied for this action`.

The `npm-publish` environment on GitHub only lets `v*` tags use it and has no
required reviewers: the approval that matters happens on npm.

**Why v1.0.1 was published by hand.** npm only accepts trusted publishing for a
package that already exists, and it no longer lets a token that skips 2FA
publish. So the first version, 1.0.1, was published from the maintainer's
machine with 2FA, using the exact tarball the Release workflow built and
attested:

```bash
gh release download v1.0.1 -R bronz3beard/ai.tech-lead-stack -p 'tech-lead-stack-1.0.1.tgz'
gh attestation verify tech-lead-stack-1.0.1.tgz -R bronz3beard/ai.tech-lead-stack
npm publish tech-lead-stack-1.0.1.tgz --access public
```

That version has no npm provenance statement, but its GitHub attestation proves
where it was built. Every later version is staged by the workflow and approved
by the maintainer.

v1.0.2 is on GitHub but was never published to npm: its publish step ran before
the switch to staged publishing and was refused. npm goes from 1.0.1 to 1.0.3.
