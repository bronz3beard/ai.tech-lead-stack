'use client';

import type { AgenticHealthSummary } from '@/app/dashboard/agentic-health-loader';
import { DashboardDisclaimer } from '@/components/dashboard/DashboardDisclaimer';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { InsightsTable } from '@/components/dashboard/InsightsTable';
import { LimitSelector } from '@/components/dashboard/LimitSelector';
import { ProjectSelector } from '@/components/dashboard/ProjectSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, LineChart } from '@/components/ui/chart';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AiImpactResult } from '@/lib/ai-impact-loader';
import type { TraceData } from '@/lib/analytics-service';
import { computeStepMetrics } from '@/lib/step-metrics';
import { bucketSum, utcDay } from '@/lib/time-buckets';
import type { SpendSummary } from '@/lib/usage-aggregates';
import {
  isSkillTrace,
  normalizeProjectName,
} from '@zenithfoundry/tech-lead-stack/trace-utils';
import { Globe, SlidersHorizontal, User } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { AgenticHealthSection } from './AgenticHealthSection';
import { AiImpactPanel } from './AiImpactPanel';
import { PhaseCostPanel } from './PhaseCostPanel';
import { AiImpactPanel } from './AiImpactPanel';
import { SpendPanel } from './SpendPanel';
import type { AiImpactResult } from '@/lib/ai-impact-loader';
import { StepAnalyticsTable } from './StepAnalyticsTable';

export function DashboardContent({
  traces,
  projects,
  titlePrefix,
  agenticHealth,
  dataWindow,
  spend,
  spendScopeLabel,
  aiImpact,
}: {
  traces: TraceData[];
  projects: { id: string; name: string; ownerId: string | null }[];
  titlePrefix: string;
  agenticHealth?: AgenticHealthSummary;
  /** Which rows were loaded, e.g. "Latest 1,000 runs". */
  dataWindow: string;
  /** Aggregated in the database over the whole date range, not limited to the loaded rows. */
  spend: SpendSummary;
  /** Describes the spend window, e.g. "All time" or a date range. */
  spendScopeLabel: string;
  /** BETA AI-vs-not comparison; only loaded when a single project is selected. */
  aiImpact?: AiImpactResult;
}) {
  // Every card reads the TLS Postgres store, the single source of truth for telemetry.
  const scopeLabel = `Source: TLS store · ${dataWindow}`;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedProject = searchParams.get('project') || 'all';
  const currentLimit = searchParams.get('limit') || 'all';
  const fromDate = searchParams.get('from') || '';
  const toDate = searchParams.get('to') || '';
  const currentView = searchParams.get('view') || 'global';

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
    if (target === 'all' || target === 'all projects') return traces;

    return traces.filter((t) => normalizeProjectName(t.projectName) === target);
  }, [traces, selectedProject]);

  const metrics = useMemo(() => {
    // Work = skill loads + LLM calls; tool calls and loop markers are parts of that work.
    const work = filteredTraces.filter(
      (t) =>
        (t.kind === 'skill_invocation' || t.kind === 'llm_generation') &&
        !isSkillTrace(t.name, t.name)
    );
    const skillLoads = work.filter((t) => t.kind === 'skill_invocation');
    const llmCalls = work.filter((t) => t.kind === 'llm_generation').length;
    const sessions = new Set(work.map((t) => t.sessionId).filter(Boolean)).size;
    const agentWork = work.filter((t) => t.actorType === 'AGENT').length;

    const skillCounts: Record<string, number> = {};
    for (const t of skillLoads)
      skillCounts[t.name] = (skillCounts[t.name] || 0) + 1;
    const topSkills = Object.entries(skillCounts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      skillLoads: skillLoads.length,
      llmCalls,
      sessions,
      workTotal: work.length,
      agentShare: work.length > 0 ? agentWork / work.length : 0,
      topSkills,
      tracesByTime: bucketSum(
        work.map((t) => ({ at: new Date(t.timestamp), value: 1 })),
        utcDay
      ),
      stepMetrics: computeStepMetrics(filteredTraces),
    };
  }, [filteredTraces]);

  const displayTitle =
    !selectedProject || selectedProject === 'all'
      ? 'All Projects'
      : selectedProject;

  return (
    <div className="flex flex-col min-h-screen bg-background p-8 text-foreground">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
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

            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">
                Data Scope
              </p>
              <Tabs
                value={currentView}
                onValueChange={(v) => updateFilters({ view: v })}
                className="w-[300px]"
              >
                <TabsList className="grid w-full grid-cols-2 bg-card/40 border border-border/60">
                  <TabsTrigger value="global" className="gap-2">
                    <Globe className="h-4 w-4" />
                    Global
                  </TabsTrigger>
                  <TabsTrigger value="me" className="gap-2">
                    <User className="h-4 w-4" />
                    My Activity
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
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

          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">
              Project Selection
            </p>
            <div className="flex items-start bg-card/40 backdrop-blur-sm border border-border/60 rounded-xl px-4 py-3 shadow-sm min-w-[280px]">
              <div className="flex flex-col w-full">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1 ml-1">
                  Project
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
          <StatTile
            title="Skills Loaded"
            value={metrics.skillLoads.toLocaleString()}
            detail="Skill files served to agents and chat"
            scopeLabel={scopeLabel}
          />
          <StatTile
            title="Sessions"
            value={metrics.sessions.toLocaleString()}
            detail="Distinct chat, loop and agent sessions"
            scopeLabel={scopeLabel}
          />
          <StatTile
            title="LLM Calls"
            value={metrics.llmCalls.toLocaleString()}
            detail="Chat answers and reflexion phases this stack paid for"
            scopeLabel={scopeLabel}
          />
          <StatTile
            title="Agent-Initiated"
            value={`${(metrics.agentShare * 100).toFixed(1)}%`}
            detail={`Agent ÷ ${metrics.workTotal.toLocaleString()} skill loads and LLM calls`}
            scopeLabel={scopeLabel}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-7">
          <Card className="lg:col-span-12">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Most Used Skills
              </CardTitle>
              <p className="text-sm text-muted">{scopeLabel}</p>
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
                Skill loads and LLM calls per day (UTC). {scopeLabel}
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
                Granular performance and token cost metrics for each execution.{' '}
                {scopeLabel}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <InsightsTable traces={filteredTraces} />
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Analysis Steps per Run
            </CardTitle>
            <p className="text-sm text-muted">
              Reflexion runs count once at their final revision; each web-chat
              analysis turn is one run. {scopeLabel}
            </p>
          </CardHeader>
          <CardContent>
            <StepAnalyticsTable metrics={metrics.stepMetrics} />
          </CardContent>
        </Card>

        <PhaseCostPanel traces={filteredTraces} />

        <SpendPanel spend={spend} scopeLabel={spendScopeLabel} />

        {aiImpact && <AiImpactPanel result={aiImpact} />}

        {agenticHealth && <AgenticHealthSection summary={agenticHealth} />}

        <DashboardDisclaimer />
      </div>
    </div>
  );
}

function StatTile({
  title,
  value,
  detail,
  scopeLabel,
}: {
  title: string;
  value: string;
  detail: string;
  scopeLabel: string;
}) {
  return (
    <Card className="bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-xs text-muted mt-1">{detail}</p>
        <p className="text-xs text-muted mt-1">{scopeLabel}</p>
      </CardContent>
    </Card>
  );
}
