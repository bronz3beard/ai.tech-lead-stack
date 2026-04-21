import { isSuperUser } from '@/lib/access';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const GrantAccessSchema = z.object({
  projectId: z.string().min(1),
  role: z.enum(Role),
});

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // Only Developers/Admins manage project access (unless they are superusers)
  const isSuper = isSuperUser(session.user.email);
  if (
    session.user.role !== 'DEVELOPER' &&
    session.user.role !== 'ADMIN' &&
    !isSuper
  ) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const isPrivilegedRole = session.user.role === 'ADMIN' || isSuper;

  const projects = await prisma.project.findMany({
    where: isPrivilegedRole ? {} : { ownerId: session.user.id },
    select: {
      id: true,
      name: true,
      repoUrl: true,
      accessGrants: {
        select: {
          role: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const formattedProjects = projects.map((p) => ({
    ...p,
    accessGrants: p.accessGrants.map((ag) => ag.role),
  }));

  return NextResponse.json({ projects: formattedProjects });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: unknown = await req.json();
    const parsed = GrantAccessSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid request body', errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { projectId, role } = parsed.data;

    const isSuper = isSuperUser(session.user.email);
    const project = await prisma.project.findFirst({
      where: isSuper
        ? { id: projectId }
        : { id: projectId, ownerId: session.user.id },
    });

    if (!project) {
      return NextResponse.json(
        { message: 'Project not found or you are not the owner' },
        { status: 404 }
      );
    }

    await prisma.projectAccess.upsert({
      where: {
        projectId_role: {
          projectId,
          role,
        },
      },
      create: {
        projectId,
        role,
      },
      update: {}, // Do nothing if it exists
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error granting project access:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: unknown = await req.json();
    const parsed = GrantAccessSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid request body', errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { projectId, role } = parsed.data;

    const isSuper = isSuperUser(session.user.email);
    const project = await prisma.project.findFirst({
      where: isSuper
        ? { id: projectId }
        : { id: projectId, ownerId: session.user.id },
    });

    if (!project) {
      return NextResponse.json(
        { message: 'Project not found or you are not the owner' },
        { status: 404 }
      );
    }

    await prisma.projectAccess.deleteMany({
      where: {
        projectId,
        role,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking project access:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
