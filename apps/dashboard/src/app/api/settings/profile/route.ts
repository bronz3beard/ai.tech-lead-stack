import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import { z } from 'zod';
import { ModelRoutingSchema } from '@zenithfoundry/tech-lead-stack/ai/model-routing-schema';

import { Prisma } from '@prisma/client';

const UpdateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  preferredModel: z.enum(['gemini', 'claude', 'openai', 'jules']).optional(),
  requirementsModel: z.string().optional(),
  auditModel: z.string().optional(),
  modelRouting: ModelRoutingSchema.optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      name: true,
      image: true,
      preferredModel: true,
      requirementsModel: true,
      auditModel: true,
      settings: true,
    },
  });

  if (!user) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }

  const settingsObj = (user.settings as Record<string, unknown> | null) ?? {};
  const modelRouting = (settingsObj.modelRouting as Record<string, string> | undefined) ?? {};

  return NextResponse.json({ ...user, modelRouting });
}

async function handleUpdate(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: unknown = await req.json();
    const parsed = UpdateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid request body', errors: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      firstName,
      lastName,
      preferredModel,
      requirementsModel,
      auditModel,
      modelRouting,
    } = parsed.data;

    let updatedSettings: Record<string, unknown> | undefined = undefined;

    if (modelRouting !== undefined) {
      const existingUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { settings: true },
      });
      const currentSettings =
        (existingUser?.settings as Record<string, unknown> | null) ?? {};
      const currentRouting =
        (currentSettings.modelRouting as Record<string, string> | undefined) ?? {};

      updatedSettings = {
        ...currentSettings,
        modelRouting: {
          ...currentRouting,
          ...modelRouting,
        },
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(preferredModel !== undefined ? { preferredModel } : {}),
        ...(requirementsModel !== undefined ? { requirementsModel } : {}),
        ...(auditModel !== undefined ? { auditModel } : {}),
        ...(updatedSettings !== undefined ? { settings: updatedSettings as Prisma.InputJsonValue } : {}),
      },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        image: true,
        preferredModel: true,
        requirementsModel: true,
        auditModel: true,
        settings: true,
      },
    });

    const savedRouting =
      ((updatedUser.settings as Record<string, unknown> | null)
        ?.modelRouting as Record<string, string> | undefined) ?? {};

    return NextResponse.json({
      message: 'Profile updated',
      user: { ...updatedUser, modelRouting: savedRouting },
      modelRouting: savedRouting,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  return handleUpdate(req);
}

export async function PATCH(req: Request) {
  return handleUpdate(req);
}
