import { DashboardDisclaimer } from '@/components/dashboard/DashboardDisclaimer';
import { InsightsTable } from '@/components/dashboard/InsightsTable';
import { ProjectSelect, type Project } from '@/components/ProjectSelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, LineChart } from '@/components/ui/chart';
import { isSkillTrace, isActiveSkill, normalizeSkillName } from '@/lib/trace-utils';
import { getAnalytics } from '@/lib/analytics-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 60; // cached for 60 seconds



async function getGlobalMetrics(projectId?: string, session?: any) {
  try {
    // 1. Fetch total analytics from Postgres - much faster!
    // We fetch a larger batch for the global view to ensure historical accuracy
    const allTraces = await getAnalytics({ 
      timeframe: 'all',
      limit: -1, // Fetch all historical records
      projectName: projectId === 'all' ? undefined : projectId
    });

    // 2. Fetch projects from database to ensure all authorized projects are shown
    const isPrivilegedRole = session?.user?.role === 'ADMIN' || session?.user?.role === 'DEVELOPER';

    const dbProjects = await prisma.project.findMany({
      where: session?.user?.id ? (isPrivilegedRole ? {} : {
        OR: [
          { ownerId: session.user.id },
          { accessGrants: { some: { role: session.user.role as any } } }
        ]
      }) : {},
      select: { name: true },
      orderBy: { name: 'asc' }
    });

    const projects: Project[] = [
      { id: 'all', name: 'All Projects' },
      ...dbProjects.map((p) => ({
        id: p.name,
        name: p.name.charAt(0).toUpperCase() + p.name.slice(1).replace(/-/g, ' '),
      })),
    ];

    // Filtering logic for Global Dashboard vs Project view
    const finalTraces = allTraces.filter((trace) => {
      // 1. Project filtering 
      if (projectId !== 'all' && trace.projectName !== projectId) return false;

      // 2. Skill filtering for Global view - remove internal/meta skills
      if (projectId === 'all') {
        let rawSkillName = trace.name;
        if (trace.name && trace.name.startsWith('skill:')) {
          rawSkillName = trace.name.replace('skill:', '');
        } else if (trace.metadata?.skillName) {
          rawSkillName = trace.metadata.skillName as string;
        }

        const skillName = normalizeSkillName(rawSkillName);
        return isActiveSkill(skillName) && !isSkillTrace(trace.name, skillName);
      }
      
      return true;
    });

// Logic moved to fetch from DB above

    const totalExecutions = finalTraces.length;
    const sessionIds = new Set(
      finalTraces.map((t) => t.sessionId).filter(Boolean)
    );
    const activeWorkflows =
      sessionIds.size > 0 ? sessionIds.size : totalExecutions;

    const skillCounts: Record<string, number> = {};
    const timeBuckets: Record<string, number> = {};

    finalTraces.forEach((trace) => {
      // Aggregate by skill
      let rawSkillName = trace.name;
      if (trace.name && trace.name.startsWith('skill:')) {
        rawSkillName = trace.name.replace('skill:', '');
      } else if (trace.metadata?.skillName) {
        rawSkillName = trace.metadata.skillName as string;
      }
      const skillName = normalizeSkillName(rawSkillName);

      skillCounts[skillName] = (skillCounts[skillName] || 0) + 1;

      // Aggregate by time
      const dateKey = new Date(trace.timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      timeBuckets[dateKey] = (timeBuckets[dateKey] || 0) + 1;
    });

    const topSkills = Object.entries(skillCounts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const tracesByTime = Object.entries(timeBuckets).map(([name, total]) => ({
      name,
      total,
    }));

    return {
      totalExecutions,
      activeWorkflows:
        activeWorkflows > totalExecutions ? totalExecutions : activeWorkflows,
      projects,
      topSkills,
      tracesByTime,
      traces: finalTraces,
    };
  } catch (error) {
    console.error('Error fetching metrics from Postgres:', error);
    return {
      totalExecutions: 0,
      activeWorkflows: 0,
      projects: [{ id: 'all', name: 'All Projects' }],
      topSkills: [],
      tracesByTime: [],
      traces: [],
    };
  }
}

interface PageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function PublicDashboard({ searchParams }: PageProps) {
  const { projectId = 'all' } = await searchParams;
  const session = await getServerSession(authOptions);
  const metrics = await getGlobalMetrics(projectId, session);

  const selectedProject =
    metrics.projects.find((p) => p.id === projectId) || metrics.projects[0];

  const totalCost = metrics.traces.reduce(
    (sum, t) => sum + (t.totalCost || 0),
    0
  );

  // Calculate average accuracy
  const successfulTraces = metrics.traces.filter(
    (t) => !t.metadata?.error && t.status !== 'ERROR'
  ).length;
  const averageAccuracy =
    metrics.totalExecutions > 0
      ? (successfulTraces / metrics.totalExecutions) * 100
      : 100;

  return (
    <div className="flex flex-col min-h-full bg-[#0f172a] text-slate-200 p-8 font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h1 className="text-5xl font-extrabold tracking-tight bg-linear-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Global Public Dashboard
            </h1>
            <p className="text-slate-400 mt-3 text-xl font-medium">
              Viewing telemetry data for:{' '}
              <span className="text-indigo-400 font-bold border-b-2 border-indigo-400/30 pb-1">
                {selectedProject.name}
              </span>
            </p>
          </div>

          <div className="flex items-center">
            <ProjectSelect
              projects={metrics.projects}
              selectedProjectId={projectId}
            />
          </div>
        </div>

        {/* Top Level KPIs */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Skills Run"
            value={metrics.totalExecutions}
            subtitle="Cumulative across all runs"
          />
          <KPICard
            title="Active Workflows"
            value={metrics.activeWorkflows}
            subtitle="Unique session activities"
          />
          <KPICard
            title="Total Est. Cost"
            value={`$${totalCost.toFixed(2)}`}
            subtitle="Calculated from LLM usage"
          />
          <KPICard
            title="Project Health"
            value={`${Math.round(averageAccuracy)}%`}
            subtitle="Success rate average"
          />
        </div>

        {/* Visual Analytics */}
        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-7">
          <Card className="lg:col-span-4 border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
            <CardHeader className="pb-0">
              <CardTitle className="text-2xl font-bold text-white mb-2">
                Top Performing Skills
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <BarChart data={metrics.topSkills} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
            <CardHeader className="pb-0">
              <CardTitle className="text-2xl font-bold text-white mb-2">
                Activity Timeline
              </CardTitle>
              <p className="text-slate-400">
                Trend of agent executions over the last 100 traces.
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <LineChart data={metrics.tracesByTime} />
            </CardContent>
          </Card>
        </div>

        {/* Analytics Insights Table */}
        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-white">
              Analytics Insights
            </CardTitle>
            <p className="text-slate-400">
              Detailed performance and token cost metrics for each skill.
            </p>
          </CardHeader>
          <CardContent>
            <InsightsTable traces={metrics.traces} />
          </CardContent>
        </Card>

        {/* Disclaimer Section */}
        <DashboardDisclaimer />
      </div>
    </div>
  );
}

function KPICard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl hover:border-indigo-500/40 transition-all duration-300 group">
      <CardHeader className="pb-2">
        <p className="text-slate-400 text-sm font-semibold uppercase tracking-widest group-hover:text-indigo-400 transition-colors">
          {title}
        </p>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-extrabold text-white mb-2">{value}</div>
        <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
