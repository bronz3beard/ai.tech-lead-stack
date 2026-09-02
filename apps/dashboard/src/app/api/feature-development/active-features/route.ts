import { authOptions } from '@/lib/auth';
import { createGitHubClient } from '@/lib/github/client';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Get projects accessible to the user
    // In a real multi-tenant app, we'd use the access filter, 
    // but for now let's get all projects the user's account is linked to via GitHub
    const projects = await prisma.project.findMany({
      where: {
        githubFullName: { not: null }
      },
      select: {
        id: true,
        name: true,
        githubFullName: true,
      }
    });

    const activeFeatures = [];

    for (const project of projects) {
      try {
        const client = await createGitHubClient(session.user.id, project.id);
        const branches = await client.listDiscoveryBranches();

        for (const branch of branches) {
          const pr = await client.findPRForBranch(branch.name);
          
          // Try to get deployment status for Vercel Preview URL
          // This is a simplified version; in a real app you might want to fetch deployments
          // Or parse the Vercel bot comment from the PR.
          let previewUrl = null;
          if (pr) {
            // Check for deployment comments or statuses
            // For now we'll mock the preview URL generation logic or use a placeholder
            // In a production app, we would query GitHub Deployments API
            previewUrl = `https://${project.name.toLowerCase()}-git-${branch.name.replace(/\//g, '-')}.vercel.app`;
          }

          activeFeatures.push({
            id: branch.commit.sha,
            projectId: project.id,
            projectName: project.name,
            title: branch.name.replace('discovery/feature-requirements-', 'Feature: '),
            branch: branch.name,
            previewUrl: previewUrl,
            status: pr ? (pr.draft ? 'Dev Iterating' : 'In Review') : 'Discovery',
            lastUpdated: 'Recently', // Simplified for now
            prUrl: pr?.html_url || null,
          });
        }
      } catch (e) {
        console.error(`Failed to fetch features for project ${project.name}:`, e);
      }
    }

    return NextResponse.json({ features: activeFeatures });
  } catch (error) {
    console.error('Failed to list active features:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
