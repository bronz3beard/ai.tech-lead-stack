#!/usr/bin/env node
/**
 * @file release.mjs
 * @description Release helper, and the single source of truth for how a
 * version, its git tag and its CHANGELOG.md section relate. The released
 * version lives in packages/core/package.json; a release is the tag
 * `v<version>` on a commit in main. Used locally (prepare, tag) and by
 * .github/workflows/release.yml (verify, notes). See docs/releasing.md.
 * Usage:
 *   node scripts/release.mjs prepare <patch|minor|major|x.y.z[-pre]>
 *   node scripts/release.mjs tag
 *   node scripts/release.mjs verify <tag>
 *   node scripts/release.mjs notes <tag>
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON = path.join(ROOT, 'packages/core/package.json');
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md');
const RELEASE_BRANCH = 'main';

// SemVer 2.0.0 without build metadata; numeric parts have no leading zeros.
const VERSION_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

/** Parses a release tag (`v1.2.3` or `v1.2.3-rc.1`). Throws on anything else. */
export function parseTag(tag) {
  const version =
    typeof tag === 'string' && tag.startsWith('v') ? tag.slice(1) : '';
  const match = VERSION_RE.exec(version);
  if (!match) {
    throw new Error(
      `"${tag}" is not a release tag. Expected v<major>.<minor>.<patch>, e.g. v1.2.3 or v1.2.3-rc.1.`
    );
  }
  return { version, prerelease: match[4] !== undefined };
}

/** Returns the next version. `level` is patch, minor, major, or an exact version. */
export function nextVersion(current, level) {
  if (VERSION_RE.test(level ?? '')) return level;
  const match = VERSION_RE.exec(current);
  if (!match) throw new Error(`Current version "${current}" is not semver.`);
  if (match[4] !== undefined) {
    throw new Error(
      `Current version ${current} is a prerelease. Pass the exact next version instead of "${level}".`
    );
  }
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  switch (level) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(
        `Unknown release level "${level}". Use patch, minor, major or an exact version.`
      );
  }
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Line range of a `## [heading]` section's body: after the heading, up to the next section or link reference. */
function sectionBounds(lines, heading) {
  const headingRe = new RegExp(`^## \\[${escapeRegExp(heading)}\\]`);
  const start = lines.findIndex((line) => headingRe.test(line));
  if (start === -1) return null;
  const end = lines.findIndex(
    (line, i) => i > start && (/^## /.test(line) || /^\[[^\]]+\]: /.test(line))
  );
  return { start, end: end === -1 ? lines.length : end };
}

/** Returns the notes under `## [version]` in CHANGELOG.md, without the heading. */
export function extractChangelogSection(changelog, version) {
  const lines = changelog.split('\n');
  const bounds = sectionBounds(lines, version);
  const body = bounds
    ? lines
        .slice(bounds.start + 1, bounds.end)
        .join('\n')
        .trim()
    : '';
  if (!body) {
    throw new Error(
      `CHANGELOG.md has no notes for ${version}. Add a "## [${version}] - YYYY-MM-DD" section.`
    );
  }
  return body;
}

/** Moves everything under `## [Unreleased]` into a new `## [version] - date` section. */
export function cutChangelogRelease(changelog, { version, date }) {
  const lines = changelog.split('\n');
  if (sectionBounds(lines, version)) {
    throw new Error(`CHANGELOG.md already has a section for ${version}.`);
  }
  const unreleased = sectionBounds(lines, 'Unreleased');
  if (!unreleased) {
    throw new Error('CHANGELOG.md has no "## [Unreleased]" section.');
  }
  const body = lines.slice(unreleased.start + 1, unreleased.end).join('\n');
  if (!body.trim()) {
    throw new Error(
      'Nothing to release: the [Unreleased] section of CHANGELOG.md is empty. ' +
        'Add a line there for each change since the last release ' +
        '(`git log --oneline "$(git describe --tags --abbrev=0)"..HEAD` lists them), then run this again.'
    );
  }
  lines.splice(unreleased.start + 1, 0, '', `## [${version}] - ${date}`);
  return lines.join('\n');
}

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

/** Like `git`, but returns '' instead of throwing when git exits non-zero. */
const gitOrEmpty = (...args) => {
  try {
    return git(...args);
  } catch {
    return '';
  }
};

const readPackage = () => JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));

function prepare(level) {
  const pkg = readPackage();
  const version = nextVersion(pkg.version, level);
  const date = new Date().toISOString().slice(0, 10);
  // Build both results before writing either, so a failure leaves no half-done release.
  const changelog = cutChangelogRelease(fs.readFileSync(CHANGELOG, 'utf8'), {
    version,
    date,
  });
  pkg.version = version;
  fs.writeFileSync(PACKAGE_JSON, `${JSON.stringify(pkg, null, 2)}\n`);
  fs.writeFileSync(CHANGELOG, changelog);
  console.log(
    `Prepared v${version} in packages/core/package.json and CHANGELOG.md.\n` +
      'Next: commit this on a release branch and open a PR. After it merges, run `pnpm release:tag` on main.'
  );
}

function tag() {
  const { version } = readPackage();
  const tagName = `v${version}`;
  parseTag(tagName);

  const failures = [];
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== RELEASE_BRANCH) {
    failures.push(`You are on "${branch}". Switch to ${RELEASE_BRANCH}.`);
  }
  if (git('status', '--porcelain')) {
    failures.push('There are uncommitted changes. Commit or stash them first.');
  }
  git('fetch', '--quiet', '--tags', 'origin', RELEASE_BRANCH);
  if (
    git('rev-parse', 'HEAD') !== git('rev-parse', `origin/${RELEASE_BRANCH}`)
  ) {
    failures.push(
      `Local ${RELEASE_BRANCH} differs from GitHub. Run: git pull --ff-only`
    );
  }
  if (git('tag', '--list', tagName)) {
    failures.push(
      `Tag ${tagName} already exists. Start a new release with: pnpm release:prepare <patch|minor|major>`
    );
  }
  try {
    extractChangelogSection(fs.readFileSync(CHANGELOG, 'utf8'), version);
  } catch (err) {
    failures.push(err.message);
  }
  if (failures.length) {
    throw new Error(`Cannot tag ${tagName}:\n  - ${failures.join('\n  - ')}`);
  }

  const previous = gitOrEmpty(
    'describe',
    '--tags',
    '--abbrev=0',
    '--match',
    'v*'
  );
  const log = git(
    'log',
    '--oneline',
    '--no-decorate',
    previous ? `${previous}..HEAD` : 'HEAD'
  );
  const signed = Boolean(gitOrEmpty('config', '--get', 'user.signingkey'));
  git(
    'tag',
    signed ? '-s' : '-a',
    tagName,
    '-m',
    `Release ${tagName}\n\n${log}`
  );
  console.log(
    `Created ${signed ? 'signed' : 'annotated'} tag ${tagName}. Publish it with:\n` +
      `  git push origin refs/tags/${tagName}`
  );
}

function verify(tagName) {
  const { version, prerelease } = parseTag(tagName);
  const packageVersion = readPackage().version;
  if (version !== packageVersion) {
    throw new Error(
      `Tag ${tagName} does not match packages/core/package.json version ${packageVersion}.`
    );
  }
  // parseTag has validated the tag, so these values cannot inject extra outputs.
  const outputs = `tag=${tagName}\nversion=${version}\nprerelease=${prerelease}\n`;
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, outputs);
  }
  process.stdout.write(outputs);
}

function notes(tagName) {
  const { version } = parseTag(tagName);
  const changelog = fs.readFileSync(CHANGELOG, 'utf8');
  process.stdout.write(`${extractChangelogSection(changelog, version)}\n`);
}

const COMMANDS = { prepare, tag, verify, notes };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, arg] = process.argv.slice(2);
  const run = COMMANDS[command];
  if (!run) {
    console.error(
      'Usage: node scripts/release.mjs <prepare <level>|tag|verify <tag>|notes <tag>>'
    );
    process.exit(2);
  }
  try {
    run(arg);
  } catch (err) {
    console.error(`release: ${err.message}`);
    process.exit(1);
  }
}
