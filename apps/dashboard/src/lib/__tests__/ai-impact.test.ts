import {
  computeAiImpact,
  detectAiSignals,
  percentile,
  relativeDelta,
  sizeBucket,
  type PullRequestRecord,
  type TelemetryLinks,
} from '../ai-impact';

const noLinks: TelemetryLinks = { branches: new Set(), prNumbers: new Set() };

let nextNumber = 1;
/** A PR whose first commit is `cycleHours` before its merge. */
const pr = (overrides: Partial<PullRequestRecord> & { cycleHours?: number } = {}): PullRequestRecord => {
  const { cycleHours = 10, ...rest } = overrides;
  const merged = Date.parse('2026-10-01T00:00:00Z');
  return {
    number: nextNumber++,
    title: `Change ${nextNumber}`,
    body: '',
    headRefName: `feat/x-${nextNumber}`,
    authorLogin: 'dev',
    authorIsBot: false,
    createdAt: new Date(merged - (cycleHours / 2) * 3_600_000).toISOString(),
    mergedAt: new Date(merged).toISOString(),
    firstCommitAt: new Date(merged - cycleHours * 3_600_000).toISOString(),
    firstReviewAt: null,
    additions: 20,
    deletions: 5,
    commitMessages: ['fix: thing'],
    ...rest,
  };
};

describe('detectAiSignals', () => {
  it('finds an AI co-author trailer in any commit', () => {
    const p = pr({ commitMessages: ['feat: x\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'] });
    expect(detectAiSignals(p, noLinks)).toEqual(['commit-trailer']);
  });

  it('links a PR to TLS telemetry by branch or PR number', () => {
    const p = pr({ headRefName: 'feat/update-metrics' });
    expect(detectAiSignals(p, { branches: new Set(['feat/update-metrics']), prNumbers: new Set() })).toEqual([
      'telemetry',
    ]);
    expect(detectAiSignals(p, { branches: new Set(), prNumbers: new Set([p.number]) })).toEqual(['telemetry']);
  });

  it('recognises PR-body markers and AI coding-agent authors', () => {
    expect(detectAiSignals(pr({ body: '🤖 Generated with [Claude Code](https://claude.com/claude-code)' }), noLinks)).toEqual([
      'pr-body',
    ]);
    expect(detectAiSignals(pr({ authorLogin: 'google-labs-jules[bot]', authorIsBot: true }), noLinks)).toEqual([
      'ai-agent-author',
    ]);
  });

  it('does not treat a human co-author as AI', () => {
    expect(detectAiSignals(pr({ commitMessages: ['x\n\nCo-Authored-By: Sam <sam@example.com>'] }), noLinks)).toEqual([]);
  });
});

describe('statistics', () => {
  it('interpolates percentiles linearly (type 7)', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], 0.75)).toBe(3.25);
    expect(percentile([], 0.5)).toBeNull();
  });

  it('buckets PR size by changed lines', () => {
    expect([sizeBucket(49), sizeBucket(50), sizeBucket(499), sizeBucket(500)]).toEqual(['XS', 'S', 'M', 'L']);
  });

  it('returns no relative delta against a zero or missing baseline', () => {
    expect(relativeDelta(5, 10)).toBe(-0.5);
    expect(relativeDelta(5, 0)).toBeNull();
    expect(relativeDelta(null, 10)).toBeNull();
  });
});

describe('computeAiImpact', () => {
  const aiTrailer = ['feat\n\nCo-Authored-By: Claude <noreply@anthropic.com>'];

  it('compares cohort medians when both reach the minimum sample', () => {
    const prs = [
      ...[2, 4, 6, 8, 10].map((h) => pr({ cycleHours: h, commitMessages: aiTrailer })),
      ...[10, 20, 30, 40, 50].map((h) => pr({ cycleHours: h })),
    ];

    const report = computeAiImpact({ prs, links: noLinks, windowDays: 14 });

    expect(report.sufficient).toBe(true);
    expect(report.ai.n).toBe(5);
    expect(report.human.n).toBe(5);
    expect(report.ai.cycleHours.median).toBeCloseTo(6);
    expect(report.human.cycleHours.median).toBeCloseTo(30);
    expect(report.deltas.cycleMedian).toBeCloseTo(-0.8);
    expect(report.ai.mergedPerWeek).toBeCloseTo(2.5);
    expect(report.signalCounts['commit-trailer']).toBe(5);
  });

  it('withholds deltas when a cohort is below the minimum sample', () => {
    const prs = [pr({ commitMessages: aiTrailer }), ...[1, 2, 3, 4, 5].map((h) => pr({ cycleHours: h }))];

    const report = computeAiImpact({ prs, links: noLinks, windowDays: 14 });

    expect(report.sufficient).toBe(false);
    expect(report.deltas.cycleMedian).toBeNull();
    expect(report.sizeAdjustedCycle.delta).toBeNull();
  });

  it('excludes dependency bots and revert PRs, and counts the reverted PR as a failure', () => {
    const reverted = pr({ title: 'Add cache layer' });
    const prs = [
      reverted,
      pr({ title: 'Revert "Add cache layer"' }),
      pr({ authorLogin: 'dependabot[bot]', authorIsBot: true }),
      pr({ authorLogin: 'google-labs-jules[bot]', authorIsBot: true }),
    ];

    const report = computeAiImpact({ prs, links: noLinks, windowDays: 7 });

    expect(report.excluded).toEqual({ bots: 1, reverts: 1 });
    expect(report.human.n).toBe(1);
    expect(report.human.revertRate).toBe(1);
    expect(report.ai.n).toBe(1); // Jules is an AI coding agent, not an excluded bot
  });

  it('splits review time from pickup time and reports unreviewed PRs', () => {
    const reviewed = pr({
      createdAt: '2026-09-30T00:00:00Z',
      firstReviewAt: '2026-09-30T06:00:00Z',
      mergedAt: '2026-09-30T08:00:00Z',
      firstCommitAt: '2026-09-29T00:00:00Z',
    });
    const report = computeAiImpact({ prs: [reviewed, pr()], links: noLinks, windowDays: 7 });

    expect(report.human.pickupHoursMedian).toBe(6);
    expect(report.human.reviewHoursMedian).toBe(2);
    expect(report.human.unreviewedShare).toBe(0.5);
  });

  it('adjusts the cycle-time delta for PR size, ignoring thin buckets', () => {
    const small = { additions: 10, deletions: 0 };
    const large = { additions: 600, deletions: 0 };
    const prs = [
      // AI PRs are mostly small and fast; human PRs mostly large and slow.
      ...[1, 1, 1, 1].map((h) => pr({ cycleHours: h * 4, commitMessages: aiTrailer, ...small })),
      pr({ cycleHours: 40, commitMessages: aiTrailer, ...large }),
      ...[4, 4, 4].map((h) => pr({ cycleHours: h, ...small })),
      ...[40, 40, 40].map((h) => pr({ cycleHours: h, ...large })),
    ];

    const report = computeAiImpact({ prs, links: noLinks, windowDays: 14 });

    // XS: both cohorts at 4h → 0%. L: AI has 1 PR (< 3) → bucket ignored.
    expect(report.sizeAdjustedCycle).toEqual({ delta: 0, bucketsUsed: ['XS'] });
    // The unadjusted median still shows a large apparent speed-up from the size mix.
    expect(report.deltas.cycleMedian).toBeLessThan(-0.5);
  });
});
