'use client';

import { useMemo } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TraceData } from './DashboardContent';

const FALLBACK_TOKEN_COST: Record<string, number> = {
  'changelog-generator': 670,
  'clean-code': 880,
  'code-review-checklist': 840,
  'codebase-onboarding-intelligence': 960,
  'daily-standup': 500,
  'dr-remediation': 780,
  'feature-design-assistant': 700,
  'mission-control': 615,
  'planning-expert': 475,
  'pr-automator': 875,
  'product-strategist': 750,
  'qa-remediation': 730,
  'quality-gatekeeper': 650,
  'security-audit': 495,
  'strategy-to-execution': 420,
  'technical-debt-auditor': 760,
  'visual-verifier': 375,
};

export function InsightsTable({ traces }: { traces: TraceData[] }) {
  const tableData = useMemo(() => {
    const skillStats: Record<
      string,
      {
        executions: number;
        totalDuration: number;
        errors: number;
        tokenCost: number;
      }
    > = {};

    for (const trace of traces) {
      let skillName = 'unknown';
      if (trace.name && trace.name.startsWith('skill:')) {
        skillName = trace.name.replace('skill:', '');
      } else if (trace.name === 'skill_execution' && typeof trace.metadata?.skillName === 'string') {
        skillName = trace.metadata.skillName;
      } else if (trace.name) {
        skillName = trace.name;
      }

      if (!skillStats[skillName]) {
        skillStats[skillName] = {
          executions: 0,
          totalDuration: 0,
          errors: 0,
          tokenCost: 0,
        };
      }

      skillStats[skillName].executions += 1;

      // Accumulate duration if available
      if (typeof trace.duration === 'number') {
        skillStats[skillName].totalDuration += trace.duration;
      } else if (typeof trace.metadata?.duration === 'number') {
        skillStats[skillName].totalDuration += trace.metadata.duration;
      }

      // Check for errors
      if (trace.metadata?.error || trace.status === 'ERROR') {
        skillStats[skillName].errors += 1;
      }

      // Check for totalCost from langfuse
      if (typeof trace.totalCost === 'number') {
          skillStats[skillName].tokenCost += trace.totalCost;
      }
    }

    return Object.entries(skillStats).map(([name, stats]) => {
      const avgDuration =
        stats.executions > 0
          ? (stats.totalDuration / stats.executions).toFixed(2)
          : '0.00';

      const accuracy =
        stats.executions > 0
          ? ((1 - stats.errors / stats.executions) * 100).toFixed(1)
          : '100.0';

      const hasLangfuseCost = stats.tokenCost > 0;
      const displayCost = hasLangfuseCost
        ? `$${stats.tokenCost.toFixed(4)}`
        : `~${FALLBACK_TOKEN_COST[name] || 0}`;

      return {
        name,
        executions: stats.executions,
        tokenCost: displayCost,
        isFallbackCost: !hasLangfuseCost,
        avgDuration: stats.totalDuration > 0 ? `${avgDuration}ms` : 'N/A',
        accuracy: `${accuracy}%`,
      };
    }).sort((a, b) => b.executions - a.executions); // sort by executions descending
  }, [traces]);

  if (tableData.length === 0) {
    return <div className="text-muted-foreground p-4">No data available to display.</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Skill Name</TableHead>
          <TableHead className="text-right">Executions</TableHead>
          <TableHead className="text-right">Est. Token Cost</TableHead>
          <TableHead className="text-right">Avg Duration</TableHead>
          <TableHead className="text-right">Accuracy (Success Rate)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tableData.map((row) => (
          <TableRow key={row.name}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-right">{row.executions}</TableCell>
            <TableCell className="text-right">
              {row.isFallbackCost ? (
                <Tooltip text="Estimated base token cost. Langfuse data unavailable.">
                  <span className="border-b border-dotted border-gray-400 cursor-help">
                    {row.tokenCost}
                  </span>
                </Tooltip>
              ) : (
                row.tokenCost
              )}
            </TableCell>
            <TableCell className="text-right">{row.avgDuration}</TableCell>
            <TableCell className="text-right">{row.accuracy}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
