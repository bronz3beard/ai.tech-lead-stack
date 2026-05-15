'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function addProjectUser(projectId: string, targetUserId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Unauthorized');

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });

  if (!project || project.ownerId !== session.user.id) {
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

export async function removeProjectUser(projectId: string, targetUserId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Unauthorized');

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });

  if (!project || project.ownerId !== session.user.id) {
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

  const projects = await prisma.project.findMany({
    where: { ownerId: session.user.id },
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
    const hasConfig = p.settings && typeof p.settings === 'object' && Object.values(p.settings).some(v => typeof v === 'string' && v.trim().length > 0 && v !== '********');
    return {
      id: p.id,
      name: p.name,
      hasConfig: !!hasConfig,
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
