'use client';

import { DashboardDisclaimer } from '@/components/dashboard/DashboardDisclaimer';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { InsightsTable } from '@/components/dashboard/InsightsTable';
import { LimitSelector } from '@/components/dashboard/LimitSelector';
import { ProjectSelector } from '@/components/dashboard/ProjectSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, LineChart } from '@/components/ui/chart';
import { isSkillTrace, normalizeProjectName } from '@/lib/trace-utils';
import { SlidersHorizontal } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

export type TraceData = {
  id: string;
  name: string;
  timestamp: string;
  sessionId?: string;
  projectName: string;
  model: string;
  agent: string;
  duration?: number;
  status?: string;
  metadata?: Record<string, unknown>;
  totalCost?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
};

export function DashboardContent({
  traces,
  projects,
  titlePrefix,
}: {
  traces: TraceData[];
  projects: { id: string; name: string; ownerId: string | null }[];
  titlePrefix: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedProject = searchParams.get('project') || '';
  const currentLimit = searchParams.get('limit') || '50';
  const fromDate = searchParams.get('from') || '';
  const toDate = searchParams.get('to') || '';

  // Draft state — changes here do NOT trigger navigation until Apply is clicked
  const [draftFrom, setDraftFrom] = useState(fromDate);
  const [draftTo, setDraftTo] = useState(toDate);
  const [draftLimit, setDraftLimit] = useState(currentLimit);

  const handleApplyFilters = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateFilters({ from: draftFrom, to: draftTo, limit: draftLimit });
  };

  const updateFilters = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const projectNames = useMemo(() => {
    return projects.map((p) => p.name).sort();
  }, [projects]);

  const filteredTraces = useMemo(() => {
    if (!selectedProject) return traces;
    const target = selectedProject.toLowerCase();

    // If "All Projects" is explicitly selected, return all traces.
    if (target === 'all') return traces;

    return traces.filter((t) => normalizeProjectName(t.projectName) === target);
  }, [traces, selectedProject]);

  const metrics = useMemo(() => {
    let totalExecutions = 0;
    let activeWorkflows = 0;
    const skillCounts: Record<string, number> = {};
    const timeBuckets: Record<string, number> = {};

    const sortedTraces = [...filteredTraces].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const workflows = new Set<string>();

    for (const trace of sortedTraces) {
      // Group by skill name
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

      // Secondary filter to ignore skeletal skill traces
      if (isSkillTrace(trace.name, skillName)) continue;

      // Only count valid skill executions for the KPI
      totalExecutions++;
      skillCounts[skillName] = (skillCounts[skillName] || 0) + 1;

      // Track workflows
      if (trace.sessionId) {
        workflows.add(trace.sessionId);
      }

      // Time series: format to include time, date, and day
      const date = new Date(trace.timestamp);
      // Example: "Dec 15, Mon 2:30 PM"
      const dateStr = date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      const dayStr = date.toLocaleDateString(undefined, { weekday: 'short' });
      const timeStr = date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
      const dateKey = `${dateStr}, ${dayStr} ${timeStr}`;
      timeBuckets[dateKey] = (timeBuckets[dateKey] || 0) + 1;
    }

    activeWorkflows = workflows.size > 0 ? workflows.size : totalExecutions;

    const topSkills = Object.entries(skillCounts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const tracesByTime = Object.entries(timeBuckets).map(([name, total]) => ({
      name,
      total,
    }));

    const totalCost = filteredTraces.reduce(
      (sum, t) => sum + (t.totalCost || 0),
      0
    );

    const successfulTraces = filteredTraces.filter(
      (t) => !t.metadata?.error && t.status !== 'ERROR'
    ).length;
    const averageAccuracy =
      totalExecutions > 0 ? (successfulTraces / totalExecutions) * 100 : 100;

    return {
      totalExecutions,
      activeWorkflows,
      topSkills,
      tracesByTime,
      totalCost,
      averageAccuracy,
    };
  }, [filteredTraces]);

  const displayTitle = selectedProject ? selectedProject : 'All Projects';

  return (
    <div className="flex flex-col min-h-screen bg-background p-8 text-foreground">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="self-end space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              {titlePrefix} Dashboard
            </h1>
            <p className="text-muted text-lg">
              Viewing telemetry data for:{' '}
              <span className="font-semibold text-emerald-500">
                {displayTitle}
              </span>
            </p>
          </div>
          <form
            onSubmit={handleApplyFilters}
            aria-label="Dashboard filters"
            className="flex flex-col gap-2"
          >
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">
              Filters
            </p>
            <div className="flex flex-wrap items-end gap-3 bg-card/40 backdrop-blur-sm border border-border/60 rounded-xl px-4 py-3 shadow-sm">
              <DateRangePicker
                from={draftFrom}
                to={draftTo}
                onRangeChange={(from, to) => {
                  setDraftFrom(from);
                  setDraftTo(to);
                }}
                className="gap-3"
              />

              <div className="flex flex-col w-full">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1 ml-1">
                  Limit
                </label>
                <LimitSelector
                  limit={draftLimit}
                  onSelectLimit={setDraftLimit}
                />
              </div>

              <div className="flex flex-col justify-end pb-0.5 w-full">
                <Button type="submit" size="lg" className="h-10 gap-2 px-5">
                  <SlidersHorizontal className="h-4 w-4" />
                  Apply
                </Button>
              </div>
            </div>
          </form>

          <div className="flex flex-col">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1 ml-1">
              Project
            </p>
            <div className="h-52 flex items-start bg-card/40 backdrop-blur-sm border border-border/60 rounded-xl px-4 py-3 shadow-sm">
              <div className="flex flex-col">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1 ml-1">
                  Select
                </label>
                <ProjectSelector
                  projects={projectNames}
                  selectedProject={selectedProject}
                  onSelectProject={(project) => updateFilters({ project })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">
                Total Skills Run
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {metrics.totalExecutions.toLocaleString()}
              </div>
              <p className="text-xs text-muted mt-1">
                Cumulative across all runs
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">
                Active Workflows
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {metrics.activeWorkflows.toLocaleString()}
              </div>
              <p className="text-xs text-muted mt-1">
                Unique session activities
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">
                Total Est. Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-500">
                ${metrics.totalCost.toFixed(2)}
              </div>
              <p className="text-xs text-muted mt-1">
                Calculated from LLM usage
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">
                Project Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {Math.round(metrics.averageAccuracy)}%
              </div>
              <p className="text-xs text-muted mt-1">Success rate average</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-7">
          <Card className="lg:col-span-12">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Top Performing Skills
              </CardTitle>
            </CardHeader>
            <CardContent className="pl-2 pb-6">
              <BarChart data={metrics.topSkills} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-12">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">
                Activity Timeline
              </CardTitle>
              <p className="text-base text-muted">
                Trend of agent executions over the last{' '}
                {currentLimit === 'all' ? 'entire' : currentLimit} traces.
              </p>
            </CardHeader>
            <CardContent className="pl-2 pb-6">
              <LineChart data={metrics.tracesByTime} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-12 overflow-hidden border-none shadow-lg outline-1 outline-border">
            <CardHeader className="pb-3 bg-muted/30">
              <CardTitle className="text-lg font-semibold">
                Detailed Trace Analytics
              </CardTitle>
              <p className="text-sm text-muted">
                Granular performance and token cost metrics for each execution.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <InsightsTable traces={filteredTraces} />
            </CardContent>
          </Card>
        </div>

        <DashboardDisclaimer />
      </div>
    </div>
  );
}
