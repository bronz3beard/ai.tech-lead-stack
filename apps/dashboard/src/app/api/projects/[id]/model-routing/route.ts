import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import { isSuperUser } from '@/lib/access';
import { Role, Prisma } from '@prisma/client';
import {
  ModelRoutingSchema,
  RESPONSIBILITIES,
  Responsibility,
} from '@zenithfoundry/tech-lead-stack/ai/model-routing-schema';
import { resolveModelWithSource } from '@zenithfoundry/tech-lead-stack/ai/model-resolver';

async function checkAuth(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return { error: NextResponse.json({ message: 'User not found' }, { status: 404 }) };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return { error: NextResponse.json({ message: 'Project not found' }, { status: 404 }) };
  }

  const isOwner = project.ownerId === user.id;
  const isAdmin = user.role === Role.ADMIN || isSuperUser(user.email);

  if (!isOwner && !isAdmin) {
    return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) };
  }

  return { user, project };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await checkAuth(projectId);
  if (auth.error) return auth.error;

  const { user, project } = auth;

  const routing =
    ((project.settings as Record<string, unknown> | null)
      ?.modelRouting as Record<string, string> | undefined) ?? {};

  const effective = {} as Record<
    Responsibility,
    { model: string; source: string }
  >;

  for (const role of RESPONSIBILITIES) {
    const res = resolveModelWithSource(role, { user, project });
    effective[role] = { model: res.id, source: res.source };
  }

  return NextResponse.json({ routing, effective });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await checkAuth(projectId);
  if (auth.error) return auth.error;

  const { project } = auth;

  try {
    const body: unknown = await req.json();
    const parsed = ModelRoutingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid request body', errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const currentSettings =
      (project.settings as Record<string, unknown> | null) ?? {};
    const currentRouting =
      (currentSettings.modelRouting as Record<string, string> | undefined) ?? {};

    const newRouting = {
      ...currentRouting,
      ...parsed.data,
    };

    const newSettings = {
      ...currentSettings,
      modelRouting: newRouting,
    };

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { settings: newSettings as Prisma.InputJsonValue },
      select: { settings: true },
    });

    const savedRouting =
      ((updated.settings as Record<string, unknown> | null)
        ?.modelRouting as Record<string, string> | undefined) ?? {};

    return NextResponse.json({
      message: 'Project model routing updated',
      routing: savedRouting,
    });
  } catch (error) {
    console.error('Error updating project model routing:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
