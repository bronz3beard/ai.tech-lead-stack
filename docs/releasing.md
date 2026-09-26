# Releasing

A release is a version tag, such as `v1.2.0`, on a commit in `main`. Pushing the
tag starts the [Release workflow](../.github/workflows/release.yml), which
publishes the GitHub Release. You never create a release by hand.

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
3. builds a source archive and an SBOM (a list of every dependency, in SPDX
   format),
4. signs them with a build-provenance attestation, and
5. creates the GitHub Release with the changelog notes and all of the above
   attached.

If any check fails, nothing is published. Fix the problem, then delete the tag
locally and on GitHub before tagging again:

```bash
git tag -d v1.3.0 && git push origin :refs/tags/v1.3.0
```

## Rehearsing without releasing

Run the **Release** workflow from the Actions tab (**Run workflow**). It
performs every check and builds the assets for the current version, but it
creates no release and signs nothing.

## Verifying a release

Anyone can confirm that a downloaded asset was built by this repository's
release workflow:

```bash
gh attestation verify tech-lead-stack-1.3.0-source.tar.gz --repo bronz3beard/ai.tech-lead-stack
```

## The first release

For the very first release, the version is already `1.0.0`, so pass it exactly:
`pnpm release:prepare 1.0.0`. Everything else is the same.
