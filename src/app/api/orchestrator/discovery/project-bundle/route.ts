import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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
    const excludedExts = [
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
      '.zip',
      '.tar',
      '.gz',
    ];

    let totalSize = 0;
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB

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
      if (excludedExts.includes(ext)) continue;

      // Check size (skip files > 2MB to avoid memory issues)
      const data = entry.getData();
      if (data.length > 2 * 1024 * 1024) continue;

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
      currentLevel[fileName] = {
        file: {
          contents: data.toString('utf8'),
        },
      };
    }

    // Backend Flattening & Monorepo Configuration
    const rootDirs = Object.keys(fileSystemTree).filter(
      (k) => fileSystemTree[k]?.directory
    );
    const monorepoIndicators = [
      'apps',
      'libs',
      'packages',
      'client',
      'server',
      'frontend',
      'backend',
      'api',
    ];
    const detectedWorkspaces = rootDirs.filter((dir) =>
      monorepoIndicators.includes(dir)
    );
    const isMonorepo =
      detectedWorkspaces.length > 0 ||
      fileSystemTree['project.json'] ||
      fileSystemTree['nx.json'] ||
      fileSystemTree['lerna.json'] ||
      fileSystemTree['pnpm-workspace.yaml'];

    if (isMonorepo && fileSystemTree['package.json']) {
      try {
        const pkgContent = fileSystemTree['package.json'].file.contents;
        const pkg = JSON.parse(pkgContent);

        // Inject workspaces if not already present or if we need to ensure our detected ones are covered
        if (!pkg.workspaces) {
          pkg.workspaces = detectedWorkspaces.map((dir) => {
            // If it's a known plural container like apps/libs/packages, use wildcard
            if (['apps', 'libs', 'packages'].includes(dir)) return `${dir}/*`;
            return dir;
          });

          // Ensure we don't have an empty workspace array
          if (pkg.workspaces.length === 0) {
            pkg.workspaces = ['apps/*', 'libs/*', 'packages/*'];
          }

          fileSystemTree['package.json'].file.contents = JSON.stringify(
            pkg,
            null,
            2
          );
          console.log(
            `[Bundle] Injected workspaces into root package.json:`,
            pkg.workspaces
          );
        }

        // If it's a monorepo, we should eagerly clean up some heavy known files/folders
        // that are often left in repos or generated, which we know we won't need in the sandbox.
        // The file loop already excludes 'node_modules', '.next', etc.
        // We can do further targeted cleanup if targetApp was passed, but for now we rely on the wildcard workspace.
      } catch (err) {
        console.error(
          '[Bundle] Failed to parse and flatten root package.json:',
          err
        );
      }
    }

    // Inject decrypted .env from project settings if available
    const projectSettings = project.settings as any;
    if (projectSettings?.encryptedEnvVars) {
      const { decrypt } = await import('@/lib/crypto');
      try {
        const envContent = decrypt(projectSettings.encryptedEnvVars);
        fileSystemTree['.env'] = {
          file: {
            contents: envContent,
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
      },
    };

    console.log(
      `[Bundle] Successfully constructed bundle with ${Object.keys(fileSystemTree).length} root items (isMonorepo: ${!!isMonorepo})`
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
