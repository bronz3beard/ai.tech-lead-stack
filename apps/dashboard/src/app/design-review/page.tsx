import { ReviewQueue } from '@/components/design-review/ReviewQueue';
import { getProjectAccessFilter } from '@/lib/access';
import { authOptions } from '@/lib/auth';
import {
  ReviewSession,
  ReviewSessionMetadata,
} from '@/lib/design-review-types';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Design Reviews — Tech Lead Stack',
  description:
    'AI-augmented design system review sessions with 2-iteration guard and designer quality gate.',
};

interface PageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function DesignReviewPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/signin');
  }

  // Resolve project: use searchParam or fall back to first accessible project
  const { projectId } = await searchParams;

  const authorizedProjects = await prisma.project.findMany({
    where: getProjectAccessFilter(
      session.user as { id: string; role: string; email?: string | null }
    ),
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  if (authorizedProjects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-full bg-zinc-950 text-zinc-400 p-8">
        <p>No projects found. Create a project in Agent Chat first.</p>
      </div>
    );
  }

  const activeProject =
    authorizedProjects.find((p) => p.id === projectId) ?? authorizedProjects[0];

  // Fetch design review sessions for the active project
  const reviewChats = await prisma.chat.findMany({
    where: {
      projectId: activeProject.id,
      userId: session.user.id,
      metadata: {
        path: ['reviewType'],
        equals: 'design-system-review',
      },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      projectId: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const sessions: ReviewSession[] = reviewChats.reduce<ReviewSession[]>(
    (acc, chat) => {
      const meta = chat.metadata as unknown as ReviewSessionMetadata | null;
      if (!meta || meta.reviewType !== 'design-system-review') return acc;
      acc.push({
        id: chat.id,
        component: meta.component,
        figmaUrl: meta.figmaUrl,
        chromaticBuildUrl: meta.chromaticBuildUrl,
        prUrl: meta.prUrl,
        initiatedBy: meta.initiatedBy || 'PM',
        iteration: meta.iteration,
        status: meta.status,
        alignmentScore: meta.alignmentScore,
        gateResults: meta.gateResults ?? [],
        projectId: chat.projectId,
        createdAt: chat.createdAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString(),
        deletedAt: meta.deletedAt,
      });
      return acc;
    },
    []
  );

  return (
    <ReviewQueue
      sessions={sessions}
      projectId={activeProject.id}
      projectName={activeProject.name}
    />
  );
}
