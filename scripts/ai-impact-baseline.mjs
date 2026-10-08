#!/usr/bin/env node
/**
 * @file ai-impact-baseline.mjs
 * @description Engineering metrics before vs after AI entered a codebase.
 * Finds the first AI-assisted commit (or takes a user-supplied cutoff date or
 * range), splits history into two windows of equal length on either side of
 * it, and collects the same metrics for both. Git metrics work on any host
 * (GitHub, Bitbucket, GitLab, self-hosted). Pull-request, issue, CI and release
 * metrics are added when the origin is github.com and the GitHub CLI (`gh`) is
 * signed in; no other host API is implemented.
 *
 * Read-only: it never mutates the repository, installs nothing, and the only
 * files it writes are report.json and report.md under the output directory.
 * The JSON manifest goes to stdout; human-readable logs go to stderr.
 *
 * AI-assisted detection uses the same signals as the dashboard's AI-impact
 * panel (apps/dashboard/src/lib/ai-impact.ts): a Co-authored-by trailer naming
 * an AI tool, a "Generated with <tool>" body marker, or an AI agent as author.
 * Keep the three regexes below in step with that file.
 *
 * Usage:
 *   node scripts/ai-impact-baseline.mjs [--repo-dir <path>] [--cutoff <date>]
 *     [--cutoff-end <date>] [--window-days <n>] [--branch <ref>]
 *     [--out-dir <path>] [--no-github] [--detect-only] [--now <iso>]
 *     [--pr-cap <n>] [--run-cap <n>]
 *
 * Exit codes: 0 ok · 2 usage · 20 cutoff unknown (ask the user for a date or
 * range) · 30 not a git repository or no commits.
 */

import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const log = (...args) => process.stderr.write(args.join(' ') + '\n');

export const EXIT_USAGE = 2;
export const EXIT_CUTOFF_UNKNOWN = 20;
export const EXIT_NO_REPO = 30;

/** Both windows need this many units (commits, or PRs) before deltas are shown. */
export const MIN_SAMPLE = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_PR_CAP = 500;
const DEFAULT_RUN_CAP = 1000;
const RELEASE_CAP = 300;

// --- AI-assisted signals (mirror apps/dashboard/src/lib/ai-impact.ts) --------

const AI_TOOL = String.raw`(claude|anthropic|copilot|cursor|gemini|jules|codex|devin|openai)`;
const AI_COAUTHOR = new RegExp(String.raw`^co-authored-by:.*${AI_TOOL}`, 'im');
const AI_BODY_MARKER = new RegExp(
  String.raw`generated (with|by) \[?${AI_TOOL}`,
  'i'
);
const AI_AGENT_AUTHOR =
  /^(google-labs-jules|copilot-swe-agent|devin-ai-integration|claude|codex)(\[bot\])?$/i;
/** Weak hint only: a commit that talks about AI without carrying a hard signal. */
const AI_MENTION =
  /\b(ai|llm|copilot|claude|cursor|gemini|chatgpt|codex|agent)\b/i;

const REVERT_SUBJECT = /^Revert "(.+)"$/;
const FIX_SUBJECT =
  /^(fix|hotfix|bugfix)(\(|:|!)|\b(fix(es|ed)?|hotfix|bugfix)\b/i;
const TEST_PATH =
  /(^|\/)(__tests__|tests?|spec|e2e|cypress|playwright)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$|_test\.(go|py|rb|rs)$|Tests?\.(cs|java|kt|swift)$/;
const DEPENDENCY_BOT =
  /^(dependabot|renovate|github-actions|release-please)(\[bot\])?$/i;

/** Every AI signal a commit carries; empty means not AI-assisted. */
export function commitAiSignals(commit) {
  const signals = [];
  if (AI_COAUTHOR.test(commit.body)) signals.push('commit-trailer');
  if (AI_BODY_MARKER.test(commit.body)) signals.push('body-marker');
  if (
    isAiAgentAuthor(commit.authorName) ||
    isAiAgentAuthor(commit.authorEmail.split('@')[0])
  ) {
    signals.push('ai-agent-author');
  }
  return signals;
}

export function isAiAgentAuthor(login) {
  return Boolean(login && AI_AGENT_AUTHOR.test(login));
}

/** Every AI signal a pull request carries; empty means not AI-assisted. */
export function prAiSignals(pr) {
  const signals = [];
  if (pr.commitMessages.some((m) => AI_COAUTHOR.test(m)))
    signals.push('commit-trailer');
  if (AI_BODY_MARKER.test(pr.body)) signals.push('pr-body');
  if (isAiAgentAuthor(pr.authorLogin)) signals.push('ai-agent-author');
  return signals;
}

// --- Small pure helpers --------------------------------------------------------

/** Linear-interpolation percentile (Hyndman–Fan type 7, the spreadsheet default). */
export function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * p;
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return round(sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo));
}

const median = (values) => percentile(values, 0.5);
const round = (n, digits = 2) =>
  n === null ? null : Number(n.toFixed(digits));
const notNull = (v) => v !== null && v !== undefined;

function hoursBetween(from, to) {
  if (!from || !to) return null;
  const h = (Date.parse(to) - Date.parse(from)) / HOUR_MS;
  return Number.isFinite(h) && h >= 0 ? h : null;
}

/** (after − before) ÷ before; null when either side is missing or before is 0. */
export function relativeDelta(after, before) {
  if (!notNull(after) || !notNull(before) || before === 0) return null;
  return round((after - before) / before, 4);
}

const dayOf = (date) => new Date(date).toISOString().slice(0, 10);

/** ISO week start (Monday) for a date, as YYYY-MM-DD. */
export function weekStart(iso) {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

// --- Git -----------------------------------------------------------------------

const REC = '\x1e';
const FIELD = '\x1f';
const GIT_FORMAT = `${REC}%H${FIELD}%aI${FIELD}%aN${FIELD}%aE${FIELD}%P${FIELD}%B${FIELD}`;

/** Parses `git log --format=<GIT_FORMAT> --numstat` output into commit objects. */
export function parseGitLog(raw) {
  const commits = [];
  for (const record of raw.split(REC)) {
    if (!record.trim()) continue;
    const parts = record.split(FIELD);
    if (parts.length < 7) continue;
    const [sha, date, authorName, authorEmail, parents, body, numstat] = parts;
    let added = 0;
    let deleted = 0;
    let testLines = 0;
    let files = 0;
    for (const line of numstat.split('\n')) {
      const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (!m) continue;
      files++;
      const a = m[1] === '-' ? 0 : Number(m[1]);
      const d = m[2] === '-' ? 0 : Number(m[2]);
      added += a;
      deleted += d;
      if (TEST_PATH.test(m[3])) testLines += a + d;
    }
    const trimmedBody = body.trim();
    commits.push({
      sha,
      date,
      authorName,
      authorEmail,
      isMerge: parents.trim().split(' ').filter(Boolean).length > 1,
      subject: trimmedBody.split('\n')[0] ?? '',
      body: trimmedBody,
      added,
      deleted,
      files,
      testLines,
    });
  }
  return commits.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

function git(repoDir, args) {
  return execFileSync('git', args, {
    cwd: repoDir,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function resolveBranch(repoDir, requested) {
  if (requested) return requested;
  try {
    return git(repoDir, [
      'symbolic-ref',
      '--short',
      'refs/remotes/origin/HEAD',
    ]).trim();
  } catch {
    return 'HEAD';
  }
}

function readCommits(repoDir, branch) {
  const raw = git(repoDir, [
    'log',
    branch,
    `--format=${GIT_FORMAT}`,
    '--numstat',
    '--no-color',
  ]);
  return parseGitLog(raw);
}

function readTags(repoDir) {
  try {
    const raw = git(repoDir, [
      'for-each-ref',
      '--format=%(creatordate:iso-strict)\t%(refname:short)',
      'refs/tags',
    ]);
    return raw
      .split('\n')
      .map((l) => l.split('\t'))
      .filter((p) => p.length === 2 && p[0])
      .map(([date, name]) => ({ date, name }));
  } catch {
    return [];
  }
}

/** owner/repo when origin points at github.com, else null. */
export function parseGitHubOrigin(url) {
  const m = url
    .trim()
    .match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

// --- Cutoff detection and window maths ---------------------------------------

/**
 * Earliest commit carrying a hard AI signal, plus weaker "mentions AI" hints
 * the user can use to answer the cutoff question when nothing hard is found.
 */
export function detectFirstAiCommit(commits) {
  const hints = [];
  for (const c of commits) {
    const signals = commitAiSignals(c);
    if (signals.length > 0) {
      return {
        detected: { sha: c.sha, date: c.date, subject: c.subject, signals },
        hints,
      };
    }
    if (hints.length < 5 && AI_MENTION.test(c.subject)) {
      hints.push({ sha: c.sha, date: c.date, subject: c.subject });
    }
  }
  return { detected: null, hints };
}

/**
 * Two windows of equal length: `before` ends at cutoffStart, `after` starts at
 * cutoffEnd (the range between them is a transition period and belongs to
 * neither). The length is the largest the history and `now` allow, capped by
 * `maxDays` when given.
 */
export function splitWindows({
  cutoffStart,
  cutoffEnd,
  firstCommitAt,
  now,
  maxDays,
}) {
  const start = Date.parse(cutoffStart);
  const end = Date.parse(cutoffEnd ?? cutoffStart);
  const nowMs = Date.parse(now);
  const first = Date.parse(firstCommitAt);
  if ([start, end, nowMs, first].some(Number.isNaN))
    throw new Error('Invalid date in window input.');
  if (end < start) throw new Error('--cutoff-end must not be before --cutoff.');
  const afterAvailable = (nowMs - end) / DAY_MS;
  const beforeAvailable = (start - first) / DAY_MS;
  let days = Math.floor(Math.min(afterAvailable, beforeAvailable));
  if (maxDays) days = Math.min(days, maxDays);
  if (days < 1)
    throw new Error(
      'Not enough history on both sides of the cutoff for a comparison.'
    );
  const span = days * DAY_MS;
  return {
    days,
    truncatedBy: afterAvailable < beforeAvailable ? 'after' : 'before',
    before: {
      from: new Date(start - span).toISOString(),
      to: new Date(start).toISOString(),
    },
    after: {
      from: new Date(end).toISOString(),
      to: new Date(end + span).toISOString(),
    },
  };
}

const inWindow = (iso, w) => {
  const t = Date.parse(iso);
  return t >= Date.parse(w.from) && t < Date.parse(w.to);
};

// --- Git metrics ---------------------------------------------------------------

export function commitStats(commits, window) {
  const inside = commits.filter((c) => inWindow(c.date, window));
  const weeks =
    (Date.parse(window.to) - Date.parse(window.from)) / (7 * DAY_MS);
  const nonMerge = inside.filter((c) => !c.isMerge);
  const changed = nonMerge.map((c) => c.added + c.deleted);
  const totalChanged = changed.reduce((a, b) => a + b, 0);
  const testLines = nonMerge.reduce((a, c) => a + c.testLines, 0);
  const ai = nonMerge.filter((c) => commitAiSignals(c).length > 0);
  const fixes = nonMerge.filter((c) => FIX_SUBJECT.test(c.subject));
  const reverts = nonMerge.filter((c) => REVERT_SUBJECT.test(c.subject));
  return {
    commits: inside.length,
    mergeCommits: inside.length - nonMerge.length,
    commitsPerWeek: round(weeks > 0 ? inside.length / weeks : 0),
    activeAuthors: new Set(nonMerge.map((c) => c.authorEmail.toLowerCase()))
      .size,
    linesAdded: nonMerge.reduce((a, c) => a + c.added, 0),
    linesDeleted: nonMerge.reduce((a, c) => a + c.deleted, 0),
    changedLinesPerCommitMedian: median(changed),
    filesPerCommitMedian: median(nonMerge.map((c) => c.files)),
    testLineShare: round(totalChanged > 0 ? testLines / totalChanged : 0, 4),
    fixCommitShare: round(
      nonMerge.length > 0 ? fixes.length / nonMerge.length : 0,
      4
    ),
    revertCommits: reverts.length,
    aiAssistedCommits: ai.length,
    aiAssistedShare: round(
      nonMerge.length > 0 ? ai.length / nonMerge.length : 0,
      4
    ),
  };
}

function tagStats(tags, window) {
  const inside = tags.filter((t) => inWindow(t.date, window));
  const weeks =
    (Date.parse(window.to) - Date.parse(window.from)) / (7 * DAY_MS);
  return {
    tags: inside.length,
    tagsPerWeek: round(weeks > 0 ? inside.length / weeks : 0),
  };
}

/** Commits per ISO week across both windows; the series behind the chart. */
export function weeklySeries(commits, windows, prs = []) {
  const buckets = new Map();
  const bump = (iso, key) => {
    const cohort = inWindow(iso, windows.before)
      ? 'before'
      : inWindow(iso, windows.after)
        ? 'after'
        : null;
    if (!cohort) return;
    // A week that straddles the cutoff gets one row per cohort.
    const wk = weekStart(iso);
    const id = `${wk}|${cohort}`;
    const row = buckets.get(id) ?? {
      weekStart: wk,
      cohort,
      commits: 0,
      prsMerged: 0,
    };
    row[key]++;
    buckets.set(id, row);
  };
  for (const c of commits) bump(c.date, 'commits');
  for (const pr of prs) bump(pr.mergedAt, 'prsMerged');
  return [...buckets.values()].sort(
    (a, b) =>
      a.weekStart.localeCompare(b.weekStart) || a.cohort.localeCompare(b.cohort)
  );
}

// --- GitHub metrics (gh CLI) ---------------------------------------------------

const MERGED_PRS_QUERY = `
query MergedPullRequests($q: String!, $cursor: String) {
  search(query: $q, type: ISSUE, first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number title body headRefName createdAt mergedAt additions deletions changedFiles
        author { __typename login }
        reviews(first: 1) { totalCount nodes { submittedAt } }
        comments { totalCount }
        commits(first: 100) { totalCount nodes { commit { authoredDate message } } }
      }
    }
  }
}`;

const ISSUES_QUERY = `
query Issues($q: String!, $cursor: String) {
  search(query: $q, type: ISSUE, first: 100, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on Issue {
        number createdAt closedAt
        author { __typename login }
        labels(first: 10) { nodes { name } }
      }
    }
  }
}`;

function ghJson(args) {
  const out = execFileSync('gh', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out);
}

function ghSearchAll({ query, q, cap }) {
  const nodes = [];
  let cursor = null;
  let capped = false;
  for (;;) {
    const args = ['api', 'graphql', '-f', `query=${query}`, '-f', `q=${q}`];
    if (cursor) args.push('-f', `cursor=${cursor}`);
    const page = ghJson(args).data.search;
    for (const n of page.nodes)
      if (n && typeof n === 'object' && 'number' in n) nodes.push(n);
    if (nodes.length >= cap) {
      capped = page.hasNextPage || nodes.length > cap;
      nodes.length = Math.min(nodes.length, cap);
      break;
    }
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  return { nodes, capped };
}

function ghRestAll({ route, key, cap, stopWhen }) {
  const items = [];
  let page = 1;
  let capped = false;
  for (;;) {
    const sep = route.includes('?') ? '&' : '?';
    const body = ghJson(['api', `${route}${sep}per_page=100&page=${page}`]);
    const batch = key ? body[key] : body;
    if (!Array.isArray(batch) || batch.length === 0) break;
    items.push(...batch);
    if (stopWhen && stopWhen(batch[batch.length - 1])) break;
    if (items.length >= cap) {
      capped = batch.length === 100;
      items.length = cap;
      break;
    }
    if (batch.length < 100) break;
    page++;
  }
  return { items, capped };
}

function toPullRequestRecord(node) {
  const commitDates = node.commits.nodes
    .map((c) => c.commit.authoredDate)
    .sort();
  return {
    number: node.number,
    title: node.title,
    body: node.body ?? '',
    headRefName: node.headRefName,
    authorLogin: node.author?.login ?? null,
    authorIsBot:
      node.author?.__typename === 'Bot' ||
      Boolean(node.author?.login?.endsWith('[bot]')),
    createdAt: node.createdAt,
    mergedAt: node.mergedAt,
    firstCommitAt: commitDates[0] ?? null,
    firstReviewAt: node.reviews.nodes[0]?.submittedAt ?? null,
    reviewCount: node.reviews.totalCount,
    commentCount: node.comments.totalCount,
    commitCount: node.commits.totalCount,
    additions: node.additions,
    deletions: node.deletions,
    changedFiles: node.changedFiles,
    commitMessages: node.commits.nodes.map((c) => c.commit.message),
  };
}

export function prStats(prs, window) {
  const inside = prs.filter((p) => inWindow(p.mergedAt, window));
  const weeks =
    (Date.parse(window.to) - Date.parse(window.from)) / (7 * DAY_MS);
  const revertedTitles = new Set(
    inside.map((p) => p.title.match(REVERT_SUBJECT)?.[1]).filter(Boolean)
  );
  // Dependency and release bots are not tasks; AI coding agents are.
  const bots = inside.filter(
    (p) => p.authorIsBot && !isAiAgentAuthor(p.authorLogin)
  );
  const tasks = inside.filter(
    (p) => !bots.includes(p) && !REVERT_SUBJECT.test(p.title)
  );
  const reviewed = tasks.filter((p) => p.firstReviewAt);
  const cycles = tasks
    .map((p) => hoursBetween(p.firstCommitAt ?? p.createdAt, p.mergedAt))
    .filter(notNull);
  const ai = tasks.filter((p) => prAiSignals(p).length > 0);
  return {
    mergedPrs: tasks.length,
    excludedBotPrs: bots.length,
    excludedRevertPrs: inside.length - tasks.length - bots.length,
    mergedPerWeek: round(weeks > 0 ? tasks.length / weeks : 0),
    prAuthors: new Set(tasks.map((p) => p.authorLogin).filter(Boolean)).size,
    cycleHoursMedian: median(cycles),
    cycleHoursP75: percentile(cycles, 0.75),
    codingHoursMedian: median(
      tasks
        .map((p) => hoursBetween(p.firstCommitAt, p.createdAt))
        .filter(notNull)
    ),
    pickupHoursMedian: median(
      reviewed
        .map((p) => hoursBetween(p.createdAt, p.firstReviewAt))
        .filter(notNull)
    ),
    reviewHoursMedian: median(
      reviewed
        .map((p) => hoursBetween(p.firstReviewAt, p.mergedAt))
        .filter(notNull)
    ),
    prSizeMedian: median(tasks.map((p) => p.additions + p.deletions)),
    changedFilesMedian: median(tasks.map((p) => p.changedFiles)),
    commitsPerPrMedian: median(tasks.map((p) => p.commitCount)),
    reviewCommentsMedian: median(
      tasks.map((p) => p.reviewCount + p.commentCount)
    ),
    unreviewedShare: round(
      tasks.length ? (tasks.length - reviewed.length) / tasks.length : 0,
      4
    ),
    revertRate: round(
      tasks.length
        ? tasks.filter((p) => revertedTitles.has(p.title)).length / tasks.length
        : 0,
      4
    ),
    aiAssistedPrs: ai.length,
    aiAssistedShare: round(tasks.length ? ai.length / tasks.length : 0, 4),
  };
}

export function issueStats(issues, window) {
  const opened = issues.filter(
    (i) =>
      inWindow(i.createdAt, window) && !DEPENDENCY_BOT.test(i.authorLogin ?? '')
  );
  const closed = opened.filter((i) => i.closedAt);
  const bugs = opened.filter((i) =>
    i.labels.some((l) => /bug|defect|regression/i.test(l))
  );
  return {
    issuesOpened: opened.length,
    issuesClosed: closed.length,
    closedShare: round(opened.length ? closed.length / opened.length : 0, 4),
    timeToCloseHoursMedian: median(
      closed.map((i) => hoursBetween(i.createdAt, i.closedAt)).filter(notNull)
    ),
    bugLabelledShare: round(opened.length ? bugs.length / opened.length : 0, 4),
  };
}

export function ciStats(runs, window) {
  const inside = runs.filter((r) => inWindow(r.created_at, window));
  const decided = inside.filter(
    (r) => r.conclusion === 'success' || r.conclusion === 'failure'
  );
  const success = decided.filter((r) => r.conclusion === 'success').length;
  const durations = inside
    .map((r) =>
      r.run_started_at && r.updated_at
        ? (Date.parse(r.updated_at) - Date.parse(r.run_started_at)) / 60000
        : null
    )
    .filter((m) => notNull(m) && m >= 0);
  return {
    workflowRuns: inside.length,
    failedRuns: decided.length - success,
    successRate: round(decided.length ? success / decided.length : 0, 4),
    runDurationMinutesMedian: median(durations),
  };
}

export function releaseStats(releases, window) {
  const inside = releases.filter(
    (r) => r.published_at && inWindow(r.published_at, window) && !r.draft
  );
  const weeks =
    (Date.parse(window.to) - Date.parse(window.from)) / (7 * DAY_MS);
  return {
    releases: inside.length,
    releasesPerWeek: round(weeks > 0 ? inside.length / weeks : 0),
  };
}

function collectGitHub({ origin, windows, prCap, runCap }) {
  const repo = `${origin.owner}/${origin.repo}`;
  const span = { from: windows.before.from, to: windows.after.to };
  const range = `${dayOf(span.from)}..${dayOf(span.to)}`;
  const capped = {};

  log(`• GitHub: merged pull requests ${range}`);
  const prSearch = ghSearchAll({
    query: MERGED_PRS_QUERY,
    q: `repo:${repo} is:pr is:merged merged:${range} sort:updated-desc`,
    cap: prCap,
  });
  const prs = prSearch.nodes.map(toPullRequestRecord);
  capped.pullRequests = prSearch.capped;

  log(`• GitHub: issues opened ${range}`);
  const issueSearch = ghSearchAll({
    query: ISSUES_QUERY,
    q: `repo:${repo} is:issue created:${range} sort:created-desc`,
    cap: prCap,
  });
  const issues = issueSearch.nodes.map((n) => ({
    number: n.number,
    createdAt: n.createdAt,
    closedAt: n.closedAt,
    authorLogin: n.author?.login ?? null,
    labels: n.labels.nodes.map((l) => l.name),
  }));
  capped.issues = issueSearch.capped;

  log(`• GitHub: workflow runs ${range}`);
  const runs = ghRestAll({
    route: `/repos/${repo}/actions/runs?created=${range}`,
    key: 'workflow_runs',
    cap: runCap,
  });
  capped.workflowRuns = runs.capped;

  log('• GitHub: releases');
  const releases = ghRestAll({
    route: `/repos/${repo}/releases`,
    cap: RELEASE_CAP,
    stopWhen: (last) =>
      last.published_at &&
      Date.parse(last.published_at) < Date.parse(span.from),
  });
  capped.releases = releases.capped;

  return {
    status: 'ok',
    repo,
    capped,
    prs,
    before: {
      ...prStats(prs, windows.before),
      ...issueStats(issues, windows.before),
      ...ciStats(runs.items, windows.before),
      ...releaseStats(releases.items, windows.before),
    },
    after: {
      ...prStats(prs, windows.after),
      ...issueStats(issues, windows.after),
      ...ciStats(runs.items, windows.after),
      ...releaseStats(releases.items, windows.after),
    },
  };
}

function githubAvailability(repoDir, disabled) {
  if (disabled) return { ok: false, reason: 'disabled with --no-github' };
  let origin = null;
  try {
    origin = parseGitHubOrigin(git(repoDir, ['remote', 'get-url', 'origin']));
  } catch {
    return { ok: false, reason: 'no origin remote' };
  }
  if (!origin)
    return {
      ok: false,
      reason: 'origin is not github.com; only git metrics are collected',
    };
  const auth = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });
  if (auth.error)
    return { ok: false, reason: 'gh CLI is not installed', origin };
  if (auth.status !== 0)
    return {
      ok: false,
      reason: 'gh CLI is not signed in (run `gh auth login`)',
      origin,
    };
  return { ok: true, origin };
}

// --- Report --------------------------------------------------------------------

/**
 * How a change reads. Rates and times have an accepted direction; raw volumes
 * (lines, files, PR size, counts of things) do not, so they stay neutral and
 * the reader decides with context.
 */
const LOWER_IS_BETTER = new Set([
  'cycleHoursMedian',
  'cycleHoursP75',
  'codingHoursMedian',
  'pickupHoursMedian',
  'reviewHoursMedian',
  'unreviewedShare',
  'revertRate',
  'revertCommits',
  'fixCommitShare',
  'failedRuns',
  'runDurationMinutesMedian',
  'timeToCloseHoursMedian',
  'bugLabelledShare',
]);
const HIGHER_IS_BETTER = new Set([
  'commitsPerWeek',
  'mergedPerWeek',
  'testLineShare',
  'successRate',
  'closedShare',
  'releasesPerWeek',
  'tagsPerWeek',
]);

function favourability(key, relative) {
  if (relative === null || relative === 0) return null;
  if (LOWER_IS_BETTER.has(key)) return relative < 0;
  if (HIGHER_IS_BETTER.has(key)) return relative > 0;
  return null;
}

export function buildDeltas(before, after) {
  const deltas = {};
  for (const key of Object.keys(before)) {
    if (typeof before[key] !== 'number' || typeof after[key] !== 'number')
      continue;
    const relative = relativeDelta(after[key], before[key]);
    deltas[key] = {
      before: before[key],
      after: after[key],
      absolute: round(after[key] - before[key], 4),
      relative,
      direction:
        relative === null || relative === 0
          ? 'flat'
          : relative > 0
            ? 'up'
            : 'down',
      favourable: favourability(key, relative),
    };
  }
  return deltas;
}

const fmt = (v) =>
  v === null || v === undefined ? 'n/a' : typeof v === 'number' ? String(v) : v;
const pct = (v) =>
  v === null ? 'n/a' : `${v > 0 ? '+' : ''}${round(v * 100, 1)}%`;

function table(title, deltas) {
  const rows = Object.entries(deltas);
  if (rows.length === 0) return '';
  const lines = [
    `### ${title}`,
    '',
    '| Metric | Before | After | Change | Reads as |',
    '| :-- | --: | --: | --: | :-- |',
  ];
  for (const [key, d] of rows) {
    const reads =
      d.favourable === null ? '—' : d.favourable ? 'better' : 'worse';
    lines.push(
      `| ${key} | ${fmt(d.before)} | ${fmt(d.after)} | ${pct(d.relative)} | ${reads} |`
    );
  }
  return lines.join('\n') + '\n';
}

export function renderMarkdown(report) {
  const w = report.windows;
  const cut = report.cutoff;
  const out = [
    '# AI impact baseline',
    '',
    `Repository: \`${report.repo.dir}\` · branch \`${report.repo.branch}\`${report.github.status === 'ok' ? ` · GitHub \`${report.github.repo}\`` : ''}`,
    '',
    `Cutoff: **${dayOf(cut.start)}**${cut.end !== cut.start ? ` to **${dayOf(cut.end)}** (transition period excluded)` : ''} · source: ${cut.source}${cut.detected ? ` (\`${cut.detected.sha.slice(0, 7)}\` ${cut.detected.subject})` : ''}`,
    '',
    `Windows: **${w.days} days each** · before ${dayOf(w.before.from)} → ${dayOf(w.before.to)} · after ${dayOf(w.after.from)} → ${dayOf(w.after.to)}`,
    '',
    report.sufficient
      ? `Both windows hold at least ${MIN_SAMPLE} commits, so the deltas below are comparable.`
      : `**Caution:** a window holds fewer than ${MIN_SAMPLE} commits; treat every delta as anecdotal.`,
    '',
    '> Before/after is a correlation, not a causal effect: team size, holidays, product phase and',
    '> process changes all move these numbers too. Pair the table with what else changed at the cutoff.',
    '',
    table('Git (any host)', report.deltas.git),
  ];
  if (report.github.status === 'ok') {
    out.push(
      table(
        'GitHub pull requests, issues, CI and releases',
        report.deltas.github
      )
    );
    const capped = Object.entries(report.github.capped)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (capped.length)
      out.push(
        `Capped lists (more existed than were fetched): ${capped.join(', ')}.`,
        ''
      );
  } else {
    out.push(`GitHub metrics skipped: ${report.github.reason}.`, '');
  }
  return out.join('\n');
}

// --- CLI -----------------------------------------------------------------------

export function parseArgs(argv) {
  const opts = {
    repoDir: process.cwd(),
    cutoff: null,
    cutoffEnd: null,
    windowDays: null,
    branch: null,
    outDir: null,
    github: true,
    detectOnly: false,
    now: new Date().toISOString(),
    prCap: DEFAULT_PR_CAP,
    runCap: DEFAULT_RUN_CAP,
  };
  const value = (i, flag) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--'))
      throw new Error(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--repo-dir':
        opts.repoDir = path.resolve(value(i, a));
        i++;
        break;
      case '--cutoff':
        opts.cutoff = value(i, a);
        i++;
        break;
      case '--cutoff-end':
        opts.cutoffEnd = value(i, a);
        i++;
        break;
      case '--window-days':
        opts.windowDays = Number(value(i, a));
        i++;
        break;
      case '--branch':
        opts.branch = value(i, a);
        i++;
        break;
      case '--out-dir':
        opts.outDir = path.resolve(value(i, a));
        i++;
        break;
      case '--now':
        opts.now = value(i, a);
        i++;
        break;
      case '--pr-cap':
        opts.prCap = Number(value(i, a));
        i++;
        break;
      case '--run-cap':
        opts.runCap = Number(value(i, a));
        i++;
        break;
      case '--no-github':
        opts.github = false;
        break;
      case '--detect-only':
        opts.detectOnly = true;
        break;
      default:
        throw new Error(`Unknown argument: ${a}`);
    }
  }
  for (const [flag, v] of [
    ['--cutoff', opts.cutoff],
    ['--cutoff-end', opts.cutoffEnd],
    ['--now', opts.now],
  ]) {
    if (v !== null && Number.isNaN(Date.parse(v)))
      throw new Error(`${flag} is not a valid date: ${v}`);
  }
  if (opts.cutoffEnd && !opts.cutoff)
    throw new Error('--cutoff-end needs --cutoff');
  for (const [flag, v] of [
    ['--window-days', opts.windowDays],
    ['--pr-cap', opts.prCap],
    ['--run-cap', opts.runCap],
  ]) {
    if (v !== null && (!Number.isInteger(v) || v < 1))
      throw new Error(`${flag} must be a positive integer`);
  }
  return opts;
}

const emit = (manifest) =>
  process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');

export function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    log(`Usage error: ${e.message}`);
    log('See the header of scripts/ai-impact-baseline.mjs for flags.');
    return EXIT_USAGE;
  }

  let commits;
  let branch;
  try {
    branch = resolveBranch(opts.repoDir, opts.branch);
    commits = readCommits(opts.repoDir, branch);
  } catch (e) {
    emit({ status: 'no_repo', reason: e.message.split('\n')[0] });
    return EXIT_NO_REPO;
  }
  if (commits.length === 0) {
    emit({ status: 'no_repo', reason: `no commits on ${branch}` });
    return EXIT_NO_REPO;
  }
  log(
    `• ${commits.length} commits on ${branch} (${dayOf(commits[0].date)} → ${dayOf(commits[commits.length - 1].date)})`
  );

  const detection = detectFirstAiCommit(commits);
  if (opts.detectOnly) {
    emit({
      status: detection.detected ? 'detected' : 'cutoff_unknown',
      ...detection,
    });
    return 0;
  }

  let cutoff;
  if (opts.cutoff) {
    cutoff = {
      start: new Date(opts.cutoff).toISOString(),
      end: new Date(opts.cutoffEnd ?? opts.cutoff).toISOString(),
      source: 'user',
      detected: detection.detected,
    };
  } else if (detection.detected) {
    cutoff = {
      start: detection.detected.date,
      end: detection.detected.date,
      source: 'detected',
      detected: detection.detected,
    };
  } else {
    emit({
      status: 'cutoff_unknown',
      reason:
        'No commit carries an AI signal (Co-authored-by trailer, "Generated with" marker, or AI agent author).',
      ask: 'When was AI first introduced into this codebase? Give a date (YYYY-MM-DD) or a range (start..end) you know or suspect.',
      hints: detection.hints,
      history: {
        firstCommitAt: commits[0].date,
        lastCommitAt: commits[commits.length - 1].date,
        commits: commits.length,
      },
    });
    return EXIT_CUTOFF_UNKNOWN;
  }

  let windows;
  try {
    windows = splitWindows({
      cutoffStart: cutoff.start,
      cutoffEnd: cutoff.end,
      firstCommitAt: commits[0].date,
      now: opts.now,
      maxDays: opts.windowDays,
    });
  } catch (e) {
    emit({ status: 'insufficient_history', reason: e.message, cutoff });
    return EXIT_USAGE;
  }
  log(
    `• windows: ${windows.days} days each (before ${dayOf(windows.before.from)}, after from ${dayOf(windows.after.from)})`
  );

  const tags = readTags(opts.repoDir);
  const gitBefore = {
    ...commitStats(commits, windows.before),
    ...tagStats(tags, windows.before),
  };
  const gitAfter = {
    ...commitStats(commits, windows.after),
    ...tagStats(tags, windows.after),
  };

  const availability = githubAvailability(opts.repoDir, !opts.github);
  let github = { status: 'skipped', reason: availability.reason };
  if (availability.ok) {
    try {
      github = collectGitHub({
        origin: availability.origin,
        windows,
        prCap: opts.prCap,
        runCap: opts.runCap,
      });
    } catch (e) {
      github = { status: 'failed', reason: e.message.split('\n')[0] };
      log(`• GitHub collection failed: ${github.reason}`);
    }
  } else {
    log(`• GitHub metrics skipped: ${availability.reason}`);
  }

  const sufficient =
    gitBefore.commits >= MIN_SAMPLE &&
    gitAfter.commits >= MIN_SAMPLE &&
    (github.status !== 'ok' ||
      (github.before.mergedPrs >= MIN_SAMPLE &&
        github.after.mergedPrs >= MIN_SAMPLE));

  const { prs, ...githubSummary } = github;
  const report = {
    generatedAt: opts.now,
    repo: {
      dir: opts.repoDir,
      branch,
      firstCommitAt: commits[0].date,
      commits: commits.length,
    },
    cutoff,
    windows,
    minSample: MIN_SAMPLE,
    sufficient,
    git: { before: gitBefore, after: gitAfter },
    github: githubSummary,
    deltas: {
      git: buildDeltas(gitBefore, gitAfter),
      github:
        github.status === 'ok' ? buildDeltas(github.before, github.after) : {},
    },
    series: { weekly: weeklySeries(commits, windows, prs ?? []) },
  };

  const outDir =
    opts.outDir ??
    path.join(opts.repoDir, '.ai', 'output', 'ai-impact', dayOf(opts.now));
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'report.json');
  const mdPath = path.join(outDir, 'report.md');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(mdPath, renderMarkdown(report));

  emit({
    status: 'ok',
    outDir,
    files: { json: jsonPath, markdown: mdPath },
    cutoff: { start: cutoff.start, end: cutoff.end, source: cutoff.source },
    windowDays: windows.days,
    sufficient,
    github: {
      status: github.status,
      reason: github.reason ?? null,
      capped: github.capped ?? null,
    },
    headline: {
      commitsPerWeek: report.deltas.git.commitsPerWeek,
      mergedPerWeek: report.deltas.github.mergedPerWeek ?? null,
      cycleHoursMedian: report.deltas.github.cycleHoursMedian ?? null,
      revertRate: report.deltas.github.revertRate ?? null,
    },
  });
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exit(main(process.argv.slice(2)));
}
