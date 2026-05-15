import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { accessGrants: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const hasAccess = project.accessGrants.some((pa) => pa.userId === session.user.id);
    if (!hasAccess && project.ownerId !== session.user.id && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!project.githubFullName) {
      return NextResponse.json({ error: 'Project does not have a linked GitHub repository' }, { status: 400 });
    }

    // We fetch the account to get the token directly, since githubClient.accessToken is private
    const account = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: 'github' },
    });

    if (!account?.access_token) {
      return NextResponse.json({ error: 'GitHub account not linked' }, { status: 400 });
    }

    const [owner, repo] = project.githubFullName.split('/');
    const accessToken = account.access_token;

    const ghFetch = async (path: string) => {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        }
      });
      if (!res.ok) {
        throw new Error(`GitHub API error: ${res.statusText}`);
      }
      return res.json();
    };

    // Get repo to find default branch
    const repoData = await ghFetch('');
    const defaultBranch = repoData.default_branch;

    // Get tree recursively
    const treeData = await ghFetch(`/git/trees/${defaultBranch}?recursive=1`);
    const tree = treeData.tree;

    const excludedDirs = ['node_modules', '.next', '.git', 'dist', 'build'];
    const excludedExts = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.zip', '.tar', '.gz'];

    const fileSystemTree: any = {};
    let totalSize = 0;
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB

    const validItems = tree.filter((item: any) => {
      if (item.type !== 'blob') return false;
      const pathParts = item.path.split('/');
      if (pathParts.some((part: string) => excludedDirs.includes(part))) return false;
      const extMatch = item.path.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0].toLowerCase() : '';
      if (excludedExts.includes(ext)) return false;
      return true;
    });

    const files = [];

    // Parallel fetch blobs in small batches to not hit rate limits or memory issues
    const BATCH_SIZE = 20;
    for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
      if (totalSize > MAX_SIZE) break;
      const batch = validItems.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (item: any) => {
        if (item.size > 2 * 1024 * 1024) return null; // Skip files > 2MB
        try {
          const contentData = await ghFetch(`/git/blobs/${item.sha}`);
          const contentStr = Buffer.from(contentData.content, 'base64').toString('utf8');
          return { path: item.path, content: contentStr };
        } catch (error) {
          console.error(`Failed to fetch blob ${item.path}`, error);
          return null;
        }
      });

      const results = await Promise.all(batchPromises);
      for (const res of results) {
        if (res) {
          totalSize += Buffer.byteLength(res.content, 'utf8');
          if (totalSize <= MAX_SIZE) {
            files.push(res);
          }
        }
      }
    }

    for (const file of files) {
      if (!file) continue;
      const parts = file.path.split('/');
      let currentLevel = fileSystemTree;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!currentLevel[part]) {
          currentLevel[part] = { directory: {} };
        }
        currentLevel = currentLevel[part].directory;
      }

      const fileName = parts[parts.length - 1];
      currentLevel[fileName] = {
        file: {
          contents: file.content
        }
      };
    }

    return NextResponse.json({ bundle: fileSystemTree });

  } catch (error: any) {
    console.error('Project Bundle API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project bundle', details: error.message },
      { status: 500 }
    );
  }
}
