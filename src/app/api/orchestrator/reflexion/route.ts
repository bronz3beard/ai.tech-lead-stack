import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runReflexion } from '@/lib/ai/reflexion/engine';
import { runnerFromUser } from '@/lib/ai/reflexion/providers-user';

export const maxDuration = 300; // reflexion can run several model round-trips

/**
 * POST /api/orchestrator/reflexion
 * Body: { brief: string, stack?: string, maxRevisions?: number, passThreshold?: number }
 *
 * Runs the Gemini-generates / Claude-grades loop using the signed-in user's
 * saved API keys, then returns the final plan, per-revision scores, and the
 * adjudicator's verdict for the UI to render.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { brief, stack, maxRevisions, passThreshold } = await req.json();
    if (!brief || typeof brief !== 'string' || brief.trim().length < 8) {
      return NextResponse.json(
        { error: 'A brief of at least a sentence is required.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Throws a clear, user-facing error if a key is missing.
    const runner = runnerFromUser(user);

    const result = await runReflexion(runner, {
      brief: brief.trim(),
      stack: typeof stack === 'string' ? stack : '',
      maxRevisions: Number.isInteger(maxRevisions) ? maxRevisions : 3,
      passThreshold: Number.isInteger(passThreshold) ? passThreshold : 8,
    });

    // ADVISORY ONLY. The web/chat surface is read-only: we return a reviewed
    // plan and an IDE hand-off prompt. We never apply changes here — code
    // mutation only happens when a developer runs the plan via an IDE agent
    // (the MCP/workflow path, which logs usage to Prisma).
    return NextResponse.json({ mode: 'advisory', ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reflexion run failed.';
    // Key/validation errors are the user's to fix -> 400; everything else 500.
    const isUserError = /API key|Settings|different models/i.test(message);
    return NextResponse.json({ error: message }, { status: isUserError ? 400 : 500 });
  }
}
