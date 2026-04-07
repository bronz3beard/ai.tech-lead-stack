import { TraceData } from '@/components/dashboard/DashboardContent';
import { DashboardDisclaimer } from '@/components/dashboard/DashboardDisclaimer';
import { InsightsTable } from '@/components/dashboard/InsightsTable';
import { ProjectSelect, type Project } from '@/components/ProjectSelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, LineChart } from '@/components/ui/chart';
import { fetchAllPages } from '@/lib/langfuse-api';
import { langfuseLabel } from '@/lib/langfuse-labels';
import { isSkillTrace, normalizeProjectName, isActiveSkill, normalizeSkillName } from '@/lib/trace-utils';

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
  model?: string;
  agent?: string;
  [key: string]: string | number | boolean | undefined;
}

interface LangfuseUsage {
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
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
  duration?: number;
  status?: string;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
}


async function getGlobalMetrics(projectId?: string) {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

  if (!publicKey || !secretKey || publicKey === 'placeholder') {
    return {
      totalExecutions: 0,
      activeWorkflows: 0,
      projects: [{ id: 'all', name: 'All Projects' }],
      topSkills: [],
      tracesByTime: [],
      traces: [],
    };
  }

  const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`;

  try {
    // 1. Fetch ALL traces (or a reasonable large set for global metrics)
    const queryParams = new URLSearchParams();
    // Increase limit for global dashboard to get a good historical view
    const allTraces = await fetchAllPages<LangfuseTrace>(
      baseUrl,
      '/api/public/traces',
      queryParams,
      authHeader,
      2000 // Increased limit to 2000 to be more exhaustive across multiple projects
    );

    // 2. Skill Validation (isActiveSkill is imported from trace-utils)

    // 3. Process traces and aggregate available projects
    const projectSet = new Set<string>();
    
    // We no longer fetch observations separately to avoid 429 and improve speed
    // Most semantic metadata (projectName, model, agent) is now stored in trace metadata
    
    // 4. Map and Filter traces
    const mappedTraces: TraceData[] = allTraces.map((t) => {
      const metadata = t.metadata || {};
      
      // Exhaustive search for project identity across metadata
      const rawProj = 
        metadata.projectName || 
        metadata.projectId || 
        metadata.project || 
        metadata.repo || 
        metadata.repository ||
        metadata.app ||
        metadata.domain;
        
      const normalizedProj = normalizeProjectName(String(rawProj || 'unknown'));
      if (normalizedProj !== 'unknown') {
        projectSet.add(normalizedProj);
      }

      return {
        id: t.id,
        name: t.name || 'unnamed-trace',
        timestamp: t.timestamp,
        sessionId: t.sessionId,
        projectName: normalizedProj,
        model: langfuseLabel(metadata.model as string),
        agent: langfuseLabel(metadata.agent as string),
        duration: t.duration,
        status: t.status,
        metadata: metadata,
        totalCost: t.totalCost || 0,
        totalTokens: t.totalTokens || t.usage?.totalTokens || 0,
        inputTokens:
          t.inputTokens || t.usage?.inputTokens || t.usage?.promptTokens || 0,
        outputTokens:
          t.outputTokens ||
          t.usage?.outputTokens ||
          t.usage?.completionTokens ||
          0,
      };
    }).filter(trace => {
        // Strict Skill Filtering
        let rawSkillName = 'unknown';
        if (trace.name && trace.name.startsWith('skill:')) {
          rawSkillName = trace.name.replace('skill:', '');
        } else if (trace.metadata?.skillName) {
          rawSkillName = trace.metadata.skillName as string;
        } else if (trace.name) {
          rawSkillName = trace.name;
        }
        
        const skillName = normalizeSkillName(rawSkillName);

        // Broadened Skill Validation
        return isActiveSkill(skillName) && !isSkillTrace(trace.name, skillName);
    });

    const projects: Project[] = [
      { id: 'all', name: 'All Projects' },
      ...Array.from(projectSet)
        .map((id) => ({
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ];

    // 5. Final project-specific filtering
    const finalTraces = mappedTraces.filter((t) => {
      if (!projectId || projectId === 'all') return true;
      return t.projectName === projectId.toLowerCase();
    });

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
      let rawSkillName = 'unknown';
      if (trace.name && trace.name.startsWith('skill:')) {
        rawSkillName = trace.name.replace('skill:', '');
      } else if (trace.metadata?.skillName) {
        rawSkillName = trace.metadata.skillName as string;
      } else if (trace.name) {
        rawSkillName = trace.name;
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
      .slice(0, 10); // Show more skills in public dashboard

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
    console.error('Error fetching metrics from Langfuse:', error);
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
  const metrics = await getGlobalMetrics(projectId);

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
