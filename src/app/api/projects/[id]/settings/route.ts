import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { encrypt } from '@/lib/crypto';

const UpdateProjectSettingsSchema = z.object({
  settings: z.object({
    discordWebhookUrl: z.string().url().optional().or(z.literal('')),
    discordDevWebhookUrl: z.string().url().optional().or(z.literal('')),
    designSystemPath: z
      .string()
      .refine((val) => val === '' || (!val.startsWith('/') && !val.startsWith('~') && !val.match(/^[A-Z]:\\/i)), {
        message:
          'designSystemPath must be a relative path from the project root (e.g. "libs/gilly-ui/src/components"). Do not use an absolute path starting with /, ~, or a Windows drive letter.',
      })
      .optional()
      .or(z.literal('')),
    figmaApiKey: z.string().optional().or(z.literal('')),
    chromaticApiKey: z.string().optional().or(z.literal('')),
  }),
});

/**
 * @desc Updates the integration settings for a project.
 * Only the project owner (ownerId) may update settings.
 *
 * @param req Body: { settings: { discordWebhookUrl?, discordDevWebhookUrl?, designSystemPath?, figmaApiKey?, chromaticApiKey? } }
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
  // Empty strings are treated as deletions (the key is removed from the JSON)
  const existingSettings = (project.settings ?? {}) as Record<string, unknown>;
  const { 
    discordWebhookUrl, 
    discordDevWebhookUrl, 
    designSystemPath,
    figmaApiKey,
    chromaticApiKey
  } = parsed.data.settings;
  const newSettings = {
    ...existingSettings,
    ...(discordWebhookUrl !== ''
      ? { discordWebhookUrl }
      : { discordWebhookUrl: undefined }),
    ...(discordDevWebhookUrl !== ''
      ? { discordDevWebhookUrl }
      : { discordDevWebhookUrl: undefined }),
    ...(designSystemPath !== ''
      ? { designSystemPath }
      : { designSystemPath: undefined }),
    ...(figmaApiKey && figmaApiKey !== '********'
      ? { figmaApiKey: encrypt(figmaApiKey) }
      : figmaApiKey === '' ? { figmaApiKey: undefined } : {}),
    ...(chromaticApiKey && chromaticApiKey !== '********'
      ? { chromaticApiKey: encrypt(chromaticApiKey) }
      : chromaticApiKey === '' ? { chromaticApiKey: undefined } : {}),
  };

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { settings: newSettings },
    select: { id: true, name: true, settings: true },
  });

  // Mask sensitive keys in the response
  const sanitizedSettings = {
    ...(updated.settings as Record<string, unknown>),
    figmaApiKey: (updated.settings as any)?.figmaApiKey ? '********' : undefined,
    chromaticApiKey: (updated.settings as any)?.chromaticApiKey ? '********' : undefined,
  };

  return NextResponse.json({ 
    project: { 
      ...updated, 
      settings: sanitizedSettings 
    } 
  });
}
