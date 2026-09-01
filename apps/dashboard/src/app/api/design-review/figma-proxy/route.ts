import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { FigmaService } from '@/lib/figma-api';

/**
 * @desc Proxy for Figma API requests. 
 *       Protects the Figma Personal Access Token (PAT) by keeping it on the server.
 * 
 * Query Params:
 * - projectId: string (Required)
 * - action: 'getFile' | 'getComments' (Required)
 * - fileKey: string (Required)
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const action = searchParams.get('action');
  const fileKey = searchParams.get('fileKey');

  if (!projectId || !action || !fileKey) {
    return NextResponse.json({ message: 'Missing required parameters' }, { status: 400 });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { settings: true, ownerId: true }
    });

    if (!project) {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 });
    }

    // For now, only owner can proxy. Future: check session user against project contributors.
    if (project.ownerId !== session.user.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const settings = project.settings as any;
    const encryptedPat = settings?.figmaApiKey;

    if (!encryptedPat) {
      return NextResponse.json({ message: 'Figma API key not configured for this project' }, { status: 400 });
    }

    const pat = decrypt(encryptedPat);
    const figma = new FigmaService(pat);

    let data;
    if (action === 'getFile') {
      data = await figma.getFile(fileKey);
    } else if (action === 'getComments') {
      data = await figma.getComments(fileKey);
    } else {
      return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[FIGMA_PROXY_ERROR]', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
