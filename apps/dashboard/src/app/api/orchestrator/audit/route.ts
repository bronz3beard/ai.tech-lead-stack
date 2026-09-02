import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import { getOrchestratorModels, validateDistinctModels } from '@zenithfoundry/tech-lead-stack/ai/orchestrator';
import { providerOf } from '@zenithfoundry/tech-lead-stack/ai/model-registry';
import type { Tier } from '@zenithfoundry/tech-lead-stack/ai/tier-policy';
import { getProjectAccessFilter } from '@/lib/access';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let userConfig = null;
    if (session.user.id) {
      userConfig = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { requirementsModel: true, auditModel: true, settings: true }
      });
    }

    const body = await req.json();
    const { branchName, creatorModelUsed, projectId, tier: requestTier } = body;

    if (!branchName || !creatorModelUsed || !projectId) {
      return NextResponse.json(
        { error: 'branchName, creatorModelUsed, and projectId are required' },
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
      return NextResponse.json({ error: 'Project not found, access denied, or no GitHub repository linked' }, { status: 404 });
    }

    const { creatorModel, auditorModel } = getOrchestratorModels(userConfig);

    try {
      const tier = (requestTier || (userConfig?.settings as any)?.tier || 'byo') as Tier;
      // Enforce model distinction rule
      validateDistinctModels(creatorModelUsed, auditorModel, tier);
    } catch (validationError: any) {
      return NextResponse.json(
        { error: validationError.message },
        { status: 403 }
      );
    }

    // Fetch GitHub OAuth token for the user
    const account = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: 'github' },
      select: { access_token: true },
    });

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'GitHub account not linked. Please sign in with GitHub to trigger audits.' },
        { status: 403 }
      );
    }

    // Fetch triggering user's GitHub login to assign as reviewer
    let triggererLogin = '';
    try {
      const userGhResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          Accept: 'application/vnd.github+json',
        },
      });
      if (userGhResponse.ok) {
        const userData = await userGhResponse.json();
        triggererLogin = userData.login;
      }
    } catch (e) {
      console.warn('Failed to fetch GitHub user login:', e);
    }

    // Trigger GitHub Action (Audit Phase)
    const [owner, repo] = project.githubFullName.split('/');
    const githubResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/audit.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          ref: 'main', // Default branch to trigger from
          inputs: {
            branch_name: branchName,
            creator_model: creatorModel,
            creator_provider: providerOf(creatorModel),
            auditor_model: auditorModel,
            auditor_provider: providerOf(auditorModel),
            tier: (requestTier || (userConfig?.settings as any)?.tier || 'byo'),
            reviewer_login: triggererLogin || '', // Pass the login for PR assignment
          },
        }),
      }
    );

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      console.error('GitHub Trigger Error:', githubResponse.status, errorText);
      
      if (githubResponse.status === 404) {
        return NextResponse.json({
          message: 'Audit wiring successful, but audit.yml was not found in the target repository.',
          auditModelAssigned: auditorModel,
          branch: branchName,
          status: 'wiring_success_missing_workflow'
        });
      }

      return NextResponse.json(
        { error: `Failed to trigger GitHub Action: ${githubResponse.statusText}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      message: 'Audit Phase triggered successfully.',
      auditModelAssigned: auditorModel,
      branch: branchName,
      status: 'triggered'
    });
  } catch (error: any) {
    console.error('Audit Phase Trigger Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
