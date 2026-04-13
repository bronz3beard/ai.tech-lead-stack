import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { encrypt } from '@/lib/crypto';

const SaveApiKeySchema = z.object({
  provider: z.enum(['claude', 'openai', 'gemini']),
  key: z.string().min(1),
});

const DeleteApiKeySchema = z.object({
  provider: z.enum(['claude', 'openai', 'gemini']),
});

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      claudeApiKey: true,
      openaiApiKey: true,
      geminiApiKey: true,
      preferredModel: true,
    },
  });

  if (!user) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    hasClaudeKey: !!user.claudeApiKey,
    hasOpenaiKey: !!user.openaiApiKey,
    hasGeminiKey: !!user.geminiApiKey,
    preferredModel: user.preferredModel ?? 'gemini',
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: unknown = await req.json();
    const parsed = SaveApiKeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid request body', errors: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { provider, key } = parsed.data;
    const encryptedKey = encrypt(key.trim());

    const updateData: Record<string, string> = {
      preferredModel: provider, // Automatically set as preferred when added
    };

    if (provider === 'claude') {
      updateData.claudeApiKey = encryptedKey;
    } else if (provider === 'openai') {
      updateData.openaiApiKey = encryptedKey;
    } else if (provider === 'gemini') {
      updateData.geminiApiKey = encryptedKey;
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, message: 'API key saved securely' });
  } catch (error) {
    console.error('Error saving API key:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: unknown = await req.json();
    const parsed = DeleteApiKeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid request body', errors: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { provider } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
       return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const updateData: Record<string, string | null> = {};

    if (provider === 'claude') {
      updateData.claudeApiKey = null;
    } else if (provider === 'openai') {
      updateData.openaiApiKey = null;
    } else if (provider === 'gemini') {
      updateData.geminiApiKey = null;
    }

    // Reset preferredModel to default if the deleted key was the preferred one
    if (user.preferredModel === provider) {
      updateData.preferredModel = 'gemini';
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, message: 'API key deleted' });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
