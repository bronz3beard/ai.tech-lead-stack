'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type StepMetric = {
  skillName: string;
  totalExecutions: number;
  averageSteps: number;
  totalSteps: number;
};

interface StepAnalyticsTableProps {
  metrics: StepMetric[];
}

export function StepAnalyticsTable({ metrics }: StepAnalyticsTableProps) {
  if (metrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-400">
        <p>No analysis step telemetry found.</p>
        <p className="text-sm mt-1">Run an analysis task to see step metrics here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-slate-900/50">
          <TableRow className="border-slate-800 hover:bg-slate-900/50">
            <TableHead className="text-slate-300 font-semibold w-1/3">
              Workflow / Skill
            </TableHead>
            <TableHead className="text-slate-300 font-semibold text-right">
              Total Executions
            </TableHead>
            <TableHead className="text-slate-300 font-semibold text-right">
              Average Steps per Run
            </TableHead>
            <TableHead className="text-slate-300 font-semibold text-right">
              Total Steps Accumulated
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {metrics.map((metric) => (
            <TableRow
              key={metric.skillName}
              className="border-slate-800 hover:bg-slate-800/50 transition-colors"
            >
              <TableCell className="font-medium text-slate-200">
                <span className="inline-block px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-md text-xs border border-indigo-500/20">
                  {metric.skillName}
                </span>
              </TableCell>
              <TableCell className="text-slate-300 text-right">
                {metric.totalExecutions}
              </TableCell>
              <TableCell className="text-slate-300 text-right">
                {metric.averageSteps.toFixed(1)}
              </TableCell>
              <TableCell className="text-slate-300 text-right">
                {metric.totalSteps}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
