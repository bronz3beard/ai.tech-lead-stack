import { authOptions } from '@/lib/auth';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import AdmZip from 'adm-zip';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';

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
      include: { accessGrants: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const hasAccess = project.accessGrants.some(
      (pa) => pa.userId === session.user.id
    );
    if (
      !hasAccess &&
      project.ownerId !== session.user.id &&
      session.user.role !== 'SUPERADMIN'
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!project.githubFullName) {
      return NextResponse.json(
        { error: 'Project does not have a linked GitHub repository' },
        { status: 400 }
      );
    }

    const account = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: 'github' },
    });

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'GitHub account not linked' },
        { status: 400 }
      );
    }

    const [owner, repo] = project.githubFullName.split('/');
    const accessToken = account.access_token;

    console.log(
      `[Bundle] Hydrating ${owner}/${repo} for user ${session.user.id}`
    );
    const octokit = new Octokit({ auth: accessToken });

    // 1. Get repo metadata to find default branch
    const { data: repoData } = await octokit.rest.repos.get({
      owner,
      repo,
    });
    const defaultBranch = repoData.default_branch;

    // 2. Fetch the repo as a ZIP archive (single call to avoid rate limits)
    console.log(
      `[Bundle] Fetching zipball for ${owner}/${repo} on branch ${defaultBranch}...`
    );
    const zipResponse = await octokit.rest.repos.downloadZipballArchive({
      owner,
      repo,
      ref: defaultBranch,
    });

    const buffer = Buffer.from(zipResponse.data as ArrayBuffer);
    const zip = new AdmZip(Buffer.from(buffer));
    const zipEntries = zip.getEntries();

    if (zipEntries.length === 0) {
      throw new Error('Repository is empty');
    }

    // GitHub zips contain a root directory like "owner-repo-sha/"
    const rootDir = zipEntries[0].entryName.split('/')[0];

    const fileSystemTree: any = {};
    const excludedDirs = [
      'node_modules',
      '.next',
      '.git',
      'dist',
      'build',
      '.vercel',
      'tmp',
    ];
    // We rebuild buildable libs inside the sandbox, so we don't need to ship
    // archives. Everything else (images, fonts, svgs) IS shipped (base64).
    const excludedExts = ['.zip', '.tar', '.gz'];
    const binaryExts = [
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.pdf',
      '.svg',
      '.ico',
      '.woff',
      '.woff2',
      '.ttf',
      '.eot',
      '.mp4',
      '.webm',
    ];

    let totalSize = 0;
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB total budget

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;

      // Remove the root directory prefix
      const relativePath = entry.entryName.substring(rootDir.length + 1);
      if (!relativePath) continue;

      const parts = relativePath.split('/');

      // Filtering directories
      if (parts.some((part) => excludedDirs.includes(part))) continue;

      // Filtering extensions
      const extMatch = relativePath.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0].toLowerCase() : '';
      if (excludedExts.includes(ext)) {
        console.log(`[Bundle] Dropping excluded file: ${relativePath}`);
        continue;
      }

      // Check size (skip files > 10MB to avoid memory issues)
      const data = entry.getData();
      if (data.length > 10 * 1024 * 1024) {
        console.warn(
          `[Bundle] Dropping large file: ${relativePath} (${(data.length / 1024 / 1024).toFixed(2)} MB)`
        );
        continue;
      }

      totalSize += data.length;
      if (totalSize > MAX_SIZE) {
        console.warn(`[Bundle] Reached max bundle size limit (100MB)`);
        break;
      }

      let currentLevel = fileSystemTree;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!currentLevel[part]) {
          currentLevel[part] = { directory: {} };
        }
        currentLevel = currentLevel[part].directory;
      }

      const fileName = parts[parts.length - 1];
      const isBinary = binaryExts.includes(ext);
      currentLevel[fileName] = {
        file: {
          contents: isBinary ? data.toString('base64') : data.toString('utf8'),
          encoding: isBinary ? 'base64' : 'utf8',
        },
      };
    }

    // Inject decrypted .env from project settings if available
    const projectSettings = project.settings as any;
    if (projectSettings?.encryptedEnvVars) {
      const { decrypt } = await import('@zenithfoundry/tech-lead-stack/crypto');
      try {
        const envContent = decrypt(projectSettings.encryptedEnvVars);
        fileSystemTree['.env'] = {
          file: {
            contents: envContent,
            encoding: 'utf8',
          },
        };
      } catch (err) {
        console.error('Failed to decrypt project env vars:', err);
      }
    }

    // Ensure Node version 22 is requested
    fileSystemTree['.node-version'] = {
      file: {
        contents: '22',
        encoding: 'utf8',
      },
    };

    console.log(
      `[Bundle] Successfully constructed bundle with ${Object.keys(fileSystemTree).length} root items`
    );
    return NextResponse.json({ bundle: fileSystemTree });
  } catch (error: any) {
    console.error('Project Bundle API Error:', error);
    let details = error.message;
    if (error.status === 403) {
      details =
        'GitHub API Forbidden: Likely a rate limit or missing repository permissions (ensure your token has "repo" scope).';
    } else if (error.status === 401) {
      details =
        'GitHub API Unauthorized: Your session or GitHub token may have expired.';
    }
    return NextResponse.json(
      { error: 'Failed to fetch project bundle', details },
      { status: 500 }
    );
  }
}
