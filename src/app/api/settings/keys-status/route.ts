import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      claudeApiKey: true,
      geminiApiKey: true,
      openaiApiKey: true,
      julesApiKey: true,
    },
  });

  if (!user) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }

  const anthropic = Boolean(
    user.claudeApiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim()
  );

  const gemini = Boolean(
    user.geminiApiKey?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
  );

  const openai = Boolean(
    user.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim()
  );

  const jules = Boolean(
    user.julesApiKey?.trim() || process.env.JULES_API_KEY?.trim()
  );

  return NextResponse.json({
    anthropic,
    gemini,
    openai,
    jules,
  });
}
