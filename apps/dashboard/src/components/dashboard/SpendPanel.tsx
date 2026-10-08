import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart } from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SpendSummary } from '@/lib/usage-aggregates';

const usd = (n: number) => `$${n.toFixed(n > 0 && n < 1 ? 4 : 2)}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/**
 * Spend from LLM calls this stack made (web chat, reflexion). MCP skill loads
 * run on the agent's own subscription, so they are counted on the adoption
 * tiles but carry no cost here.
 */
export function SpendPanel({ spend, scopeLabel }: { spend: SpendSummary; scopeLabel: string }) {
  const succeeded = spend.llmCalls - spend.failedCalls;
  const estimatedShare = spend.totalCostUsd > 0 ? spend.estimatedCostUsd / spend.totalCostUsd : 0;
  const perSession = spend.sessions > 0 ? spend.totalCostUsd / spend.sessions : 0;
  const source = `Source: LLM calls in the TLS store · ${scopeLabel}`;

  return (
    <section aria-labelledby="spend-heading" className="space-y-4">
      <div>
        <h2 id="spend-heading" className="text-2xl font-bold tracking-tight">
          LLM Spend
        </h2>
        <p className="text-sm text-muted">
          Web chat and reflexion calls only. Agent sessions over MCP run on the agent&apos;s own
          subscription and are not billed here. {source}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Tile
          title="Total Spend"
          value={usd(spend.totalCostUsd)}
          detail={`${spend.llmCalls.toLocaleString()} LLM calls · ${pct(estimatedShare)} from estimated usage or fallback rates`}
        />
        <Tile
          title="Cost per Session"
          value={usd(perSession)}
          detail={`Total spend ÷ ${spend.sessions.toLocaleString()} chat/loop sessions`}
        />
        <Tile
          title="Cache Hit Rate"
          value={spend.cacheHitRate === null ? '—' : pct(spend.cacheHitRate)}
          detail={
            spend.cacheReportingCalls > 0
              ? `Cache reads ÷ input tokens over ${spend.cacheReportingCalls.toLocaleString()} calls reporting cache`
              : 'No calls have reported cache usage yet'
          }
        />
        <Tile
          title="LLM Call Success"
          value={spend.llmCalls > 0 ? pct(succeeded / spend.llmCalls) : '—'}
          detail={`${spend.failedCalls.toLocaleString()} failed of ${spend.llmCalls.toLocaleString()} (incl. quota rotations)`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownTable
          title="By provider"
          rows={spend.byProvider.map((r) => ({ label: r.provider, costUsd: r.costUsd, calls: r.calls }))}
        />
        <BreakdownTable
          title="By project"
          rows={spend.byProject.map((r) => ({ label: r.projectName, costUsd: r.costUsd, calls: r.calls }))}
        />
        <BreakdownTable
          title="By person"
          rows={spend.byPerson.map((r) => ({ label: r.person, costUsd: r.costUsd, calls: r.calls }))}
        />
      </div>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Weekly Spend (USD)</CardTitle>
          <p className="text-sm text-muted">Weeks start Monday, UTC. {source}</p>
        </CardHeader>
        <CardContent className="pl-2 pb-6">
          <LineChart data={spend.weekly.map((w) => ({ name: w.name, total: Number(w.total.toFixed(4)) }))} />
        </CardContent>
      </Card>
    </section>
  );
}

function Tile({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-xs text-muted mt-1">{detail}</p>
      </CardContent>
    </Card>
  );
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; costUsd: number; calls: number }[];
}) {
  return (
    <Card className="bg-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">No LLM calls in this range.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Name</TableHead>
                <TableHead scope="col" className="text-right">Calls</TableHead>
                <TableHead scope="col" className="text-right">Spend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 10).map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right">{r.calls.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{usd(r.costUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
