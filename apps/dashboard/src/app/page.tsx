import { DashboardDisclaimer } from '@/components/dashboard/DashboardDisclaimer';
import { ProjectSelect, type Project } from '@/components/ProjectSelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, LineChart } from '@/components/ui/chart';
import { authOptions } from '@/lib/auth';
import { getProjectAccessFilter } from '@/lib/access';
import {
  DEFAULT_SERIES_DAYS,
  getAdoptionSummary,
  type AdoptionSummary,
} from '@/lib/usage-aggregates';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import { normalizeProjectName } from '@zenithfoundry/tech-lead-stack/trace-utils';
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { z } from 'zod';

/**
 * Public adoption view: counts only, never spend. Anonymous visitors see the
 * all-projects aggregate; signed-in users can narrow to projects they can access.
 * Spend and per-session detail live on /dashboard, behind sign-in.
 */

const SearchParamsSchema = z.object({
  projectId: z.string().trim().max(200).optional(),
});

const EMPTY_SUMMARY: AdoptionSummary = {
  skillsLoaded: 0,
  llmCalls: 0,
  sessions: 0,
  projects: 0,
  people: 0,
  actorSplit: { human: 0, agent: 0, unknown: 0 },
  topSkills: [],
  dailySkillLoads: [],
};

async function loadSelectableProjects(
  user: { id: string; role: string; email?: string | null } | undefined
): Promise<Project[]> {
  if (!user) return [];
  const rows = await prisma.project.findMany({
    where: getProjectAccessFilter(user),
    select: { name: true },
    orderBy: { name: 'asc' },
  });
  return rows.map((p) => ({
    id: normalizeProjectName(p.name),
    name: p.name.charAt(0).toUpperCase() + p.name.slice(1).replace(/-/g, ' '),
  }));
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PublicDashboard({ searchParams }: PageProps) {
  const parsed = SearchParamsSchema.safeParse(await searchParams);
  const requestedProject = parsed.success ? parsed.data.projectId : undefined;

  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.warn('[PublicDashboard] No session, continuing anonymously:', error);
  }

  const sessionUser = session?.user?.id
    ? { id: session.user.id, role: session.user.role, email: session.user.email }
    : undefined;
  const projects = await loadSelectableProjects(sessionUser);
  // Only a project the viewer can access narrows the view; anything else shows the aggregate.
  const selected = projects.find((p) => p.id === requestedProject);

  let summary = EMPTY_SUMMARY;
  try {
    summary = await getAdoptionSummary({ scope: null, projectName: selected?.id });
  } catch (error) {
    console.error('[PublicDashboard] Failed to load adoption summary:', error);
  }

  const actorTotal = summary.actorSplit.human + summary.actorSplit.agent;
  const agentShare = actorTotal > 0 ? Math.round((summary.actorSplit.agent / actorTotal) * 100) : 0;

  return (
    <div className="flex flex-col min-h-full bg-[#0f172a] text-slate-200 p-8 font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-12">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h1 className="text-5xl font-extrabold tracking-tight bg-linear-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Global Public Dashboard
            </h1>
            <p className="text-slate-400 mt-3 text-xl font-medium">
              Adoption for:{' '}
              <span className="text-indigo-400 font-bold border-b-2 border-indigo-400/30 pb-1">
                {selected?.name ?? 'All Projects'}
              </span>
            </p>
          </div>

          {projects.length > 0 && (
            <div className="flex items-center">
              <ProjectSelect
                projects={[{ id: 'all', name: 'All Projects' }, ...projects]}
                selectedProjectId={selected?.id ?? 'all'}
              />
            </div>
          )}
        </div>

        <section aria-label="Adoption totals" className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Skills Loaded"
            value={summary.skillsLoaded.toLocaleString()}
            subtitle="Skill files served to agents and chat, all time"
          />
          <KPICard
            title="Sessions"
            value={summary.sessions.toLocaleString()}
            subtitle="Distinct chat, loop and agent sessions (recorded since Oct 2026)"
          />
          <KPICard
            title="Active Projects"
            value={summary.projects.toLocaleString()}
            subtitle={`${summary.people.toLocaleString()} signed-in people`}
          />
          <KPICard
            title="Agent-Initiated"
            value={`${agentShare}%`}
            subtitle={`${summary.actorSplit.agent.toLocaleString()} agent of ${actorTotal.toLocaleString()} skill loads and LLM calls`}
          />
        </section>

        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-7">
          <Card className="lg:col-span-4 border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
            <CardHeader className="pb-0">
              <CardTitle className="text-2xl font-bold text-white mb-2">Most Used Skills</CardTitle>
              <p className="text-slate-400">Skill loads, all time, top 10.</p>
            </CardHeader>
            <CardContent className="pt-6">
              <BarChart data={summary.topSkills} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
            <CardHeader className="pb-0">
              <CardTitle className="text-2xl font-bold text-white mb-2">Activity Timeline</CardTitle>
              <p className="text-slate-400">
                Skill loads per day (UTC), last {DEFAULT_SERIES_DAYS} days.
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <LineChart data={summary.dailySkillLoads} />
            </CardContent>
          </Card>
        </div>

        <p className="text-slate-400 text-sm">
          Spend, providers, sessions and reflexion health are on the{' '}
          <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 underline">
            signed-in dashboard
          </Link>
          .
        </p>

        <DashboardDisclaimer />
      </div>
    </div>
  );
}

function KPICard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-xl hover:border-indigo-500/40 transition-all duration-300 group">
      <CardHeader className="pb-2">
        <h2 className="text-slate-400 text-sm font-semibold uppercase tracking-widest group-hover:text-indigo-400 transition-colors">
          {title}
        </h2>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-extrabold text-white mb-2">{value}</p>
        <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
