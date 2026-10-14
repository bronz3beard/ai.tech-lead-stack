import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  EXIT_USAGE,
  buildReport,
  isRelease,
  main,
  mergeHead,
  openAtOnce,
  parseArgs,
  parseGitHubPrs,
  parseGitMerges,
  renderMarkdown,
  typeOf,
  workingDays,
} from '../slice-baseline.mjs';

const at = (iso) => Date.parse(iso);
const FRI_NOON = at('2026-10-09T12:00:00Z');
const MON_NOON = at('2026-10-12T12:00:00Z');
const WINDOW = {
  since: at('2026-09-01T00:00:00Z'),
  now: at('2026-10-14T00:00:00Z'),
};

/** One merged change, Monday 09:00 to Tuesday 09:00 (1 working day) by default. */
const change = (over = {}) => ({
  dev: 'dev-one',
  type: 'feat',
  files: 10,
  start: at('2026-10-05T09:00:00Z'),
  end: at('2026-10-06T09:00:00Z'),
  ...over,
});

describe('typeOf', () => {
  it('reads the conventional type at the start of a title', () => {
    assert.strictEqual(typeOf('feat(auth): add login'), 'feat');
    assert.strictEqual(typeOf('Fix: broken link'), 'fix');
  });

  it('treats "feature" as feat', () => {
    assert.strictEqual(typeOf('Feature/billing page'), 'feat');
  });

  it('reads a bracketed type followed by a trailing ticket id', () => {
    assert.strictEqual(typeOf('[Feature] Dim Pins (CU-86bbgd8jz)'), 'feat');
    assert.strictEqual(typeOf('[Fix] Emergency header (CU-86bcdth8t)'), 'fix');
    assert.strictEqual(typeOf('[Chore] Agentify the monorepo'), 'chore');
  });

  it('skips a leading ClickUp or Jira ticket id', () => {
    assert.strictEqual(typeOf('[CU-86c0abc] fix: totals'), 'fix');
    assert.strictEqual(typeOf('CU-86c0abc: refactor(api): split'), 'refactor');
    assert.strictEqual(typeOf('ABC-123 docs: readme'), 'docs');
  });

  it('labels any title mentioning hotfix as hotfix', () => {
    assert.strictEqual(typeOf('[CU-1a] Hotfix prod crash'), 'hotfix');
  });

  it('returns other for titles without a known type', () => {
    assert.strictEqual(typeOf('Update readme'), 'other');
    assert.strictEqual(typeOf(undefined), 'other');
  });
});

describe('workingDays', () => {
  it('counts Friday noon to Monday noon as one working day, not three', () => {
    assert.strictEqual(workingDays(FRI_NOON, MON_NOON), 1);
  });

  it('counts nothing over a weekend', () => {
    assert.strictEqual(
      workingDays(at('2026-10-10T00:00:00Z'), at('2026-10-12T00:00:00Z')),
      0
    );
  });

  it('returns fractions within one day and zero for a reversed range', () => {
    assert.strictEqual(
      workingDays(at('2026-10-12T09:00:00Z'), at('2026-10-12T15:00:00Z')),
      0.25
    );
    assert.strictEqual(workingDays(MON_NOON, FRI_NOON), 0);
  });
});

describe('isRelease', () => {
  it('matches version and release branches and titles only', () => {
    assert.ok(isRelease('v23.0.0'));
    assert.ok(isRelease('V24.0.0 -> Main'));
    assert.ok(isRelease('release-please--branches--main'));
    assert.ok(isRelease('release/2026-10'));
    assert.ok(!isRelease('feat/v2-ui'));
    assert.ok(!isRelease(null));
  });
});

describe('openAtOnce', () => {
  it('counts overlapping changes at 14:00 UTC on weekdays with work open', () => {
    const rows = [
      change({ start: MON_NOON, end: at('2026-10-14T12:00:00Z') }),
      change({ start: MON_NOON, end: at('2026-10-13T12:00:00Z') }),
    ];
    // Mon 14:00 → 2 open; Tue 14:00 → 1 open; Wed 14:00 is after `now`.
    assert.deepStrictEqual(openAtOnce(rows, WINDOW), [2, 1]);
  });
});

describe('buildReport', () => {
  it('returns null below the minimum sample', () => {
    const items = [change(), change(), change(), change()];
    assert.strictEqual(buildReport({ items, ...WINDOW }), null);
  });

  it('summarises all changes, each type with enough samples, and over-24 share', () => {
    const items = [
      ...Array.from({ length: 4 }, () => change()),
      change({ files: 30 }),
      change({ type: 'fix', files: 2 }),
    ];
    const report = buildReport({
      items,
      ...WINDOW,
      source: 'git merge commits',
      windowDays: 43,
    });
    assert.strictEqual(report.count, 6);
    assert.deepStrictEqual(
      report.types.map((t) => t.type),
      ['all', 'feat']
    );
    assert.strictEqual(report.types[0].withinTwoDaysPct, 100);
    assert.strictEqual(report.types[0].overTargetPct, 17);
    assert.strictEqual(report.types[1].overCeilingPct, 0);
  });

  it('leaves out changes merged outside the window', () => {
    const items = Array.from({ length: 5 }, () =>
      change({ end: at('2026-08-01T00:00:00Z') })
    );
    assert.strictEqual(buildReport({ items, ...WINDOW }), null);
  });
});

describe('renderMarkdown', () => {
  it('prints the type table and notes when no developer has enough open days', () => {
    const report = buildReport({
      items: Array.from({ length: 5 }, () => change()),
      ...WINDOW,
      source: 'GitHub merged PRs',
      windowDays: 43,
    });
    const md = renderMarkdown(report);
    assert.match(md, /^Source: GitHub merged PRs · last 43 days · 5 changes/);
    assert.match(
      md,
      /\| all \| 5 \| 1 \| 1 \| 100% \| 10 \| 10 \| 0% \| 0% \|/
    );
    assert.match(md, /no developer with enough open days/);
  });
});

describe('parseGitHubPrs', () => {
  const pr = (over = {}) => ({
    number: 1,
    title: 'feat: a',
    headRefName: 'feat/a',
    createdAt: '2026-10-06T09:00:00Z',
    mergedAt: '2026-10-07T09:00:00Z',
    changedFiles: 7,
    author: { __typename: 'User', login: 'dev-one' },
    commits: { nodes: [{ commit: { authoredDate: '2026-10-05T09:00:00Z' } }] },
    ...over,
  });

  it('starts the clock at the first commit when it predates the PR', () => {
    const [row] = parseGitHubPrs([pr()]);
    assert.strictEqual(row.start, at('2026-10-05T09:00:00Z'));
    assert.strictEqual(row.files, 7);
  });

  it('drops bot and release-branch PRs', () => {
    const rows = parseGitHubPrs([
      pr({ author: { __typename: 'Bot', login: 'dependabot' } }),
      pr({ headRefName: 'v23.0.0' }),
    ]);
    assert.deepStrictEqual(rows, []);
  });

  it('keeps PRs from deleted accounts instead of crashing', () => {
    const [row] = parseGitHubPrs([pr({ author: null, commits: null })]);
    assert.strictEqual(row.dev, 'ghost');
    assert.strictEqual(row.start, at('2026-10-06T09:00:00Z'));
  });
});

describe('git merge parsing', () => {
  it('reads the branch from GitHub and local merge subjects', () => {
    assert.strictEqual(
      mergeHead('Merge pull request #12 from org/feat/login'),
      'feat/login'
    );
    assert.strictEqual(mergeHead("Merge branch 'v23.0.0'"), 'v23.0.0');
    assert.strictEqual(mergeHead('Squashed change'), null);
  });

  it('uses the body line as the title when GitHub wrote one', () => {
    const raw =
      'abc\x1f2026-10-07T09:00:00+00:00\x1fMerge pull request #12 from org/feat/login\x1f[CU-1a] fix: login\n\x1e\n' +
      "def\x1f2026-10-08T09:00:00+00:00\x1fMerge branch 'chore/deps'\x1f\x1e";
    const [first, second] = parseGitMerges(raw);
    assert.strictEqual(first.title, '[CU-1a] fix: login');
    assert.strictEqual(first.end, at('2026-10-07T09:00:00Z'));
    assert.strictEqual(second.title, "Merge branch 'chore/deps'");
    assert.strictEqual(second.head, 'chore/deps');
  });
});

describe('parseArgs and main', () => {
  it('defaults to a 180-day window', () => {
    assert.strictEqual(parseArgs([]).windowDays, 180);
  });

  it('rejects a window that is not a positive whole number', () => {
    assert.throws(() => parseArgs(['--window-days', 'abc']), /positive whole/);
    assert.throws(() => parseArgs(['--window-days', '0']), /positive whole/);
  });

  it('returns the usage exit code for an unknown flag', () => {
    assert.strictEqual(main(['--nope']), EXIT_USAGE);
  });
});
