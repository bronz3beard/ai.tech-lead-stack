import { authOptions } from '@/lib/auth';
import { createGitHubClient } from '@/lib/github/client';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { branchName, files, projectId } = await req.json();

    if (!branchName || !files || !projectId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log(`Syncing ${Object.keys(files).length} files to branch: ${branchName} for project: ${projectId}`);

    const client = await createGitHubClient(session.user.id, projectId);

    const commit = await client.commitFiles(
      branchName,
      'Sync changes from Discovery Sandbox',
      files
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Files synced successfully',
      sha: commit.sha 
    });
  } catch (error: any) {
    console.error('Failed to sync files:', error);
    
    if (error.message.includes('SECURITY VIOLATION')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
