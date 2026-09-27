#!/usr/bin/env node
/**
 * @file release.mjs
 * @description Checks a release tag before .github/workflows/release.yml
 * publishes it. release-please (.github/workflows/release-please.yml) sets the
 * version in packages/core/package.json, writes the CHANGELOG.md section and
 * creates the tag `v<version>`; this confirms the three agree and prints the
 * notes. See docs/releasing.md.
 * Usage:
 *   node scripts/release.mjs verify <tag>
 *   node scripts/release.mjs notes <tag>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON = path.join(ROOT, 'packages/core/package.json');
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md');

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

/**
 * Returns the notes under `## [version]` in CHANGELOG.md, without the heading.
 * Reads both release-please's heading (`## [1.1.0](compare-url) (date)`) and
 * the older hand-written one (`## [1.0.3] - date`).
 */
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
      `CHANGELOG.md has no notes for ${version}. release-please writes them in its release pull request; release from that.`
    );
  }
  return body;
}

const readPackage = () => JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));

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

const COMMANDS = { verify, notes };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, arg] = process.argv.slice(2);
  const run = COMMANDS[command];
  if (!run) {
    console.error('Usage: node scripts/release.mjs <verify <tag>|notes <tag>>');
    process.exit(2);
  }
  try {
    run(arg);
  } catch (err) {
    console.error(`release: ${err.message}`);
    process.exit(1);
  }
}
