import { ProjectSelect, type Project } from '@/components/ProjectSelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, LineChart } from '@/components/ui/chart';

export const revalidate = 60; // cached for 60 seconds

/**
 * Analytics types for Langfuse data processing
 */
interface LangfuseMetadata {
  skillName?: string;
  projectId?: string;
  projectName?: string;
  environment?: string;
  error?: string;
  stack?: string;
  duration?: number;
  [key: string]: string | number | boolean | undefined;
}

interface LangfuseUsage {
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}

interface LangfuseTrace {
  id: string;
  name: string;
  timestamp: string;
  metadata?: LangfuseMetadata;
  usage?: LangfuseUsage;
  sessionId?: string;
  totalCost?: number;
  tags?: string[];
}

interface SkillInsight {
  name: string;
  model: string;
  executions: number;
  estTokenCost: number;
  totalCost: number;
  avgDuration: number;
  accuracy: number;
}

async function getGlobalMetrics(projectId?: string) {
  'use cache';

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

  if (!publicKey || !secretKey) {
    console.warn(
      'Missing Langfuse API keys in environment variables, using fallback metrics'
    );
    // FALLBACK DATA for demo purposes if no API keys are provided
    return {
      totalExecutions: 32,
      activeWorkflows: 6,
      projects: [
        { id: 'all', name: 'All Projects' },
        { id: 'tech-lead-stack', name: 'Tech Lead Stack' },
        { id: 'agent-toolbox', name: 'Agent Toolbox' },
        { id: 'gilly-llms', name: 'Gilly LLMs' },
      ],
      topSkills: [
        { name: 'planning-expert', total: 12 },
        { name: 'qa-remediation', total: 8 },
        { name: 'pr-automator', total: 6 },
        { name: 'visual-verifier', total: 4 },
        { name: 'technical-task-planner', total: 2 },
      ],
      tracesByTime: [
        { name: 'Mar 15', total: 5 },
        { name: 'Mar 16', total: 10 },
        { name: 'Mar 17', total: 8 },
        { name: 'Mar 18', total: 15 },
        { name: 'Mar 19', total: 20 },
        { name: 'Mar 20', total: 25 },
        { name: 'Mar 21', total: 32 },
      ],
      skillInsights: [
        {
          name: 'planning-expert',
          executions: 16,
          estTokenCost: 475,
          totalCost: 7600,
          avgDuration: 1200,
          accuracy: 100,
        },
        {
          name: 'pr-automator',
          executions: 8,
          estTokenCost: 875,
          totalCost: 7000,
          avgDuration: 2500,
          accuracy: 100,
        },
        {
          name: 'qa-remediation',
          executions: 6,
          estTokenCost: 730,
          totalCost: 4380,
          avgDuration: 1800,
          accuracy: 100,
        },
        {
          name: 'visual-verifier',
          executions: 3,
          estTokenCost: 375,
          totalCost: 1125,
          avgDuration: 3200,
          accuracy: 100,
        },
        {
          name: 'technical-task-planner',
          executions: 3,
          estTokenCost: 0,
          totalCost: 0,
          avgDuration: 800,
          accuracy: 100,
        },
        {
          name: 'feature-design-assistant',
          executions: 1,
          estTokenCost: 700,
          totalCost: 700,
          avgDuration: 1500,
          accuracy: 100,
        },
      ] as SkillInsight[],
    };
  }

  const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`;

  try {
    // 1. Fetch ALL traces (up to 100) to find all available project names and global metrics
    const tracesResponse = await fetch(
      `${baseUrl}/api/public/traces?limit=100`,
      {
        headers: {
          Authorization: authHeader,
        },
        next: { revalidate: 60 },
      }
    );

    if (!tracesResponse.ok) {
      throw new Error(`Langfuse API error: ${tracesResponse.statusText}`);
    }

    const tracesData = (await tracesResponse.json()) as {
      data: LangfuseTrace[];
    };
    const allTraces = tracesData.data || [];

    // 2. Aggregate available projects dynamically from traces metadata
    const projectSet = new Set<string>();
    allTraces.forEach((t: LangfuseTrace) => {
      const pId =
        t.metadata?.projectId || t.metadata?.projectName || t.tags?.[0];
      if (pId && pId !== 'unknown') projectSet.add(pId);
    });

    const projects: Project[] = [
      { id: 'all', name: 'All Projects' },
      ...Array.from(projectSet).map((id) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
      })),
    ];

    // 3. Filter traces if a specific project is selected
    const filteredTraces =
      projectId && projectId !== 'all'
        ? allTraces.filter(
            (t: LangfuseTrace) =>
              t.metadata?.projectId === projectId ||
              t.metadata?.projectName === projectId ||
              t.tags?.includes(projectId)
          )
        : allTraces;

    const totalExecutions = filteredTraces.length;
    const sessionIds = new Set(
      filteredTraces.map((t: LangfuseTrace) => t.sessionId).filter(Boolean)
    );
    const activeWorkflows =
      sessionIds.size > 0 ? sessionIds.size : totalExecutions;

    const skillStats: Record<
      string,
      {
        executions: number;
        totalDuration: number;
        successful: number;
        totalTokens: number;
        totalCost: number;
        models: Set<string>;
      }
    > = {};
    const timeBuckets: Record<string, number> = {};

    filteredTraces.forEach((trace: LangfuseTrace) => {
      // Aggregate by skill
      let skillName = 'unknown';
      if (trace.name && trace.name.startsWith('skill:')) {
        skillName = trace.name.replace('skill:', '');
      } else if (trace.metadata?.skillName) {
        skillName = trace.metadata.skillName;
      } else if (trace.name) {
        skillName = trace.name;
      }

      if (!skillStats[skillName]) {
        skillStats[skillName] = {
          executions: 0,
          totalDuration: 0,
          successful: 0,
          totalTokens: 0,
          totalCost: 0,
          models: new Set<string>(),
        };
      }

      const stats = skillStats[skillName];
      stats.executions++;

      // Calculate duration
      const duration = trace.metadata?.duration || 0;
      stats.totalDuration += duration;

      // Accuracy - assume successful if no error is in metadata
      if (!trace.metadata?.error && !trace.metadata?.stack) {
        stats.successful++;
      }

      // Usage/Cost tracking
      const usage =
        trace.usage ||
        (trace.metadata?.usage as LangfuseUsage | undefined) ||
        {};
      const totalTokens =
        usage.totalTokens ||
        (usage.promptTokens || 0) + (usage.completionTokens || 0);
      stats.totalTokens += totalTokens;

      const cost =
        trace.totalCost || (trace.metadata?.cost as number | undefined) || 0;
      stats.totalCost += cost;

      if (trace.metadata?.model) {
        stats.models.add(trace.metadata.model as string);
      }

      // Aggregate by time
      const dateKey = new Date(trace.timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      timeBuckets[dateKey] = (timeBuckets[dateKey] || 0) + 1;
    });

    const topSkills = Object.entries(skillStats)
      .map(([name, stats]) => ({ name, total: stats.executions }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const tracesByTime = Object.entries(timeBuckets).map(([name, total]) => ({
      name,
      total,
    }));

    const skillInsights: SkillInsight[] = Object.entries(skillStats).map(
      ([name, stats]) => ({
        name,
        model: Array.from(stats.models).join(', ') || 'unknown',
        executions: stats.executions,
        estTokenCost:
          stats.executions > 0
            ? Math.round(stats.totalTokens / stats.executions)
            : 0,
        totalCost:
          stats.totalCost > 0
            ? stats.totalCost
            : Math.round(stats.totalTokens * 0.000002 * 100) / 100,
        avgDuration:
          stats.executions > 0 ? stats.totalDuration / stats.executions : 0,
        accuracy:
          stats.executions > 0
            ? (stats.successful / stats.executions) * 100
            : 0,
      })
    );

    return {
      totalExecutions,
      activeWorkflows:
        activeWorkflows > totalExecutions ? totalExecutions : activeWorkflows,
      projects,
      topSkills,
      tracesByTime,
      skillInsights,
    };
  } catch (error) {
    console.error('Error fetching metrics from Langfuse:', error);
    return {
      totalExecutions: 0,
      activeWorkflows: 0,
      projects: [{ id: 'all', name: 'All Projects' }],
      topSkills: [],
      tracesByTime: [],
      skillInsights: [],
    };
  }
}

interface PageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function PublicDashboard({ searchParams }: PageProps) {
  const { projectId = 'all' } = await searchParams;
  const metrics = await getGlobalMetrics(projectId);

  const selectedProject =
    metrics.projects.find((p) => p.id === projectId) || metrics.projects[0];

  return (
    <div className="flex flex-col min-h-screen bg-[#0f172a] text-slate-200 p-8 font-sans">
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
            value={`$${metrics.skillInsights.reduce((sum, s) => sum + s.totalCost, 0).toFixed(2)}`}
            subtitle="Calculated from LLM usage"
          />
          <KPICard
            title="Project Health"
            value={`${Math.round(metrics.skillInsights.reduce((sum, s) => sum + s.accuracy, 0) / (metrics.skillInsights.length || 1))}%`}
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
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400 text-sm font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4 border-b border-slate-800">
                      Skill Name
                    </th>
                    <th className="px-6 py-4 border-b border-slate-800">
                      LLM Model
                    </th>
                    <th className="px-6 py-4 border-b border-slate-800">
                      Executions
                    </th>
                    <th className="px-6 py-4 border-b border-slate-800">
                      Est. Token Cost (per run)
                    </th>
                    <th className="px-6 py-4 border-b border-slate-800">
                      Total execution cost
                    </th>
                    <th className="px-6 py-4 border-b border-slate-800">
                      Avg Duration
                    </th>
                    <th className="px-6 py-4 border-b border-slate-800 text-right">
                      Accuracy (Success Rate)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {metrics.skillInsights.map((skill) => (
                    <tr
                      key={skill.name}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-5">
                        <span className="font-mono text-indigo-400 font-semibold">
                          {skill.name}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-slate-400 text-sm">
                          {skill.model}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-slate-300 font-medium">
                        {skill.executions}
                      </td>
                      <td className="px-6 py-5 text-slate-400 italic">
                        {skill.estTokenCost > 0
                          ? `~${skill.estTokenCost}`
                          : '~0'}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                          <span className="text-slate-300 font-semibold">
                            ~{Math.round(skill.totalCost)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-slate-400">
                        {skill.avgDuration > 0
                          ? `${(skill.avgDuration / 1000).toFixed(1)}s`
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-sm font-bold border border-emerald-500/20">
                          {skill.accuracy.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {metrics.skillInsights.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-slate-500 italic"
                      >
                        No analytics data available for the selected project.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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
