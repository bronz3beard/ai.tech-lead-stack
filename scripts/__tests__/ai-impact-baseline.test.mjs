import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  MIN_SAMPLE,
  buildDeltas,
  ciStats,
  commitAiSignals,
  commitStats,
  detectFirstAiCommit,
  issueStats,
  parseArgs,
  parseGitHubOrigin,
  parseGitLog,
  percentile,
  prAiSignals,
  prStats,
  relativeDelta,
  renderMarkdown,
  splitWindows,
  weeklySeries,
} from '../ai-impact-baseline.mjs';

const REC = '\x1e';
const F = '\x1f';

/** One commit in the exact shape `git log --format=... --numstat` prints. */
const gitRecord = ({
  sha = 'a'.repeat(40),
  date = '2026-01-10T10:00:00+00:00',
  name = 'Dev One',
  email = 'dev@example.com',
  parents = 'p1',
  body = 'feat: add thing',
  numstat = '10\t2\tsrc/a.ts\n',
}) =>
  `${REC}${sha}${F}${date}${F}${name}${F}${email}${F}${parents}${F}${body}\n${F}\n${numstat}`;

const commit = (overrides = {}) => ({
  sha: 'c'.repeat(40),
  date: '2026-01-10T10:00:00Z',
  authorName: 'Dev One',
  authorEmail: 'dev@example.com',
  isMerge: false,
  subject: 'feat: add thing',
  body: 'feat: add thing',
  added: 10,
  deleted: 2,
  files: 1,
  testLines: 0,
  ...overrides,
});

const WINDOW = {
  from: '2026-01-01T00:00:00.000Z',
  to: '2026-01-29T00:00:00.000Z',
};

describe('parseGitLog', () => {
  it('parses commits, sums numstat and flags test paths and merges', () => {
    const raw =
      gitRecord({
        numstat:
          '10\t2\tsrc/a.ts\n5\t1\tsrc/__tests__/a.test.ts\n-\t-\timg.png\n',
      }) +
      gitRecord({
        sha: 'b'.repeat(40),
        date: '2026-01-05T10:00:00+00:00',
        parents: 'p1 p2',
        body: 'Merge branch',
        numstat: '',
      });
    const commits = parseGitLog(raw);
    assert.strictEqual(commits.length, 2);
    // Sorted oldest first.
    assert.strictEqual(commits[0].subject, 'Merge branch');
    assert.strictEqual(commits[0].isMerge, true);
    const feat = commits[1];
    assert.deepStrictEqual(
      {
        added: feat.added,
        deleted: feat.deleted,
        files: feat.files,
        testLines: feat.testLines,
      },
      { added: 15, deleted: 3, files: 3, testLines: 6 }
    );
  });
});

describe('AI signal detection', () => {
  it('matches the same signals as the dashboard: trailer, body marker, agent author', () => {
    assert.deepStrictEqual(
      commitAiSignals(
        commit({
          body: 'fix: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
        })
      ),
      ['commit-trailer']
    );
    assert.deepStrictEqual(
      commitAiSignals(commit({ body: 'feat: y\n\nGenerated with [Cursor]' })),
      ['body-marker']
    );
    assert.deepStrictEqual(
      commitAiSignals(
        commit({
          authorName: 'google-labs-jules[bot]',
          authorEmail: '1+google-labs-jules[bot]@users.noreply.github.com',
        })
      ),
      ['ai-agent-author']
    );
    assert.deepStrictEqual(
      commitAiSignals(commit({ body: 'feat: talk about AI in the roadmap' })),
      []
    );
  });

  it('classifies pull requests the same way', () => {
    const pr = {
      body: '',
      commitMessages: ['feat\n\nCo-authored-by: Copilot <c@github.com>'],
      authorLogin: 'dev',
    };
    assert.deepStrictEqual(prAiSignals(pr), ['commit-trailer']);
    assert.deepStrictEqual(
      prAiSignals({
        body: 'Generated with Claude Code',
        commitMessages: [],
        authorLogin: 'codex[bot]',
      }),
      ['pr-body', 'ai-agent-author']
    );
  });
});

describe('detectFirstAiCommit', () => {
  it('returns the earliest commit with a hard signal', () => {
    const commits = [
      commit({
        sha: '1',
        date: '2026-01-01T00:00:00Z',
        subject: 'chore: use AI later',
        body: 'chore: use AI later',
      }),
      commit({
        sha: '2',
        date: '2026-02-01T00:00:00Z',
        body: 'feat\n\nCo-authored-by: Gemini <g@google.com>',
      }),
      commit({
        sha: '3',
        date: '2026-03-01T00:00:00Z',
        body: 'feat\n\nCo-authored-by: Claude <c@anthropic.com>',
      }),
    ];
    const { detected, hints } = detectFirstAiCommit(commits);
    assert.strictEqual(detected.sha, '2');
    assert.deepStrictEqual(detected.signals, ['commit-trailer']);
    assert.strictEqual(hints.length, 1);
    assert.strictEqual(hints[0].sha, '1');
  });

  it('returns null plus mention hints when nothing hard is found', () => {
    const { detected, hints } = detectFirstAiCommit([
      commit({ sha: '1', subject: 'docs: add copilot setup guide' }),
      commit({ sha: '2', subject: 'feat: plain work' }),
    ]);
    assert.strictEqual(detected, null);
    assert.deepStrictEqual(
      hints.map((h) => h.sha),
      ['1']
    );
  });
});

describe('splitWindows', () => {
  const base = {
    cutoffStart: '2026-03-01T00:00:00Z',
    firstCommitAt: '2025-12-01T00:00:00Z',
    now: '2026-06-01T00:00:00Z',
  };

  it('makes two equal windows bounded by the shorter side of history', () => {
    const w = splitWindows(base);
    // 90 days before (Dec 1 → Mar 1) is shorter than 92 days after.
    assert.strictEqual(w.days, 90);
    assert.strictEqual(w.truncatedBy, 'before');
    assert.strictEqual(w.before.to, '2026-03-01T00:00:00.000Z');
    assert.strictEqual(w.after.from, '2026-03-01T00:00:00.000Z');
    assert.strictEqual(
      Date.parse(w.before.to) - Date.parse(w.before.from),
      Date.parse(w.after.to) - Date.parse(w.after.from)
    );
  });

  it('excludes a suspected range as a transition period and honours --window-days', () => {
    const w = splitWindows({
      ...base,
      cutoffEnd: '2026-03-15T00:00:00Z',
      maxDays: 30,
    });
    assert.strictEqual(w.days, 30);
    assert.strictEqual(w.before.to, '2026-03-01T00:00:00.000Z');
    assert.strictEqual(w.after.from, '2026-03-15T00:00:00.000Z');
  });

  it('refuses when a side has no history', () => {
    assert.throws(
      () => splitWindows({ ...base, firstCommitAt: '2026-03-01T00:00:00Z' }),
      /Not enough history/
    );
    assert.throws(
      () => splitWindows({ ...base, cutoffEnd: '2026-02-01T00:00:00Z' }),
      /--cutoff-end/
    );
  });
});

describe('commitStats', () => {
  it('counts only commits inside the window and derives shares and medians', () => {
    const commits = [
      commit({ date: '2025-12-31T23:00:00Z' }), // outside
      commit({
        date: '2026-01-02T00:00:00Z',
        added: 100,
        deleted: 0,
        files: 4,
        testLines: 50,
      }),
      commit({
        date: '2026-01-03T00:00:00Z',
        subject: 'fix: crash',
        body: 'fix: crash\n\nCo-authored-by: Claude <c@a.com>',
        added: 10,
        deleted: 10,
        files: 2,
        authorEmail: 'two@example.com',
      }),
      commit({
        date: '2026-01-04T00:00:00Z',
        subject: 'Revert "feat: x"',
        body: 'Revert "feat: x"',
        added: 0,
        deleted: 20,
        files: 1,
      }),
      commit({
        date: '2026-01-05T00:00:00Z',
        isMerge: true,
        added: 0,
        deleted: 0,
        files: 0,
      }),
    ];
    const s = commitStats(commits, WINDOW);
    assert.strictEqual(s.commits, 4);
    assert.strictEqual(s.mergeCommits, 1);
    assert.strictEqual(s.commitsPerWeek, 1);
    assert.strictEqual(s.activeAuthors, 2);
    assert.strictEqual(s.linesAdded, 110);
    assert.strictEqual(s.linesDeleted, 30);
    assert.strictEqual(s.changedLinesPerCommitMedian, 20);
    assert.strictEqual(s.filesPerCommitMedian, 2);
    assert.strictEqual(s.testLineShare, 0.3571);
    assert.strictEqual(s.fixCommitShare, 0.3333);
    assert.strictEqual(s.revertCommits, 1);
    assert.strictEqual(s.aiAssistedCommits, 1);
  });
});

describe('prStats', () => {
  const pr = (o = {}) => ({
    number: 1,
    title: 'feat: a',
    body: '',
    headRefName: 'feat/a',
    authorLogin: 'dev',
    authorIsBot: false,
    createdAt: '2026-01-02T00:00:00Z',
    mergedAt: '2026-01-03T00:00:00Z',
    firstCommitAt: '2026-01-01T00:00:00Z',
    firstReviewAt: '2026-01-02T12:00:00Z',
    reviewCount: 1,
    commentCount: 2,
    commitCount: 3,
    additions: 40,
    deletions: 10,
    changedFiles: 2,
    commitMessages: ['feat: a'],
    ...o,
  });

  it('excludes dependency bots and revert PRs, and computes cycle, pickup and revert rate', () => {
    const prs = [
      pr(),
      pr({
        number: 2,
        title: 'feat: b',
        firstReviewAt: null,
        reviewCount: 0,
        commentCount: 0,
      }),
      pr({ number: 3, title: 'Revert "feat: a"' }),
      pr({ number: 4, authorLogin: 'dependabot[bot]', authorIsBot: true }),
      pr({ number: 5, mergedAt: '2026-02-10T00:00:00Z' }), // outside window
    ];
    const s = prStats(prs, WINDOW);
    assert.strictEqual(s.mergedPrs, 2);
    assert.strictEqual(s.excludedBotPrs, 1);
    assert.strictEqual(s.excludedRevertPrs, 1);
    assert.strictEqual(s.cycleHoursMedian, 48);
    assert.strictEqual(s.pickupHoursMedian, 12);
    assert.strictEqual(s.reviewHoursMedian, 12);
    assert.strictEqual(s.unreviewedShare, 0.5);
    assert.strictEqual(s.revertRate, 0.5);
    assert.strictEqual(s.reviewCommentsMedian, 1.5);
    assert.strictEqual(s.prSizeMedian, 50);
  });

  it('keeps AI coding agents as tasks even though GitHub flags them as bots', () => {
    const s = prStats(
      [pr({ authorLogin: 'copilot-swe-agent[bot]', authorIsBot: true })],
      WINDOW
    );
    assert.strictEqual(s.mergedPrs, 1);
    assert.strictEqual(s.aiAssistedPrs, 1);
  });
});

describe('issueStats, ciStats', () => {
  it('summarises issues opened in the window', () => {
    const s = issueStats(
      [
        {
          createdAt: '2026-01-02T00:00:00Z',
          closedAt: '2026-01-04T00:00:00Z',
          authorLogin: 'dev',
          labels: ['bug'],
        },
        {
          createdAt: '2026-01-05T00:00:00Z',
          closedAt: null,
          authorLogin: 'dev',
          labels: [],
        },
        {
          createdAt: '2026-01-05T00:00:00Z',
          closedAt: null,
          authorLogin: 'dependabot[bot]',
          labels: [],
        },
      ],
      WINDOW
    );
    assert.deepStrictEqual(s, {
      issuesOpened: 2,
      issuesClosed: 1,
      closedShare: 0.5,
      timeToCloseHoursMedian: 48,
      bugLabelledShare: 0.5,
    });
  });

  it('computes CI success rate from decided runs only', () => {
    const run = (conclusion, mins) => ({
      created_at: '2026-01-02T00:00:00Z',
      run_started_at: '2026-01-02T00:00:00Z',
      updated_at: `2026-01-02T00:${String(mins).padStart(2, '0')}:00Z`,
      conclusion,
    });
    const s = ciStats(
      [run('success', 10), run('failure', 20), run('cancelled', 1)],
      WINDOW
    );
    assert.deepStrictEqual(s, {
      workflowRuns: 3,
      failedRuns: 1,
      successRate: 0.5,
      runDurationMinutesMedian: 10,
    });
  });
});

describe('deltas and rendering', () => {
  it('marks direction and favourability per metric', () => {
    const d = buildDeltas(
      {
        commitsPerWeek: 10,
        cycleHoursMedian: 40,
        revertRate: 0,
        linesDeleted: 100,
      },
      {
        commitsPerWeek: 15,
        cycleHoursMedian: 20,
        revertRate: 0.1,
        linesDeleted: 300,
      }
    );
    assert.strictEqual(d.commitsPerWeek.relative, 0.5);
    assert.strictEqual(d.commitsPerWeek.favourable, true);
    assert.strictEqual(d.cycleHoursMedian.favourable, true);
    assert.strictEqual(d.revertRate.relative, null); // baseline 0
    assert.strictEqual(d.revertRate.direction, 'flat');
    // Raw volume has no accepted direction.
    assert.strictEqual(d.linesDeleted.direction, 'up');
    assert.strictEqual(d.linesDeleted.favourable, null);
  });

  it('renders the markdown report with windows, caveat and tables', () => {
    const windows = splitWindows({
      cutoffStart: '2026-03-01T00:00:00Z',
      firstCommitAt: '2025-12-01T00:00:00Z',
      now: '2026-06-01T00:00:00Z',
    });
    const before = { commits: 3, commitsPerWeek: 1 };
    const after = { commits: 9, commitsPerWeek: 3 };
    const md = renderMarkdown({
      repo: { dir: '/r', branch: 'main' },
      cutoff: {
        start: windows.before.to,
        end: windows.before.to,
        source: 'detected',
        detected: { sha: 'abcdef1234', subject: 'feat: first ai' },
      },
      windows,
      sufficient: false,
      git: { before, after },
      github: { status: 'skipped', reason: 'origin is not github.com' },
      deltas: { git: buildDeltas(before, after), github: {} },
    });
    assert.match(md, /Cutoff: \*\*2026-03-01\*\*/);
    assert.match(md, new RegExp(`fewer than ${MIN_SAMPLE} commits`));
    assert.match(md, /\| commitsPerWeek \| 1 \| 3 \| \+200% \| better \|/);
    assert.match(md, /GitHub metrics skipped: origin is not github.com/);
  });
});

describe('helpers', () => {
  it('percentile and relativeDelta behave like the dashboard versions', () => {
    assert.strictEqual(percentile([], 0.5), null);
    assert.strictEqual(percentile([1, 2, 3, 4], 0.5), 2.5);
    assert.strictEqual(percentile([1, 2, 3, 4], 0.75), 3.25);
    assert.strictEqual(relativeDelta(15, 10), 0.5);
    assert.strictEqual(relativeDelta(1, 0), null);
    assert.strictEqual(relativeDelta(null, 2), null);
  });

  it('recognises GitHub origins in https and ssh form only', () => {
    assert.deepStrictEqual(parseGitHubOrigin('git@github.com:acme/app.git'), {
      owner: 'acme',
      repo: 'app',
    });
    assert.deepStrictEqual(parseGitHubOrigin('https://github.com/acme/app'), {
      owner: 'acme',
      repo: 'app',
    });
    assert.strictEqual(
      parseGitHubOrigin('https://bitbucket.org/acme/app.git'),
      null
    );
  });

  it('buckets commits and merged PRs by ISO week and cohort', () => {
    const windows = {
      before: { from: '2026-01-01T00:00:00Z', to: '2026-01-15T00:00:00Z' },
      after: { from: '2026-01-15T00:00:00Z', to: '2026-01-29T00:00:00Z' },
    };
    const rows = weeklySeries(
      [
        commit({ date: '2026-01-06T00:00:00Z' }),
        commit({ date: '2026-01-07T00:00:00Z' }),
        commit({ date: '2026-01-20T00:00:00Z' }),
      ],
      windows,
      [{ mergedAt: '2026-01-21T00:00:00Z' }]
    );
    assert.deepStrictEqual(rows, [
      { weekStart: '2026-01-05', cohort: 'before', commits: 2, prsMerged: 0 },
      { weekStart: '2026-01-19', cohort: 'after', commits: 1, prsMerged: 1 },
    ]);
  });

  it('validates CLI arguments', () => {
    assert.strictEqual(
      parseArgs(['--cutoff', '2026-03-01', '--no-github']).github,
      false
    );
    assert.throws(
      () => parseArgs(['--cutoff-end', '2026-03-01']),
      /--cutoff-end needs --cutoff/
    );
    assert.throws(
      () => parseArgs(['--cutoff', 'yesterday']),
      /not a valid date/
    );
    assert.throws(() => parseArgs(['--window-days', '0']), /positive integer/);
    assert.throws(() => parseArgs(['--bogus']), /Unknown argument/);
  });
});
