import { DashboardContent } from '@/components/dashboard/DashboardContent';
import {
  DEFAULT_ANALYTICS_LIMIT,
  getAnalytics,
  syncTracesFromLangfuse,
  TIMEFRAME_PRESETS,
} from '@/lib/analytics-service';
import { DateRange, describeDateRange, parseDateRange } from '@/lib/date-range';
import { authOptions } from '@/lib/auth';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { getProjectAccessFilter } from '@/lib/access';
import { loadAgenticHealth } from './agentic-health-loader';

export interface DashboardSearchParams {
  limit?: string;
  from?: string;
  to?: string;
  view?: string;
  project?: string;
}

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
  const rows = limit === -1 ? 'All runs' : `Latest ${cap.toLocaleString()} runs`;
  // Mirrors getAnalytics: an explicit date range replaces the timeframe preset.
  const preset =
    timeframe && TIMEFRAME_PRESETS.includes(timeframe) ? `timeframe '${timeframe}'` : undefined;
  const period = describeDateRange(dateRange) ?? preset;
  return period ? `${rows}, ${period}` : rows;
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

  const { limit, view, project, from, to } = await searchParams;
  const dateRange = parseDateRange({ from, to });
  const filterByUser = view === 'me';
  const parsedLimit =
    limit === 'all' ? -1 : (limit ? parseInt(limit, 10) : undefined);

  const timeframe: string | undefined =
    limit && !['10', '20', '50', '100'].includes(limit) ? limit : undefined;

  // Background sync (throttled)
  if (!filterByUser) {
    syncTracesFromLangfuse(50).catch(err =>
      console.error('[Dashboard] Background sync failed:', err)
    );
  }

  const traces = await getAnalytics({
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

  const agenticHealth = await loadAgenticHealth(
    { projectId: project },
    {
      id: resolvedUserId,
      role: user?.role || 'DEVELOPER',
      email: user?.email,
    }
  );

  return (
    <DashboardContent
      traces={traces}
      projects={projects}
      agenticHealth={agenticHealth}
      dataWindow={describeWindow({ limit: parsedLimit, timeframe, dateRange })}
      titlePrefix={filterByUser ? 'My Authenticated' : 'Global Telemetry'}
    />
  );
}
