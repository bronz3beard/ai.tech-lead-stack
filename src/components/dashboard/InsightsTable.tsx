'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip } from '@/components/ui/tooltip';
import { useMemo } from 'react';
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
  'technical-task-planner': 925,
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
        tokenUsage: number;
        hasLangfuse: boolean;
        models: Set<string>;
      }
    > = {};

    for (const trace of traces) {
      let skillName = 'unknown';
      if (trace.name && trace.name.startsWith('skill:')) {
        skillName = trace.name.replace('skill:', '');
      } else if (
        trace.name === 'skill_execution' &&
        typeof trace.metadata?.skillName === 'string'
      ) {
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
          tokenUsage: 0,
          hasLangfuse: false,
          models: new Set<string>(),
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
        skillStats[skillName].hasLangfuse = true;
      }

      // Accumulate tokens
      if (typeof trace.totalTokens === 'number') {
        skillStats[skillName].tokenUsage += trace.totalTokens;
        skillStats[skillName].hasLangfuse = true;
      }

      if (trace.model) {
        skillStats[skillName].models.add(trace.model);
      } else if (trace.metadata?.model) {
        skillStats[skillName].models.add(trace.metadata.model as string);
      }
    }

    return Object.entries(skillStats)
      .map(([name, stats]) => {
        const avgDuration =
          stats.executions > 0
            ? (stats.totalDuration / stats.executions).toFixed(2)
            : '0.00';

        const accuracy =
          stats.executions > 0
            ? ((1 - stats.errors / stats.executions) * 100).toFixed(1)
            : '100.0';

        const normalizedName = name.toLowerCase();
        const hasLangfuseData = stats.hasLangfuse;

        const perRunCost = hasLangfuseData
          ? stats.tokenCost / stats.executions
          : FALLBACK_TOKEN_COST[normalizedName] || 0;

        const totalCost = hasLangfuseData
          ? stats.tokenCost
          : perRunCost * stats.executions;

        const perRunTokens = hasLangfuseData
          ? stats.tokenUsage / stats.executions
          : FALLBACK_TOKEN_COST[normalizedName] || 0;

        const totalTokens = hasLangfuseData
          ? stats.tokenUsage
          : perRunTokens * stats.executions;

        const displayPerRunCost = hasLangfuseData
          ? `$${perRunCost.toFixed(4)}`
          : `~${perRunCost}`;

        const displayTotalCost = hasLangfuseData
          ? `$${totalCost.toFixed(4)}`
          : `~${totalCost}`;

        const displayTotalTokens = hasLangfuseData
          ? `${totalTokens.toLocaleString()}`
          : `~${totalTokens.toLocaleString()}`;

        return {
          name,
          executions: stats.executions,
          model: Array.from(stats.models).join(', ') || 'unknown',
          perRunCost: displayPerRunCost,
          totalCost: displayTotalCost,
          totalTokens: displayTotalTokens,
          isFallbackCost: !hasLangfuseData,
          avgDuration: stats.totalDuration > 0 ? `${avgDuration}ms` : 'N/A',
          accuracy: `${accuracy}%`,
        };
      })
      .sort((a, b) => b.executions - a.executions); // sort by executions descending
  }, [traces]);

  if (tableData.length === 0) {
    return (
      <div className="text-muted-foreground p-4">
        No data available to display.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Skill Name</TableHead>
          <TableHead>Model</TableHead>
          <TableHead className="text-right">Executions</TableHead>
          <TableHead className="text-right">
            Est. Token Cost (per run)
          </TableHead>
          <TableHead className="text-right">Total execution cost</TableHead>
          <TableHead className="text-right">Total Tokens</TableHead>
          <TableHead className="text-right">Avg Duration</TableHead>
          <TableHead className="text-right">Accuracy (Success Rate)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tableData.map((row) => (
          <TableRow key={row.name}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell>{row.model}</TableCell>
            <TableCell className="text-right">{row.executions}</TableCell>
            <TableCell className="text-right">
              {row.isFallbackCost ? (
                <Tooltip text="Estimated base token cost. Langfuse data unavailable.">
                  <span className="border-b border-dotted border-gray-400 cursor-help">
                    {row.perRunCost}
                  </span>
                </Tooltip>
              ) : (
                row.perRunCost
              )}
            </TableCell>
            <TableCell className="text-right">
              {row.isFallbackCost ? (
                <Tooltip text="Estimated total cost. Langfuse data unavailable.">
                  <span className="border-b border-dotted border-gray-400 cursor-help">
                    {row.totalCost}
                  </span>
                </Tooltip>
              ) : (
                row.totalCost
              )}
            </TableCell>
            <TableCell className="text-right">
              {row.isFallbackCost ? (
                <Tooltip text="Estimated total tokens based on base skill cost. Langfuse data unavailable.">
                  <span className="border-b border-dotted border-gray-400 cursor-help">
                    {row.totalTokens}
                  </span>
                </Tooltip>
              ) : (
                row.totalTokens
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
