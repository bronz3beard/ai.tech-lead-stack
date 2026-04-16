import {
  DashboardContent,
} from '@/components/dashboard/DashboardContent';
import { authOptions } from '@/lib/auth';
import { getAnalytics } from '@/lib/analytics-service';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

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

  const { limit, from, to, view, project } = await searchParams;
  const filterByUser = view === 'me';
  const parsedLimit =
    limit === 'all' || !limit ? undefined : parseInt(limit, 10);

  const timeframe: string | undefined =
    limit && !['10', '20', '50', '100'].includes(limit) ? limit : undefined;

  const traces = await getAnalytics({
    userId: filterByUser ? resolvedUserId : undefined,
    userEmail: filterByUser ? userEmail : undefined,
    timeframe: timeframe,
    limit: parsedLimit,
  });

  // Fetch all projects for "Public" view as requested
  const authorizedProjects = await prisma.project.findMany({
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
      titlePrefix={filterByUser ? "My Authenticated" : "Global Telemetry"}
    />
  );
}
