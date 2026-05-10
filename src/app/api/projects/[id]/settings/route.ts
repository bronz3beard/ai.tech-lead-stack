import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const UpdateProjectSettingsSchema = z.object({
  settings: z.object({
    discordWebhookUrl: z.string().url().optional().or(z.literal('')),
    discordDevWebhookUrl: z.string().url().optional().or(z.literal('')),
  }),
});

/**
 * @desc Updates the integration settings (webhook URLs) for a project.
 * Only the project owner (ownerId) may update settings.
 *
 * @param req Body: { settings: { discordWebhookUrl?, discordDevWebhookUrl? } }
 * @returns 200 { project: { id, settings } }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ message: 'Project not found' }, { status: 404 });
  }
  if (project.ownerId !== session.user.id) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body: unknown = await req.json();
  const parsed = UpdateProjectSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid request', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Deep-merge new settings into existing settings JSON
  const existingSettings = (project.settings ?? {}) as Record<string, unknown>;
  const newSettings = {
    ...existingSettings,
    // Treat empty strings as deletions (remove key)
    ...(parsed.data.settings.discordWebhookUrl !== ''
      ? { discordWebhookUrl: parsed.data.settings.discordWebhookUrl }
      : { discordWebhookUrl: undefined }),
    ...(parsed.data.settings.discordDevWebhookUrl !== ''
      ? { discordDevWebhookUrl: parsed.data.settings.discordDevWebhookUrl }
      : { discordDevWebhookUrl: undefined }),
  };

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { settings: newSettings },
    select: { id: true, name: true, settings: true },
  });

  return NextResponse.json({ project: updated });
}
