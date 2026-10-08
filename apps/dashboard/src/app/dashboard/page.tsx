import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { getProjectAccessFilter } from '@/lib/access';
import { loadAiImpact } from '@/lib/ai-impact-loader';
import {
  DEFAULT_ANALYTICS_LIMIT,
  getAnalytics,
  resolveAnalyticsScope,
  TIMEFRAME_PRESETS,
} from '@/lib/analytics-service';
import { authOptions } from '@/lib/auth';
import { DateRange, describeDateRange, parseDateRange } from '@/lib/date-range';
import { getSpendSummary } from '@/lib/usage-aggregates';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { loadAgenticHealth } from './agentic-health-loader';

/** URL params are untrusted input; anything that fails validation is ignored. */
const DashboardSearchParamsSchema = z.object({
  limit: z.string().trim().max(10).optional(),
  from: z.string().trim().max(10).optional(),
  to: z.string().trim().max(10).optional(),
  view: z.enum(['global', 'me']).optional(),
  project: z.string().trim().max(200).optional(),
});

export type DashboardSearchParams = Record<
  string,
  string | string[] | undefined
>;

/** Describes the rows getAnalytics returns for these inputs, so each card can state its window. */
function describeWindow({
  limit,
  timeframe,
  dateRange,
}: {
  limit: number | undefined;
  timeframe: string | undefined;
  dateRange: DateRange;
}): string {
  const cap = limit && !Number.isNaN(limit) ? limit : DEFAULT_ANALYTICS_LIMIT;
  const rows =
    limit === -1 ? 'All runs' : `Latest ${cap.toLocaleString()} runs`;
  // Mirrors getAnalytics: an explicit date range replaces the timeframe preset.
  const preset =
    timeframe && TIMEFRAME_PRESETS.includes(timeframe)
      ? `timeframe '${timeframe}'`
      : undefined;
  const period = describeDateRange(dateRange) ?? preset;
  return period ? `${rows}, ${period}` : rows;
}

/** The spend panel aggregates every row in the window, so only the period is described. */
function describeSpendWindow({
  timeframe,
  dateRange,
}: {
  timeframe: string | undefined;
  dateRange: DateRange;
}): string {
  const preset =
    timeframe && TIMEFRAME_PRESETS.includes(timeframe)
      ? `timeframe '${timeframe}'`
      : undefined;
  return describeDateRange(dateRange) ?? preset ?? 'All time';
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/signin');
  }

  const userEmail = session.user.email;
  if (!userEmail) {
    redirect('/signin');
  }

  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  const resolvedUserId = user ? user.id : userEmail;

  const parsedParams = DashboardSearchParamsSchema.safeParse(
    await searchParams
  );
  const { limit, view, project, from, to } = parsedParams.success
    ? parsedParams.data
    : {};
  const dateRange = parseDateRange({ from, to });
  const filterByUser = view === 'me';
  const parsedLimit =
    limit === 'all' ? -1 : limit ? parseInt(limit, 10) : undefined;

  const timeframe: string | undefined =
    limit && !['10', '20', '50', '100'].includes(limit) ? limit : undefined;

  const accessUser = {
    id: resolvedUserId,
    role: user?.role || 'DEVELOPER',
    email: user?.email,
  };
  const scope = await resolveAnalyticsScope(accessUser);

  const traces = await getAnalytics({
    scope,
    userId: filterByUser ? resolvedUserId : undefined,
    userEmail: filterByUser ? userEmail : undefined,
    timeframe: timeframe,
    dateRange,
    projectName: project,
    limit: parsedLimit,
  });

  // Fetch only projects the user is authorized to see
  const authorizedProjects = await prisma.project.findMany({
    where: getProjectAccessFilter(session.user),
    orderBy: { name: 'asc' },
  });

  const projects = authorizedProjects.map((p) => ({
    id: p.id,
    name: p.name,
    ownerId: p.ownerId,
  }));

  const singleProject = project && project !== 'all' ? project : undefined;
  const [agenticHealth, spend, aiImpact] = await Promise.all([
    loadAgenticHealth({ projectId: project }, accessUser, scope),
    getSpendSummary({
      scope,
      user: filterByUser ? { userId: resolvedUserId, userEmail } : undefined,
      projectName: project,
      timeframe,
      dateRange,
    }),
    singleProject
      ? loadAiImpact({
          user: accessUser,
          projectName: singleProject,
          dateRange,
        })
      : Promise.resolve(undefined),
  ]);

  return (
    <DashboardContent
      traces={traces}
      projects={projects}
      agenticHealth={agenticHealth}
      dataWindow={describeWindow({ limit: parsedLimit, timeframe, dateRange })}
      spend={spend}
      aiImpact={aiImpact}
      spendScopeLabel={describeSpendWindow({ timeframe, dateRange })}
      titlePrefix={filterByUser ? 'My Authenticated' : 'Global Telemetry'}
    />
  );
}
