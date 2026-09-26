# Releasing

A release is a version tag, such as `v1.2.0`, on a commit in `main`. Pushing the
tag starts the [Release workflow](../.github/workflows/release.yml), which
publishes the GitHub Release and the npm package
[`tech-lead-stack`](https://www.npmjs.com/package/tech-lead-stack). You never
create a release or publish to npm by hand.

The npm package is built from `packages/core`, which is called
`@zenithfoundry/tech-lead-stack` inside this repository. Only the published
package uses the name `tech-lead-stack`
([scripts/stage-npm-package.mjs](../scripts/stage-npm-package.mjs) sets it).

The version number lives in `packages/core/package.json`. The release notes come
from `CHANGELOG.md`, so keep its `[Unreleased]` section up to date as changes
land.

## Choosing the version number

Versions follow [Semantic Versioning](https://semver.org/):

| The release contains…                                | Bump    | Example       |
| ---------------------------------------------------- | ------- | ------------- |
| Only bug fixes                                       | `patch` | 1.2.0 → 1.2.1 |
| New features, nothing breaks for existing users      | `minor` | 1.2.0 → 1.3.0 |
| Anything listed under "⚠️ Breaking" in the changelog | `major` | 1.2.0 → 2.0.0 |
| A test version to try before the real release        | exact   | `1.3.0-rc.1`  |

A test version (anything with a `-` suffix) is marked as a pre-release on
GitHub.

## Making a release

### 1. Open a release pull request

```bash
git switch main && git pull --ff-only
git switch -c release/v1.3.0
pnpm release:prepare minor        # or patch, major, or an exact version like 1.3.0-rc.1
```

`release:prepare` updates the version in `packages/core/package.json` and moves
everything under `[Unreleased]` in `CHANGELOG.md` into a new `[1.3.0]` section
with today's date. Read the notes it produced and tidy them if needed: they
become the text of the GitHub Release.

Commit, push, and open a pull request. Merge it once CI passes.

```bash
git add packages/core/package.json CHANGELOG.md
git commit -m "chore(release): v1.3.0"
git push -u origin HEAD
gh pr create --fill
gh pr checks --watch              # waits until every check has finished
```

### 2. Tag the release

```bash
git switch main && git pull --ff-only
pnpm release:tag
git push origin refs/tags/v1.3.0
```

`release:tag` refuses to create the tag unless all of these are true:

- you are on `main`, with no uncommitted changes, and in sync with GitHub,
- the tag does not already exist,
- `CHANGELOG.md` has notes for this version.

The tag's message lists the commits since the previous tag. If you have a git
signing key configured, the tag is signed.

### 3. Watch the workflow

Open the **Actions** tab and follow the **Release** run. It:

1. checks the tag is a valid version, matches `packages/core/package.json`,
   points at a commit on `main`, and has changelog notes,
2. runs the full CI checks on the tagged commit,
3. builds a source archive, an SBOM (a list of every dependency, in SPDX format)
   and the npm package, and checks that the package installs and starts,
4. signs all of them with a build-provenance attestation,
5. creates the GitHub Release with the changelog notes and all of the above
   attached, and
6. waits for you to approve the **npm-publish** step (a yellow "Review
   deployments" button on the run), then publishes that same package to npm.

If any check fails before the npm step, nothing is published. Fix the problem,
then delete the tag and the GitHub Release before tagging again:

```bash
gh release delete v1.3.0 --yes 2>/dev/null; git tag -d v1.3.0 && git push origin :refs/tags/v1.3.0
```

If the package already reached npm, that version number is used up for good: fix
the problem and release the next patch version instead.

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

The Release workflow publishes to npm with
[trusted publishing](https://docs.npmjs.com/trusted-publishers): npm trusts this
repository's `release.yml`, running in the `npm-publish` environment, and no npm
token exists anywhere. npm adds a provenance statement to every version
published this way.

The package's settings on npmjs.com (**Settings** → **Trusted Publisher**) must
stay as:

- publisher: GitHub Actions
- user: `bronz3beard`, repository: `ai.tech-lead-stack`
- workflow: `release.yml`, environment: `npm-publish`
- publishing access: "Require two-factor authentication and disallow tokens"

If you rename the workflow file or the environment, update these settings first,
or the publish step fails.

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
where it was built. Every later version is published by the workflow.
