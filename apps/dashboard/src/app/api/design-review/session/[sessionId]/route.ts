import { authOptions } from '@/lib/auth';
import { ReviewSession, ReviewSessionMetadata } from '@/lib/design-review-types';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

/**
 * @desc GET /api/design-review/session/[sessionId]
 * Returns the ReviewSession for a single session by Chat ID.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await params;

  try {
    // Fetch the full record — no select clause avoids the ChatSelect<DefaultArgs>
    // stale-type issue in Prisma v7 where metadata is not yet reflected in the
    // generated select type. All fields we need are on the full Chat record.
    const chat = await prisma.chat.findUnique({
      where: { id: sessionId },
    });

    if (!chat) {
      return NextResponse.json(
        { message: 'Session not found.' },
        { status: 404 }
      );
    }

    if (chat.userId !== session.user.id) {
      return NextResponse.json({ message: 'Access denied.' }, { status: 403 });
    }

    const meta = chat.metadata as unknown as ReviewSessionMetadata | null;
    if (!meta || meta.reviewType !== 'design-system-review') {
      return NextResponse.json(
        { message: 'Chat is not a design review session.' },
        { status: 400 }
      );
    }

    const reviewSession: ReviewSession = {
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
    };

    return NextResponse.json({ session: reviewSession });
  } catch (error) {
    console.error('[design-review/session] GET error:', error);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
