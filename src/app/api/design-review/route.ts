import { authOptions } from '@/lib/auth';
import {
  GateResult,
  ReviewSession,
  ReviewSessionMetadata,
  ReviewStatus,
} from '@/lib/design-review-types';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * @desc Safely casts a Chat.metadata Json value to ReviewSessionMetadata.
 * Returns null if the value is not a valid design review metadata object.
 */
function parseReviewMetadata(
  raw: unknown
): ReviewSessionMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.reviewType !== 'design-system-review') return null;
  return m as unknown as ReviewSessionMetadata;
}

/**
 * @desc Maps a Chat record + its metadata to the API-safe ReviewSession shape.
 */
function toReviewSession(chat: {
  id: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: unknown;
}): ReviewSession | null {
  const meta = parseReviewMetadata(chat.metadata);
  if (!meta) return null;
  return {
    id: chat.id,
    component: meta.component,
    figmaUrl: meta.figmaUrl,
    chromaticBuildUrl: meta.chromaticBuildUrl,
    iteration: meta.iteration,
    status: meta.status,
    alignmentScore: meta.alignmentScore,
    gateResults: meta.gateResults ?? [],
    projectId: chat.projectId,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
  };
}

// ─── GET /api/design-review?projectId=X ──────────────────────────────────────

/**
 * @desc Returns all design review sessions (Chat records tagged with
 * `reviewType: 'design-system-review'`) for the given project.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json(
      { message: 'projectId is required.' },
      { status: 400 }
    );
  }

  try {
    // Fetch all chats for this user+project, then discriminate by reviewType
    // in application code. Prisma v7's ChatWhereInput does not expose a
    // stable JSON path filter API — toReviewSession returns null for non-review
    // chats, so the filter below is the type-safe discriminator.
    const chats = await prisma.chat.findMany({
      where: {
        projectId,
        userId: session.user.id,
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

    const sessions = chats
      .map(toReviewSession)
      .filter((s): s is ReviewSession => s !== null);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('[design-review] GET error:', error);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 }
    );
  }
}

// ─── POST /api/design-review ──────────────────────────────────────────────────

/**
 * @desc Creates a new design review session. Internally this creates a Chat
 * record tagged with design-review metadata. Returns the new ReviewSession.
 *
 * @body `{ projectId, component, figmaUrl? }`
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId, component, figmaUrl } = (await req.json()) as {
      projectId: string;
      component: string;
      figmaUrl?: string;
    };

    if (!projectId || !component?.trim()) {
      return NextResponse.json(
        { message: 'projectId and component are required.' },
        { status: 400 }
      );
    }

    const metadata: ReviewSessionMetadata = {
      reviewType: 'design-system-review',
      component: component.trim(),
      figmaUrl: figmaUrl?.trim() || undefined,
      iteration: 1,
      status: 'IN_PROGRESS',
      gateResults: [],
    };

    const chat = await prisma.chat.create({
      data: {
        userId: session.user.id,
        projectId,
        title: `[DR] ${component.trim()}`,
        isCustomTitle: true,
        metadata: metadata as any,
      },
      select: {
        id: true,
        projectId: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const reviewSession = toReviewSession(chat);
    return NextResponse.json({ session: reviewSession }, { status: 201 });
  } catch (error) {
    console.error('[design-review] POST error:', error);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/design-review ─────────────────────────────────────────────────

/**
 * @desc Updates the session metadata for a design review (iteration, status,
 * gate results, alignment score). Called by the AI skill after each gate via
 * a `sync_design_review_session` tool, and by the user via UI controls.
 *
 * @body `{ sessionId, gateResults?, alignmentScore?, iteration?, status?, chromaticBuildUrl? }`
 */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const {
      sessionId,
      gateResults,
      alignmentScore,
      iteration,
      status: reviewStatus,
      chromaticBuildUrl,
    } = (await req.json()) as {
      sessionId: string;
      gateResults?: GateResult[];
      alignmentScore?: number;
      iteration?: 1 | 2;
      status?: ReviewStatus;
      chromaticBuildUrl?: string;
    };

    if (!sessionId) {
      return NextResponse.json(
        { message: 'sessionId is required.' },
        { status: 400 }
      );
    }

    const chat = await prisma.chat.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        projectId: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
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

    const currentMeta = parseReviewMetadata(chat.metadata);
    if (!currentMeta) {
      return NextResponse.json(
        { message: 'Chat is not a design review session.' },
        { status: 400 }
      );
    }

    // Merge — only update fields that were explicitly provided
    const updatedMeta: ReviewSessionMetadata = {
      ...currentMeta,
      ...(gateResults !== undefined && { gateResults }),
      ...(alignmentScore !== undefined && { alignmentScore }),
      ...(iteration !== undefined && { iteration }),
      ...(reviewStatus !== undefined && { status: reviewStatus }),
      ...(chromaticBuildUrl !== undefined && { chromaticBuildUrl }),
    };

    const updatedChat = await prisma.chat.update({
      where: { id: sessionId },
      data: { metadata: updatedMeta as any },
      select: {
        id: true,
        projectId: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ session: toReviewSession(updatedChat) });
  } catch (error) {
    console.error('[design-review] PATCH error:', error);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
