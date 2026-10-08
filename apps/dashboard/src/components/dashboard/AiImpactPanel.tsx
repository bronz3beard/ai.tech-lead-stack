import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MIN_SAMPLE, type AiSignal, type CohortStats } from '@/lib/ai-impact';
import type { AiImpactResult } from '@/lib/ai-impact-loader';

const hours = (h: number | null) => {
  if (h === null) return '—';
  return h < 48 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;
};
const lines = (n: number | null) => (n === null ? '—' : Math.round(n).toLocaleString());
const share = (n: number) => `${(n * 100).toFixed(0)}%`;
const delta = (d: number | null) => {
  if (d === null) return '—';
  const pct = Math.round(d * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
};
const points = (p: number | null) =>
  p === null ? '—' : `${p > 0 ? '+' : ''}${p.toFixed(1)} pts`;

const SIGNAL_LABEL: Record<AiSignal, string> = {
  telemetry: 'TLS telemetry on the branch',
  'commit-trailer': 'AI co-author commit trailer',
  'pr-body': 'AI marker in PR description',
  'ai-agent-author': 'Opened by an AI coding agent',
};

interface Row {
  label: string;
  hint: string;
  ai: string;
  human: string;
  diff: string;
}

function rows(ai: CohortStats, human: CohortStats, deltas: Extract<AiImpactResult, { status: 'ok' }>['report']['deltas']): Row[] {
  return [
    { label: 'Cycle time (median)', hint: 'First commit → merge', ai: hours(ai.cycleHours.median), human: hours(human.cycleHours.median), diff: delta(deltas.cycleMedian) },
    { label: 'Cycle time (p75)', hint: 'Slowest quarter starts here', ai: hours(ai.cycleHours.p75), human: hours(human.cycleHours.p75), diff: delta(deltas.cycleP75) },
    { label: 'Coding time', hint: 'First commit → PR opened', ai: hours(ai.codingHoursMedian), human: hours(human.codingHoursMedian), diff: '—' },
    { label: 'Pickup time', hint: 'PR opened → first review', ai: hours(ai.pickupHoursMedian), human: hours(human.pickupHoursMedian), diff: delta(deltas.pickupMedian) },
    { label: 'Review time', hint: 'First review → merge', ai: hours(ai.reviewHoursMedian), human: hours(human.reviewHoursMedian), diff: delta(deltas.reviewMedian) },
    { label: 'PR size (median)', hint: 'Lines added + deleted', ai: lines(ai.prSizeMedian), human: lines(human.prSizeMedian), diff: delta(deltas.prSizeMedian) },
    { label: 'Merged without review', hint: 'Share of PRs', ai: share(ai.unreviewedShare), human: share(human.unreviewedShare), diff: '—' },
    { label: 'Revert rate', hint: 'Change-failure proxy', ai: share(ai.revertRate), human: share(human.revertRate), diff: points(deltas.revertRatePoints) },
    { label: 'Throughput', hint: 'Merged PRs per week', ai: ai.mergedPerWeek.toFixed(1), human: human.mergedPerWeek.toFixed(1), diff: '—' },
  ];
}

export function AiImpactPanel({ result }: { result: AiImpactResult }) {
  return (
    <Card className="bg-card overflow-hidden">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold">Task Outcomes: With AI vs Without</CardTitle>
          <span className="text-[10px] font-bold uppercase tracking-wider rounded-full border border-amber-500/50 text-amber-500 px-2 py-0.5">
            Beta
          </span>
        </div>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer">How this is measured</summary>
          <p className="mt-2">
            Each merged pull request is one task. A PR is <strong>AI-assisted</strong> when TLS
            recorded skill or LLM activity on its branch, a commit carries an AI co-author trailer,
            its description has an AI &ldquo;Generated with&rdquo; marker, or an AI coding agent
            opened it. Dependency and release bots and revert PRs are excluded. Groups are compared
            on medians; differences need at least {MIN_SAMPLE} PRs in each group. The groups choose
            themselves, so differences show correlation, not cause.
          </p>
        </details>
      </CardHeader>
      <CardContent>
        {result.status === 'unavailable' ? (
          <p className="text-sm text-muted-foreground">{result.reason}</p>
        ) : (
          <Comparison result={result} />
        )}
      </CardContent>
    </Card>
  );
}

function Comparison({ result }: { result: Extract<AiImpactResult, { status: 'ok' }> }) {
  const { report } = result;
  const signals = (Object.keys(SIGNAL_LABEL) as AiSignal[]).filter((s) => report.signalCounts[s] > 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {result.repo} · merged in the last {report.windowDays} days · AI-assisted n=
        {report.ai.n} · not AI-assisted n={report.human.n} · excluded {report.excluded.bots} bot and{' '}
        {report.excluded.reverts} revert PRs
        {result.capped && ' · capped at the newest 300 PRs'}
      </p>

      {!report.sufficient && (
        <p role="status" className="text-sm text-amber-500">
          Not enough data to compare: each group needs at least {MIN_SAMPLE} merged PRs.
        </p>
      )}

      <Table>
        <TableCaption className="text-left">
          Size-adjusted cycle-time difference:{' '}
          <strong>{delta(report.sizeAdjustedCycle.delta)}</strong>
          {report.sizeAdjustedCycle.bucketsUsed.length > 0
            ? ` (compared within size buckets ${report.sizeAdjustedCycle.bucketsUsed.join(', ')})`
            : ' (no size bucket has 3+ PRs in both groups)'}
          . Negative means AI-assisted PRs merged faster.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Metric</TableHead>
            <TableHead scope="col" className="text-right">AI-assisted</TableHead>
            <TableHead scope="col" className="text-right">Not AI-assisted</TableHead>
            <TableHead scope="col" className="text-right">Difference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows(report.ai, report.human, report.deltas).map((r) => (
            <TableRow key={r.label}>
              <TableCell>
                <span className="font-medium">{r.label}</span>
                <span className="block text-xs text-muted-foreground">{r.hint}</span>
              </TableCell>
              <TableCell className="text-right">{r.ai}</TableCell>
              <TableCell className="text-right">{r.human}</TableCell>
              <TableCell className="text-right">{r.diff}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {signals.length > 0 && (
        <p className="text-xs text-muted-foreground">
          AI signals found:{' '}
          {signals.map((s) => `${SIGNAL_LABEL[s]} (${report.signalCounts[s]})`).join(' · ')}. A PR can
          match more than one.
        </p>
      )}
    </div>
  );
}
