import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { encrypt } from '@/lib/crypto';
import { isSuperUser } from '@/lib/access';

const UpdateProjectSettingsSchema = z.object({
  settings: z.object({
    discordWebhookUrl: z.union([z.string().url(), z.literal('')]).optional(),
    discordDevWebhookUrl: z.union([z.string().url(), z.literal('')]).optional(),
    designSystemPath: z.union([
      z.string().refine((val) => val === '' || (!val.startsWith('/') && !val.startsWith('~') && !val.match(/^[A-Z]:\\/i)), {
        message: 'designSystemPath must be a relative path from the project root (e.g. "libs/gilly-ui/src/components").',
      }),
      z.literal(''),
    ]).optional(),
    figmaApiKey: z.union([z.string(), z.literal('')]).optional(),
    chromaticApiKey: z.union([z.string(), z.literal('')]).optional(),
    clickupApiKey: z.union([z.string(), z.literal('')]).optional(),
    encryptedEnvVars: z.union([z.string(), z.literal('')]).optional(),
  }),
});

/**
 * @desc Updates the integration settings for a project.
 * Only the project owner (ownerId) may update settings.
 *
 * @param req Body: { settings: { discordWebhookUrl?, discordDevWebhookUrl?, designSystemPath?, figmaApiKey?, chromaticApiKey?, clickupApiKey?, encryptedEnvVars? } }
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

  const isSuper = isSuperUser(session.user.email);
  if (project.ownerId !== session.user.id && !isSuper) {
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
    chromaticApiKey,
    clickupApiKey,
    encryptedEnvVars
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
    ...(clickupApiKey && clickupApiKey !== '********'
      ? { clickupApiKey: encrypt(clickupApiKey) }
      : clickupApiKey === '' ? { clickupApiKey: undefined } : {}),
    ...(encryptedEnvVars && encryptedEnvVars !== '********'
      ? { encryptedEnvVars: encrypt(encryptedEnvVars) }
      : encryptedEnvVars === '' ? { encryptedEnvVars: undefined } : {}),
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
    clickupApiKey: (updated.settings as any)?.clickupApiKey ? '********' : undefined,
    encryptedEnvVars: (updated.settings as any)?.encryptedEnvVars ? '********' : undefined,
  };

  return NextResponse.json({ 
    project: { 
      ...updated, 
      settings: sanitizedSettings 
    } 
  });
}
