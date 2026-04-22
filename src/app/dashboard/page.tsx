import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { getAnalytics, syncTracesFromLangfuse } from '@/lib/analytics-service';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { getProjectAccessFilter } from '@/lib/access';

export interface DashboardSearchParams {
  limit?: string;
  from?: string;
  to?: string;
  view?: string;
  project?: string;
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

  const { limit, view, project } = await searchParams;
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

  return (
    <DashboardContent
      traces={traces}
      projects={projects}
      titlePrefix={filterByUser ? 'My Authenticated' : 'Global Telemetry'}
    />
  );
}
