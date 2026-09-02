import { isSuperUser } from '@/lib/access';
import { authOptions } from '@/lib/auth';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import { Role } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const GrantAccessSchema = z
  .object({
    projectId: z.string().min(1),
    role: z.enum(Role).optional(),
    userId: z.string().optional(),
  })
  .refine((data) => data.role || data.userId, {
    message: 'Either role or userId must be provided',
  });

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

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
          id: true,
          role: true,
          userId: true,
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const formattedProjects = projects.map((p) => ({
    ...p,
    roleGrants: p.accessGrants.filter((ag) => ag.role).map((ag) => ag.role),
    userGrants: p.accessGrants
      .filter((ag) => ag.userId)
      .map((ag) => ({
        id: ag.id,
        userId: ag.userId,
        email: ag.user?.email,
        name: ag.user?.name,
      })),
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

    const { projectId, role, userId } = parsed.data;

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

    // Check if grant already exists to avoid duplicates
    const existing = await prisma.projectAccess.findFirst({
      where: {
        projectId,
        role: role || null,
        userId: userId || null,
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Access already granted',
      });
    }

    await prisma.projectAccess.create({
      data: {
        projectId,
        role,
        userId,
      },
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

    const { projectId, role, userId } = parsed.data;

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
        role: role || null,
        userId: userId || null,
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
