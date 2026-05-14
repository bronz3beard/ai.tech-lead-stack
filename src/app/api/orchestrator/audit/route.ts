import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getOrchestratorModels, validateDistinctModels } from '@/lib/ai/orchestrator';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    let userConfig = null;
    if (session?.user?.id) {
      userConfig = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { requirementsModel: true, auditModel: true }
      });
    }

    const body = await req.json();
    const { branchName, creatorModelUsed } = body;

    if (!branchName || !creatorModelUsed) {
      return NextResponse.json(
        { error: 'branchName and creatorModelUsed are required' },
        { status: 400 }
      );
    }

    const { auditorModel } = getOrchestratorModels(userConfig);

    try {
      // Enforce model distinction rule
      validateDistinctModels(creatorModelUsed, auditorModel);
    } catch (validationError: any) {
      return NextResponse.json(
        { error: validationError.message },
        { status: 403 }
      );
    }

    // TODO: In a full implementation, this would trigger the Auditor Agent to pull
    // the code from GitHub, audit it, and open a Draft PR.
    // For now, we stub this out as a successful trigger.

    return NextResponse.json({
      message: 'Audit Phase triggered successfully.',
      auditModelAssigned: auditorModel,
      branch: branchName,
      status: 'pending'
    });
  } catch (error: any) {
    console.error('Audit Phase Trigger Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
