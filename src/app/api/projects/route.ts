import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getProjectAccessFilter } from '@/lib/access';

const RegisterProjectSchema = z.object({
  name: z.string().min(1),
  githubFullName: z.string().min(1), // e.g. "owner/repo"
  repoUrl: z.string().url(),
  description: z.string().optional(),
});

/**
 * @desc Returns all Projects that belong to the signed-in DEVELOPER.
 *       Returns an empty array when no projects have been registered yet —
 *       the frontend will show the "connect a repo" empty state.
 *
 * @returns 200 { projects: Project[] }
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: getProjectAccessFilter(session.user),
    orderBy: { name: 'asc' },
    select: { id: true, name: true, githubFullName: true, repoUrl: true, description: true },
  });

  return NextResponse.json({ projects });
}

/**
 * @desc Registers (imports) a GitHub repository as a Project for the signed-in user.
 *       Uses upsert on `githubFullName` so duplicates are idempotent — a second
 *       "Connect" press just re-assigns ownership rather than failing.
 *
 * @param req Body: { name, githubFullName, repoUrl, description? }
 * @returns 201 { project: Project }
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await req.json();
  const parsed = RegisterProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid request body', errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, githubFullName, repoUrl, description } = parsed.data;

  const project = await prisma.project.upsert({
    where: { githubFullName },
    create: {
      name,
      githubFullName,
      repoUrl,
      description,
      ownerId: session.user.id,
    },
    update: {
      // If the project already existed (orphaned), claim it and update metadata.
      ownerId: session.user.id,
      name,
      repoUrl,
      description,
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
