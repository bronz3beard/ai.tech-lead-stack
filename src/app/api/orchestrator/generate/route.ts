import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getOrchestratorModels } from '@/lib/ai/orchestrator';
import { getProjectAccessFilter } from '@/lib/access';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { branchName, prompt, projectId } = body;

    if (!branchName || !prompt || !projectId) {
      return NextResponse.json(
        { error: 'branchName, prompt, and projectId are required' },
        { status: 400 }
      );
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...getProjectAccessFilter(session.user as any),
      },
      select: {
        githubFullName: true,
      }
    });

    if (!project || !project.githubFullName) {
      return NextResponse.json({ error: 'Project not found or no GitHub repository linked' }, { status: 404 });
    }

    // Get user model defaults
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { requirementsModel: true, auditModel: true }
    });

    const { creatorModel } = getOrchestratorModels(user);

    // Fetch GitHub OAuth token
    const account = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: 'github' },
      select: { access_token: true },
    });

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'GitHub account not linked' },
        { status: 403 }
      );
    }

    // Trigger GitHub Action (Generation Phase / Cloud Runner)
    const [owner, repo] = project.githubFullName.split('/');
    const githubResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/ai-prompt-agent.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            branch_name: branchName,
            prompt: prompt,
            creator_model: creatorModel,
          },
        }),
      }
    );

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      console.error('GitHub Generation Trigger Error:', githubResponse.status, errorText);
      return NextResponse.json(
        { error: `Failed to trigger Cloud Runner: ${githubResponse.statusText}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Cloud Runner (ai-prompt-agent.yml) triggered successfully.',
      creatorModel: creatorModel,
      branch: branchName
    });
  } catch (error) {
    console.error('Generation Trigger Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
