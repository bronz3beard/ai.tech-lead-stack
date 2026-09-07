'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AnalyticsEvent } from '@prisma/client';

interface PhaseCostPanelProps {
  traces: AnalyticsEvent[];
}

export function PhaseCostPanel({ traces }: PhaseCostPanelProps) {
  // Aggregate by phase
  const phaseMap: Record<
    string,
    { cost: number; tokens: number; runs: Set<string>; reworkLoops: number }
  > = {};

  traces.forEach((t) => {
    const phase = t.loopPhase || 'unknown';
    if (!phaseMap[phase]) {
      phaseMap[phase] = { cost: 0, tokens: 0, runs: new Set(), reworkLoops: 0 };
    }
    
    phaseMap[phase].cost += t.totalCost || 0;
    phaseMap[phase].tokens += t.totalTokens || 0;
    
    if (t.loopRunId) {
       phaseMap[phase].runs.add(t.loopRunId);
       // Check if this was a critique that required rework
       if (t.metadata && (t.metadata as any).score !== undefined && (t.metadata as any).passed === false) {
           phaseMap[phase].reworkLoops += 1;
       }
    }
  });

  const phaseData = Object.entries(phaseMap)
    .filter(([phase]) => phase !== 'unknown') // filter out non-loop events
    .map(([phase, data]) => ({
      phase,
      cost: data.cost,
      tokens: data.tokens,
      reworkLoops: data.reworkLoops, // We can refine this if we want unique loops per run
      totalRuns: data.runs.size,
    }))
    .sort((a, b) => b.cost - a.cost);

  if (phaseData.length === 0) {
    return (
      <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl overflow-hidden">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-white">
            Cost & Time by Phase
          </CardTitle>
          <p className="text-slate-400">
            Analytics grouped by canonical lifecycle phase.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-8 text-slate-400">
          <p>No phase telemetry found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl overflow-hidden">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-white">
          Cost & Time by Phase
        </CardTitle>
        <p className="text-slate-400">
          Analytics grouped by canonical lifecycle phase.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-900/50">
              <TableRow className="border-slate-800 hover:bg-slate-900/50">
                <TableHead className="text-slate-300 font-semibold">
                  Lifecycle Phase
                </TableHead>
                <TableHead className="text-slate-300 font-semibold text-right">
                  Total Runs
                </TableHead>
                <TableHead className="text-slate-300 font-semibold text-right">
                  Rework Loops
                </TableHead>
                <TableHead className="text-slate-300 font-semibold text-right">
                  Total Tokens
                </TableHead>
                <TableHead className="text-slate-300 font-semibold text-right">
                  Total Cost
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phaseData.map((data) => (
                <TableRow
                  key={data.phase}
                  className="border-slate-800 hover:bg-slate-800/50 transition-colors"
                >
                  <TableCell className="font-medium text-slate-200 capitalize">
                    {data.phase}
                  </TableCell>
                  <TableCell className="text-slate-300 text-right">
                    {data.totalRuns}
                  </TableCell>
                  <TableCell className="text-slate-300 text-right">
                    {data.reworkLoops}
                  </TableCell>
                  <TableCell className="text-slate-300 text-right">
                    {data.tokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-slate-300 text-right font-mono">
                    ${data.cost.toFixed(4)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
