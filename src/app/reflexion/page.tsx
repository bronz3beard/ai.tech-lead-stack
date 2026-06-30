import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { getProjectAccessFilter } from '@/lib/access';
import { Suspense } from 'react';
import ReflexionClient from './ReflexionClient';

export default async function ReflexionPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  // Fetch only projects the user is authorized to see
  const projectsFromDb = await prisma.project.findMany({
    where: getProjectAccessFilter(session.user),
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      settings: true,
    }
  });

  const authorizedProjects = projectsFromDb.map((p) => {
    const settings = p.settings && typeof p.settings === 'object' ? p.settings as Record<string, unknown> : null;
    const hasConfig = settings && Object.values(settings).some(
      (v) => typeof v === 'string' && v.trim().length > 0 && v !== '********'
    );
    return {
      id: p.id,
      name: p.name,
      hasConfig: !!hasConfig,
    };
  });

  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl p-6">Loading Reflexion Loop...</div>}>
      <ReflexionClient projects={authorizedProjects} />
    </Suspense>
  );
}
