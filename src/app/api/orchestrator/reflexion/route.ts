import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runReflexion } from '@/lib/ai/reflexion/engine';
import { runnerFromUser } from '@/lib/ai/reflexion/providers-user';
import { getProjectAccessFilter } from '@/lib/access';
import { createGitHubClient } from '@/lib/github/client';

export const maxDuration = 300; // reflexion can run several model round-trips

/**
 * POST /api/orchestrator/reflexion
 * Body: { brief: string, projectId?: string, maxRevisions?: number, passThreshold?: number }
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

    const { brief, projectId, maxRevisions, passThreshold } = await req.json();
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

    let stack = '';
    if (projectId && typeof projectId === 'string') {
      const project = await prisma.project.findFirst({
        where: { AND: [{ id: projectId }, getProjectAccessFilter(session.user)] },
        select: { name: true, githubFullName: true, repoUrl: true, description: true },
      });
      if (project) {
        stack =
          `PROJECT: ${project.name}` +
          (project.githubFullName ? ` (${project.githubFullName})` : '') + `\n` +
          (project.description ? `DESCRIPTION: ${project.description}\n` : '') +
          (project.repoUrl ? `REPO: ${project.repoUrl}\n` : '');

        // Option C: Deeper grounding: read package.json & tsconfig.json if possible
        if (project.githubFullName) {
          try {
            const client = await createGitHubClient(session.user.id, projectId);
            
            // Read package.json
            const packageJson = await client.getFileContent('package.json');
            if (packageJson) {
              const packageJsonSnippet = packageJson.substring(0, 1800);
              stack += `\n### package.json\n${packageJsonSnippet}\n`;
            }

            // Read tsconfig.json
            const tsconfigJson = await client.getFileContent('tsconfig.json');
            if (tsconfigJson) {
              const tsconfigSnippet = tsconfigJson.substring(0, 1800);
              stack += `\n### tsconfig.json\n${tsconfigSnippet}\n`;
            }
          } catch (err) {
            console.error('Failed to load repo files for grounding:', err);
            // Fall back silently to the metadata-only stack already built in `stack`
          }
        }
      }
    }

    // Throws a clear, user-facing error if a key is missing.
    const runner = runnerFromUser(user);

    const result = await runReflexion(runner, {
      brief: brief.trim(),
      stack,
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
