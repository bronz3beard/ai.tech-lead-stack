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
import { isSkillTrace, normalizeSkillName } from '@/lib/trace-utils';

const FALLBACK_TOKEN_COST: Record<string, number> = {
  'agent-optimizer': 500,
  'changelog-generator': 670,
  'clean-code': 880,
  'code-review-checklist': 600,
  'codebase-onboarding-intelligence': 960,
  'daily-standup': 500,
  'feature-design-assistant': 700,
  'mission-architect': 1200,
  'mission-control': 615,
  'planning-expert': 475,
  'pr-automator': 875,
  'product-strategist': 750,
  'regression-bug-fix': 1300,
  'security-audit': 495,
  'style-logic-exporter': 650,
  'technical-debt-auditor': 760,
  'verification-auditor': 1400,
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
        hasLangfuseCost: boolean;
        hasLangfuseTokens: boolean;
        models: Set<string>;
        agents: Set<string>;
      }
    > = {};

    for (const trace of traces) {
      let rawSkillName = 'unknown';
      if (trace.name && trace.name.startsWith('skill:')) {
        rawSkillName = trace.name.replace('skill:', '');
      } else if (
        trace.name === 'skill_execution' &&
        typeof trace.metadata?.skillName === 'string'
      ) {
        rawSkillName = trace.metadata.skillName;
      } else if (trace.name) {
        rawSkillName = trace.name;
      }

      const skillName = normalizeSkillName(rawSkillName);

      // Secondary filter to ignore skeletal skill traces
      if (isSkillTrace(trace.name, skillName)) continue;

      if (!skillStats[skillName]) {
        skillStats[skillName] = {
          executions: 0,
          totalDuration: 0,
          errors: 0,
          tokenCost: 0,
          tokenUsage: 0,
          hasLangfuseCost: false,
          hasLangfuseTokens: false,
          models: new Set<string>(),
          agents: new Set<string>(),
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
      if (typeof trace.totalCost === 'number' && trace.totalCost > 0) {
        skillStats[skillName].tokenCost += trace.totalCost;
        skillStats[skillName].hasLangfuseCost = true;
      }

      // Accumulate tokens
      if (typeof trace.totalTokens === 'number' && trace.totalTokens > 0) {
        skillStats[skillName].tokenUsage += trace.totalTokens;
        skillStats[skillName].hasLangfuseTokens = true;
      }

      if (trace.model && trace.model !== 'unknown') {
        skillStats[skillName].models.add(trace.model);
      }
      if (trace.agent && trace.agent !== 'unknown') {
        skillStats[skillName].agents.add(trace.agent);
      }
    }

    return Object.entries(skillStats)
      .map(([name, stats]) => {
        const avgDurationValue =
          stats.executions > 0 ? stats.totalDuration / stats.executions : 0;

        const formattedDuration =
          avgDurationValue > 0
            ? avgDurationValue < 1
              ? `${(avgDurationValue * 1000).toFixed(0)}ms`
              : `${avgDurationValue.toFixed(2)}s`
            : 'N/A';

        const accuracy =
          stats.executions > 0
            ? ((1 - stats.errors / stats.executions) * 100).toFixed(1)
            : '100.0';

        const normalizedName = name.toLowerCase();

        // Cost logic: Use Langfuse if available, otherwise 0
        const perRunCost = stats.hasLangfuseCost
          ? stats.tokenCost / stats.executions
          : 0;
        const totalCost = stats.tokenCost;

        // Token logic: Use Langfuse if available, otherwise fallback
        const perRunTokens = stats.hasLangfuseTokens
          ? stats.tokenUsage / stats.executions
          : FALLBACK_TOKEN_COST[normalizedName] || 0;
        const totalTokens = stats.hasLangfuseTokens
          ? stats.tokenUsage
          : perRunTokens * stats.executions;

        const displayPerRunCost = stats.hasLangfuseCost
          ? `$${perRunCost.toFixed(4)}`
          : `$0.0000`;

        const displayTotalCost = stats.hasLangfuseCost
          ? `$${totalCost.toFixed(4)}`
          : `$0.0000`;

        const displayPerRunTokens = stats.hasLangfuseTokens
          ? `${Math.round(perRunTokens).toLocaleString()}`
          : `~${Math.round(perRunTokens).toLocaleString()}`;

        const displayTotalTokens = stats.hasLangfuseTokens
          ? `${Math.round(totalTokens).toLocaleString()}`
          : `~${Math.round(totalTokens).toLocaleString()}`;

        const modelList = Array.from(stats.models).sort().join(', ') || 'unknown';
        const isModelTruncated = modelList.length > 55;
        const displayModel = isModelTruncated 
          ? `${modelList.substring(0, 52)}...` 
          : modelList;

        return {
          name,
          executions: stats.executions,
          model: displayModel,
          fullModel: modelList,
          isModelTruncated,
          perRunCost: displayPerRunCost,
          totalCost: displayTotalCost,
          perRunTokens: displayPerRunTokens,
          totalTokens: displayTotalTokens,
          isFallbackTokens: !stats.hasLangfuseTokens,
          isFallbackCost: !stats.hasLangfuseCost,
          avgDuration: formattedDuration,
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
          <TableHead className="w-[180px]">Skill Name</TableHead>
          <TableHead className="min-w-[200px]">Model</TableHead>
          <TableHead className="text-right">Executions</TableHead>
          <TableHead className="text-right">Avg Token usage (per run)</TableHead>
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
            <TableCell>
              {row.isModelTruncated ? (
                <Tooltip text={row.fullModel}>
                   <span className="cursor-help border-b border-dotted border-muted-foreground/50">
                    {row.model}
                  </span>
                </Tooltip>
              ) : (
                row.model
              )}
            </TableCell>
            <TableCell className="text-right">{row.executions}</TableCell>
            <TableCell className="text-right">
              {row.isFallbackTokens ? (
                <Tooltip text="Estimated average token usage. Langfuse data unavailable.">
                  <span className="border-b border-dotted border-gray-400 cursor-help text-amber-400/80">
                    {row.perRunTokens}
                  </span>
                </Tooltip>
              ) : (
                row.perRunTokens
              )}
            </TableCell>
            <TableCell className="text-right text-emerald-400 font-medium">
              {row.totalCost}
            </TableCell>
            <TableCell className="text-right">
              {row.isFallbackTokens ? (
                <Tooltip text="Estimated total tokens based on base skill cost. Langfuse data unavailable.">
                  <span className="border-b border-dotted border-gray-400 cursor-help text-amber-400/80">
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
