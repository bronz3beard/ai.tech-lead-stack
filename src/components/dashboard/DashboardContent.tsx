'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, LineChart } from '@/components/ui/chart';
import { ProjectSelector } from '@/components/dashboard/ProjectSelector';
import { InsightsTable } from '@/components/dashboard/InsightsTable';
import { DashboardDisclaimer } from '@/components/dashboard/DashboardDisclaimer';
import { WorkflowPhaseTracker } from '@/components/dashboard/WorkflowPhaseTracker';
import { isSkillTrace, normalizeProjectName } from '@/lib/trace-utils';

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
  titlePrefix,
}: {
  traces: TraceData[];
  titlePrefix: string;
}) {
  const [selectedProject, setSelectedProject] = useState<string>('');

  const projects = useMemo(() => {
    const projSet = new Set<string>();
    traces.forEach((t) => {
      const normalized = normalizeProjectName(t.projectName);
      if (normalized && normalized !== 'unknown') {
        projSet.add(normalized);
      }
    });
    return Array.from(projSet).sort();
  }, [traces]);

  const filteredTraces = useMemo(() => {
    if (!selectedProject) return traces;
    const target = selectedProject.toLowerCase();
    return traces.filter((t) => normalizeProjectName(t.projectName) === target);
  }, [traces, selectedProject]);

  const metrics = useMemo(() => {
    const totalExecutions = filteredTraces.length;
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
    <div className="flex flex-col min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              {titlePrefix} Dashboard
            </h1>
            <p className="text-muted mt-2">
              Viewing data for: <span className="font-semibold text-foreground">{displayTitle}</span>
            </p>
          </div>
          <ProjectSelector
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
          />
        </div>

        <Card className="border-none bg-emerald-500/5">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-sm font-medium text-emerald-500 uppercase tracking-wider">
              Active Workflow Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WorkflowPhaseTracker traces={filteredTraces} />
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold text-foreground">
                Total Skills Run
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {metrics.totalExecutions.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold text-foreground">
                Active Workflows
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {metrics.activeWorkflows.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold text-foreground">
                Total Est. Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">
                ${metrics.totalCost.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold text-foreground">
                Project Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {Math.round(metrics.averageAccuracy)}%
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-7">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Top Skills
              </CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <BarChart data={metrics.topSkills} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-foreground">
                Traces by time
              </CardTitle>
              <p className="text-base text-muted">
                Visualizes the volume of agent activities (traces) executed over
                time.
              </p>
            </CardHeader>
            <CardContent className="pl-2">
              <LineChart data={metrics.tracesByTime} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-foreground">
                Analytics Insights
              </CardTitle>
              <p className="text-base text-muted">
                Detailed performance and token cost metrics for each skill.
              </p>
            </CardHeader>
            <CardContent>
              <InsightsTable traces={filteredTraces} />
            </CardContent>
          </Card>
        </div>

        {/* Disclaimer Section */}
        <DashboardDisclaimer />
      </div>
    </div>
  );
}
