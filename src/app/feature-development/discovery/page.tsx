import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { getProjectAccessFilter } from '@/lib/access';
import DiscoveryClient from './DiscoveryClient';

export default async function DiscoveryPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/signin');
  }

  // Fetch only projects the user is authorized to see
  const authorizedProjects = await prisma.project.findMany({
    where: getProjectAccessFilter(session.user),
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      githubFullName: true,
    }
  });

  return <DiscoveryClient projects={authorizedProjects} />;
}
