/**
 * BETA: task outcomes with AI vs without, per project.
 *
 * Unit of work: a merged pull request. Definitions follow common engineering-
 * metrics practice (DORA lead time for changes; the LinearB/DX "PR cycle time"
 * breakdown into coding, pickup and review time). Cohorts are compared on
 * medians and p75 because cycle times are heavily right-skewed, and only when
 * both cohorts reach MIN_SAMPLE. Cohorts are self-selected, so every delta is a
 * correlation, not a causal effect. Pure functions only; fetching lives in
 * GitHubClient.listMergedPullRequests.
 */

export const MIN_SAMPLE = 5;
const MIN_BUCKET_SAMPLE = 3;
const HOUR_MS = 60 * 60 * 1000;

/** One merged PR, as plain JSON (it is cached between requests). */
export interface PullRequestRecord {
  number: number;
  title: string;
  body: string;
  headRefName: string;
  authorLogin: string | null;
  authorIsBot: boolean;
  createdAt: string;
  mergedAt: string;
  /** Earliest commit authored date; null when GitHub returned no commits. */
  firstCommitAt: string | null;
  firstReviewAt: string | null;
  additions: number;
  deletions: number;
  commitMessages: string[];
}

export type AiSignal = 'telemetry' | 'commit-trailer' | 'pr-body' | 'ai-agent-author';

export interface TelemetryLinks {
  branches: Set<string>;
  prNumbers: Set<number>;
}

const AI_TOOL = String.raw`(claude|anthropic|copilot|cursor|gemini|jules|codex|devin|openai)`;
const AI_COAUTHOR = new RegExp(String.raw`^co-authored-by:.*${AI_TOOL}`, 'im');
const AI_BODY_MARKER = new RegExp(String.raw`generated (with|by) \[?${AI_TOOL}`, 'i');
const AI_AGENT_BOT = /^(google-labs-jules|copilot-swe-agent|devin-ai-integration|claude|codex)(\[bot\])?$/i;
const REVERT_TITLE = /^Revert "(.+)"$/;

export function isAiAgentAuthor(login: string | null): boolean {
  return Boolean(login && AI_AGENT_BOT.test(login));
}

/** Every signal that marks this PR as AI-assisted; empty means not AI-assisted. */
export function detectAiSignals(pr: PullRequestRecord, links: TelemetryLinks): AiSignal[] {
  const signals: AiSignal[] = [];
  if (links.branches.has(pr.headRefName) || links.prNumbers.has(pr.number)) signals.push('telemetry');
  if (pr.commitMessages.some((m) => AI_COAUTHOR.test(m))) signals.push('commit-trailer');
  if (AI_BODY_MARKER.test(pr.body)) signals.push('pr-body');
  if (isAiAgentAuthor(pr.authorLogin)) signals.push('ai-agent-author');
  return signals;
}

/** Linear-interpolation percentile (Hyndman–Fan type 7, the spreadsheet default). */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * p;
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

export type SizeBucket = 'XS' | 'S' | 'M' | 'L';

/** Changed-line buckets commonly used to normalise PR metrics by size. */
export function sizeBucket(changedLines: number): SizeBucket {
  if (changedLines < 50) return 'XS';
  if (changedLines < 200) return 'S';
  if (changedLines < 500) return 'M';
  return 'L';
}

function hoursBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const h = (Date.parse(to) - Date.parse(from)) / HOUR_MS;
  return Number.isFinite(h) && h >= 0 ? h : null;
}

const notNull = <T>(v: T | null): v is T => v !== null;

export interface CohortStats {
  n: number;
  /** First commit → merge (DORA lead-time proxy). */
  cycleHours: { median: number | null; p75: number | null };
  /** First commit → PR opened. */
  codingHoursMedian: number | null;
  /** PR opened → first review; reviewed PRs only. */
  pickupHoursMedian: number | null;
  /** First review → merge; reviewed PRs only. */
  reviewHoursMedian: number | null;
  prSizeMedian: number | null;
  /** Share of PRs merged with no review at all. */
  unreviewedShare: number;
  /** Change-failure proxy: share later reverted by a `Revert "<title>"` PR in the window. */
  revertRate: number;
  mergedPerWeek: number;
}

interface ClassifiedPr extends PullRequestRecord {
  cycleHours: number | null;
  size: number;
  reverted: boolean;
}

function cohortStats(prs: ClassifiedPr[], windowDays: number): CohortStats {
  const reviewed = prs.filter((p) => p.firstReviewAt);
  const cycles = prs.map((p) => p.cycleHours).filter(notNull);
  return {
    n: prs.length,
    cycleHours: { median: percentile(cycles, 0.5), p75: percentile(cycles, 0.75) },
    codingHoursMedian: percentile(prs.map((p) => hoursBetween(p.firstCommitAt, p.createdAt)).filter(notNull), 0.5),
    pickupHoursMedian: percentile(reviewed.map((p) => hoursBetween(p.createdAt, p.firstReviewAt)).filter(notNull), 0.5),
    reviewHoursMedian: percentile(reviewed.map((p) => hoursBetween(p.firstReviewAt, p.mergedAt)).filter(notNull), 0.5),
    prSizeMedian: percentile(prs.map((p) => p.size), 0.5),
    unreviewedShare: prs.length ? (prs.length - reviewed.length) / prs.length : 0,
    revertRate: prs.length ? prs.filter((p) => p.reverted).length / prs.length : 0,
    mergedPerWeek: windowDays > 0 ? prs.length / (windowDays / 7) : 0,
  };
}

/** (ai − baseline) ÷ baseline; null when either side is missing or the baseline is 0. */
export function relativeDelta(ai: number | null, baseline: number | null): number | null {
  if (ai === null || baseline === null || baseline === 0) return null;
  return (ai - baseline) / baseline;
}

/**
 * Size-adjusted cycle-time delta: the per-bucket relative delta of medians,
 * weighted by how many PRs each bucket holds. Buckets where either cohort has
 * fewer than MIN_BUCKET_SAMPLE PRs are left out, so a skewed size mix cannot
 * pass for a speed-up.
 */
function sizeAdjustedCycleDelta(ai: ClassifiedPr[], human: ClassifiedPr[]) {
  let weighted = 0;
  let weight = 0;
  const bucketsUsed: SizeBucket[] = [];
  for (const bucket of ['XS', 'S', 'M', 'L'] as const) {
    const a = ai.filter((p) => sizeBucket(p.size) === bucket).map((p) => p.cycleHours).filter(notNull);
    const h = human.filter((p) => sizeBucket(p.size) === bucket).map((p) => p.cycleHours).filter(notNull);
    if (a.length < MIN_BUCKET_SAMPLE || h.length < MIN_BUCKET_SAMPLE) continue;
    const delta = relativeDelta(percentile(a, 0.5), percentile(h, 0.5));
    if (delta === null) continue;
    weighted += delta * (a.length + h.length);
    weight += a.length + h.length;
    bucketsUsed.push(bucket);
  }
  return { delta: weight > 0 ? weighted / weight : null, bucketsUsed };
}

export interface AiImpactReport {
  windowDays: number;
  /** Merged PRs fetched before exclusions. */
  fetched: number;
  excluded: { bots: number; reverts: number };
  ai: CohortStats;
  human: CohortStats;
  signalCounts: Record<AiSignal, number>;
  /** Both cohorts have at least MIN_SAMPLE PRs; deltas are null otherwise. */
  sufficient: boolean;
  deltas: {
    cycleMedian: number | null;
    cycleP75: number | null;
    pickupMedian: number | null;
    reviewMedian: number | null;
    prSizeMedian: number | null;
    /** Percentage-point difference (ai − human). */
    revertRatePoints: number | null;
  };
  sizeAdjustedCycle: { delta: number | null; bucketsUsed: SizeBucket[] };
}

export function computeAiImpact(input: {
  prs: PullRequestRecord[];
  links: TelemetryLinks;
  windowDays: number;
}): AiImpactReport {
  const revertedTitles = new Set(
    input.prs.map((p) => p.title.match(REVERT_TITLE)?.[1]).filter((t): t is string => Boolean(t))
  );

  let bots = 0;
  let reverts = 0;
  const ai: ClassifiedPr[] = [];
  const human: ClassifiedPr[] = [];
  const signalCounts: Record<AiSignal, number> = {
    telemetry: 0,
    'commit-trailer': 0,
    'pr-body': 0,
    'ai-agent-author': 0,
  };

  for (const pr of input.prs) {
    // Dependency and release bots are not tasks; AI coding agents are.
    if (pr.authorIsBot && !isAiAgentAuthor(pr.authorLogin)) {
      bots++;
      continue;
    }
    if (REVERT_TITLE.test(pr.title)) {
      reverts++;
      continue;
    }
    const classified: ClassifiedPr = {
      ...pr,
      cycleHours: hoursBetween(pr.firstCommitAt ?? pr.createdAt, pr.mergedAt),
      size: pr.additions + pr.deletions,
      reverted: revertedTitles.has(pr.title),
    };
    const signals = detectAiSignals(pr, input.links);
    for (const s of signals) signalCounts[s]++;
    (signals.length > 0 ? ai : human).push(classified);
  }

  const aiStats = cohortStats(ai, input.windowDays);
  const humanStats = cohortStats(human, input.windowDays);
  const sufficient = ai.length >= MIN_SAMPLE && human.length >= MIN_SAMPLE;
  const d = (a: number | null, b: number | null) => (sufficient ? relativeDelta(a, b) : null);

  return {
    windowDays: input.windowDays,
    fetched: input.prs.length,
    excluded: { bots, reverts },
    ai: aiStats,
    human: humanStats,
    signalCounts,
    sufficient,
    deltas: {
      cycleMedian: d(aiStats.cycleHours.median, humanStats.cycleHours.median),
      cycleP75: d(aiStats.cycleHours.p75, humanStats.cycleHours.p75),
      pickupMedian: d(aiStats.pickupHoursMedian, humanStats.pickupHoursMedian),
      reviewMedian: d(aiStats.reviewHoursMedian, humanStats.reviewHoursMedian),
      prSizeMedian: d(aiStats.prSizeMedian, humanStats.prSizeMedian),
      revertRatePoints: sufficient ? (aiStats.revertRate - humanStats.revertRate) * 100 : null,
    },
    sizeAdjustedCycle: sufficient
      ? sizeAdjustedCycleDelta(ai, human)
      : { delta: null, bucketsUsed: [] },
  };
}
