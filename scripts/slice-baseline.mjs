#!/usr/bin/env node
/**
 * @file slice-baseline.mjs
 * @description Sizing baseline for vertical-slice-decomposer and
 * planning-expert, taken from this repository's own merged history: working
 * days from first commit to merge, changed files, and how much work each
 * developer had open at once.
 *
 * Source: merged pull requests through the GitHub CLI (`gh`, signed in) first;
 * git merge commits as the fallback. A squash-merged repository without GitHub
 * access has no usable history.
 *
 * Read-only: it writes nothing. The report goes to stdout as markdown tables;
 * logs go to stderr. Every way of not having data (no git, not a repository,
 * no GitHub, too few changes) prints NO_BASELINE and exits 0, so a skill falls
 * back to its default rules instead of treating it as a failure.
 *
 * Usage:
 *   node scripts/slice-baseline.mjs [--window-days <n>] [--repo-dir <path>]
 *     [--no-github] [--now <iso>]
 *
 * Exit codes: 0 ok, with or without a baseline · 2 usage.
 */

import { execFileSync } from 'child_process';
import path from 'path';
import { pathToFileURL } from 'url';
import {
  MIN_SAMPLE,
  ghSearchAll,
  githubAvailability,
  percentile,
} from './ai-impact-baseline.mjs';

export const EXIT_USAGE = 2;
export const NO_BASELINE =
  'No history baseline (too few merged changes, no git history, or a squash-merged repo without GitHub access). Use the default rules: <=2 working days, <=24 files, at most 3 open per developer.';
export const TARGET_FILES = 24;
export const CEILING_FILES = 45;
export const OPEN_LIMIT = 3;
const DEFAULT_WINDOW_DAYS = 180;
const SEARCH_CAP = 1000; // GitHub search returns at most 1000 results.
const DAY_MS = 24 * 60 * 60 * 1000;
const SAMPLE_HOUR_UTC = 14;

const log = (...args) => process.stderr.write(args.join(' ') + '\n');

// --- Pure helpers --------------------------------------------------------------

const LEADING_TICKET = /^(?:\[[^\]]*\]|[a-z]+-\d[a-z0-9]*)\s*[:|-]?\s*/;
const CHANGE_TYPE = /^\[?(feat|feature|fix|refactor|chore|docs|test)\b/;

/**
 * Change type from a PR title: `feat: x`, `[Feature] x`, or the same after a
 * leading ticket id such as `[CU-86c0abc]` or `ABC-123:`.
 */
export function typeOf(title) {
  const t = (title ?? '').toLowerCase().trim();
  if (t.includes('hotfix')) return 'hotfix';
  const type =
    CHANGE_TYPE.exec(t)?.[1] ??
    CHANGE_TYPE.exec(t.replace(LEADING_TICKET, ''))?.[1];
  if (!type) return 'other';
  return type === 'feature' ? 'feat' : type;
}

/** Monday–Friday days between two timestamps (ms, UTC), fractional. */
export function workingDays(from, to) {
  let days = 0;
  for (let t = from; t < to;) {
    const next = Math.min(to, (Math.floor(t / DAY_MS) + 1) * DAY_MS);
    const weekday = new Date(t).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += (next - t) / DAY_MS;
    t = next;
  }
  return days;
}

/**
 * Release work, by branch or PR title: `v23.0.0`, `V24.0.0 -> Main`,
 * `release/x`, `release-please--…`.
 */
export const isRelease = (name) => /^(v\d+\.\d+|release[-/])/i.test(name ?? '');

/**
 * Changes open (first commit done, not merged) at 14:00 UTC on each weekday in
 * the window, counting only the days that had something open.
 */
export function openAtOnce(rows, { since, now }) {
  const counts = [];
  const first = Math.floor(since / DAY_MS) * DAY_MS + SAMPLE_HOUR_UTC * 36e5;
  for (let t = first; t < now; t += DAY_MS) {
    const weekday = new Date(t).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const count = rows.filter((r) => r.start <= t && r.end > t).length;
    if (count) counts.push(count);
  }
  return counts;
}

const share = (rows, test) =>
  Math.round((100 * rows.filter(test).length) / rows.length);

function typeRow(type, rows) {
  const days = rows.map((r) => r.days);
  const files = rows.map((r) => r.files);
  return {
    type,
    count: rows.length,
    daysTypical: percentile(days, 0.5),
    daysSlowEnd: percentile(days, 0.85),
    withinTwoDaysPct: share(rows, (r) => r.days <= 2),
    filesTypical: percentile(files, 0.5),
    filesHigh: percentile(files, 0.85),
    overTargetPct: share(rows, (r) => r.files > TARGET_FILES),
    overCeilingPct: share(rows, (r) => r.files > CEILING_FILES),
  };
}

/** Report data, or null when there are fewer than MIN_SAMPLE changes. */
export function buildReport({ items, since, now, source, windowDays }) {
  const rows = items
    .filter((r) => r.end >= since && r.end <= now)
    .map((r) => ({ ...r, days: workingDays(r.start, r.end) }));
  if (rows.length < MIN_SAMPLE) return null;
  const types = Object.entries(Object.groupBy(rows, (r) => r.type))
    .filter(([, group]) => group.length >= MIN_SAMPLE)
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([type, group]) => typeRow(type, group));
  const developers = Object.entries(Object.groupBy(rows, (r) => r.dev))
    .map(([dev, group]) => ({ dev, open: openAtOnce(group, { since, now }) }))
    .filter(({ open }) => open.length >= MIN_SAMPLE)
    .map(({ dev, open }) => ({
      dev,
      openTypical: percentile(open, 0.5),
      openMax: Math.max(...open),
      overLimitPct: share(open, (c) => c > OPEN_LIMIT),
    }));
  return {
    source,
    windowDays,
    count: rows.length,
    types: [typeRow('all', rows), ...types],
    developers,
  };
}

export function renderMarkdown(report) {
  const lines = [
    `Source: ${report.source} · last ${report.windowDays} days · ${report.count} changes`,
    `Limits: <=2 working days · <=${TARGET_FILES} files (rare ceiling ${CEILING_FILES}) · at most ${OPEN_LIMIT} open per developer`,
    '',
    `| Type | Count | Days typical | Days slow end | ≤2 days | Files typical | Files high | Over ${TARGET_FILES} | Over ${CEILING_FILES} |`,
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...report.types.map(
      (r) =>
        `| ${r.type} | ${r.count} | ${r.daysTypical} | ${r.daysSlowEnd} | ${r.withinTwoDaysPct}% | ${r.filesTypical} | ${r.filesHigh} | ${r.overTargetPct}% | ${r.overCeilingPct}% |`
    ),
    '',
    `| Developer | Typical open at once | Max | Days over ${OPEN_LIMIT} open |`,
    '| --- | --- | --- | --- |',
    ...report.developers.map(
      (d) =>
        `| ${d.dev} | ${d.openTypical} | ${d.openMax} | ${d.overLimitPct}% |`
    ),
  ];
  if (report.developers.length === 0)
    lines.push('| (no developer with enough open days) | | | |');
  return lines.join('\n') + '\n';
}

// --- Sources: GitHub first, git merge commits as the fallback ------------------

const PR_QUERY = `
query MergedPullRequests($q: String!, $cursor: String) {
  search(query: $q, type: ISSUE, first: 100, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number title headRefName createdAt mergedAt changedFiles
        author { __typename login }
        commits(first: 1) { nodes { commit { authoredDate } } }
      }
    }
  }
}`;

/** Work PRs only (no bots, no release PRs), timed from the first commit. */
export function parseGitHubPrs(nodes) {
  return nodes
    .filter(
      (p) =>
        p.author?.__typename !== 'Bot' &&
        !isRelease(p.headRefName) &&
        !isRelease(p.title)
    )
    .map((p) => {
      const created = Date.parse(p.createdAt);
      const firstCommit = Date.parse(
        p.commits?.nodes?.[0]?.commit?.authoredDate
      );
      return {
        dev: p.author?.login ?? 'ghost',
        type: typeOf(p.title),
        files: p.changedFiles ?? 0,
        start: Number.isFinite(firstCommit)
          ? Math.min(created, firstCommit)
          : created,
        end: Date.parse(p.mergedAt),
      };
    });
}

function fromGitHub({ repoDir, since, disabled }) {
  const gh = githubAvailability(repoDir, disabled);
  if (!gh.ok) {
    log(`GitHub unavailable (${gh.reason}); using git merge commits.`);
    return null;
  }
  try {
    const { owner, repo } = gh.origin;
    const day = new Date(since).toISOString().slice(0, 10);
    const { nodes, capped } = ghSearchAll({
      query: PR_QUERY,
      q: `repo:${owner}/${repo} is:pr is:merged merged:>=${day}`,
      cap: SEARCH_CAP,
    });
    if (capped)
      log(
        `GitHub search stops at ${SEARCH_CAP} PRs; use a shorter --window-days.`
      );
    return parseGitHubPrs(nodes);
  } catch (err) {
    log(
      `GitHub query failed (${String(err.message).split('\n')[0]}); using git.`
    );
    return null;
  }
}

/** Branch a merge commit brought in, from its subject line. */
export function mergeHead(subject) {
  return (
    /^Merge pull request #\d+ from [^/\s]+\/(\S+)/.exec(subject)?.[1] ??
    /^Merge branch '([^']+)'/.exec(subject)?.[1] ??
    null
  );
}

/** Records printed by `git log --format=%H%x1f%cI%x1f%s%x1f%b%x1e`. */
export function parseGitMerges(raw) {
  return raw
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [sha, mergedAt, subject, body = ''] = record.split('\x1f');
      return {
        sha,
        end: Date.parse(mergedAt),
        title: body.split('\n')[0].trim() || subject,
        head: mergeHead(subject),
      };
    });
}

const git = (repoDir, args) =>
  execFileSync('git', args, {
    cwd: repoDir,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

function fromGit({ repoDir, since }) {
  try {
    const raw = git(repoDir, [
      'log',
      '--merges',
      '--first-parent',
      `--since=${new Date(since).toISOString()}`,
      '--format=%H%x1f%cI%x1f%s%x1f%b%x1e',
    ]);
    return parseGitMerges(raw)
      .filter((m) => !isRelease(m.head) && !isRelease(m.title))
      .map((m) => {
        const range = `${m.sha}^1..${m.sha}^2`;
        const [firstAt, dev] = git(repoDir, [
          'log',
          '--reverse',
          '--format=%aI%x1f%aN',
          range,
        ])
          .split('\n')[0]
          .split('\x1f');
        const files = git(repoDir, [
          'diff',
          '--name-only',
          `${m.sha}^1...${m.sha}^2`,
        ])
          .split('\n')
          .filter(Boolean).length;
        const start = Date.parse(firstAt);
        return {
          dev: dev || 'unknown',
          type: typeOf(m.title),
          files,
          start: Number.isFinite(start) ? Math.min(start, m.end) : m.end,
          end: m.end,
        };
      });
  } catch (err) {
    log(`git history unavailable (${String(err.message).split('\n')[0]}).`);
    return [];
  }
}

// --- CLI -----------------------------------------------------------------------

export function parseArgs(argv) {
  const opts = {
    windowDays: DEFAULT_WINDOW_DAYS,
    repoDir: process.cwd(),
    github: true,
    now: Date.now(),
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1] ?? '';
    if (flag === '--no-github') {
      opts.github = false;
    } else if (flag === '--window-days') {
      if (!/^[1-9]\d*$/.test(value))
        throw new Error('--window-days needs a positive whole number');
      opts.windowDays = Number(value);
      i++;
    } else if (flag === '--repo-dir') {
      if (!value || value.startsWith('--'))
        throw new Error('--repo-dir needs a path');
      opts.repoDir = path.resolve(value);
      i++;
    } else if (flag === '--now') {
      opts.now = Date.parse(value);
      if (!Number.isFinite(opts.now))
        throw new Error('--now needs an ISO date');
      i++;
    } else {
      throw new Error(`unknown argument: ${flag}`);
    }
  }
  return opts;
}

export function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    log(err.message);
    log('See the header of scripts/slice-baseline.mjs for flags.');
    return EXIT_USAGE;
  }
  const since = opts.now - opts.windowDays * DAY_MS;
  const github = fromGitHub({
    repoDir: opts.repoDir,
    since,
    disabled: !opts.github,
  });
  const report = buildReport({
    items: github ?? fromGit({ repoDir: opts.repoDir, since }),
    since,
    now: opts.now,
    source: github ? 'GitHub merged PRs' : 'git merge commits',
    windowDays: opts.windowDays,
  });
  process.stdout.write(report ? renderMarkdown(report) : NO_BASELINE + '\n');
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exit(main(process.argv.slice(2)));
}
