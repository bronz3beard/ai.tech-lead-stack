'use server';

import { getProjectAccessFilter, isSuperUser } from '@/lib/access';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';

export async function addProjectUser(projectId: string, targetUserId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Unauthorized');

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });

  const isOwner = project?.ownerId === session.user.id;
  const isSuperAdmin = isSuperUser(session.user.email);

  if (!project || (!isOwner && !isSuperAdmin)) {
    throw new Error('Unauthorized');
  }

  await prisma.projectAccess.create({
    data: {
      projectId,
      userId: targetUserId,
    },
  });

  revalidatePath('/settings');
}

export async function addProjectUserByEmail(projectId: string, email: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Unauthorized');

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });

  const isOwner = project?.ownerId === session.user.id;
  const isSuperAdmin = isSuperUser(session.user.email);

  if (!project || (!isOwner && !isSuperAdmin)) {
    throw new Error('Unauthorized');
  }

  // Find or create a placeholder user for this email
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        role: 'DEVELOPER', // Default role for new placeholder users
      },
    });
  }

  // Check if they already have access
  const existingAccess = await prisma.projectAccess.findFirst({
    where: {
      projectId,
      userId: user.id,
    },
  });

  if (!existingAccess) {
    await prisma.projectAccess.create({
      data: {
        projectId,
        userId: user.id,
      },
    });
  }

  revalidatePath('/settings');
  return user;
}

export async function removeProjectUser(
  projectId: string,
  targetUserId: string
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Unauthorized');

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });

  const isOwner = project?.ownerId === session.user.id;
  const isSuperAdmin = isSuperUser(session.user.email);

  if (!project || (!isOwner && !isSuperAdmin)) {
    throw new Error('Unauthorized');
  }

  await prisma.projectAccess.deleteMany({
    where: {
      projectId,
      userId: targetUserId,
    },
  });

  revalidatePath('/settings');
}

export async function getSettingsProjects() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return [];

  const filter = getProjectAccessFilter(session.user as any);

  const projects = await prisma.project.findMany({
    where: filter,
    include: {
      accessGrants: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return projects.map((p) => {
    const hasConfig =
      p.settings &&
      typeof p.settings === 'object' &&
      Object.values(p.settings).some(
        (v) => typeof v === 'string' && v.trim().length > 0 && v !== '********'
      );
    return {
      id: p.id,
      name: p.name,
      hasConfig: !!hasConfig,
      roleGrants: p.accessGrants.filter((ag) => ag.role).map((ag) => ag.role as string),
      userGrants: p.accessGrants
        .filter((ag) => ag.userId && ag.user)
        .map((ag) => ({
          id: ag.id,
          userId: ag.userId!,
          email: ag.user!.email || 'No Email',
          name: ag.user!.name ?? undefined,
        })),
    };
  });
}
