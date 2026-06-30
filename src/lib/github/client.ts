import { prisma } from '@/lib/prisma';

export interface GitHubClientConfig {
  owner: string;
  repo: string;
  accessToken: string;
}

export class GitHubClient {
  public owner: string;
  public repo: string;
  private accessToken: string;
  private baseUrl = 'https://api.github.com';

  // Strict branch safety guards
  private static VALID_BRANCH_REGEX = /^(feat|discovery)\/.*$/;
  private static BLOCKED_BRANCHES = ['main', 'master', 'prod', 'production', 'staging'];

  constructor(config: GitHubClientConfig) {
    this.owner = config.owner;
    this.repo = config.repo;
    this.accessToken = config.accessToken;
  }

  /**
   * Enforces strict branch naming conventions and blocks critical branches.
   */
  private validateBranch(branch: string) {
    const normalized = branch.toLowerCase().trim();
    
    if (GitHubClient.BLOCKED_BRANCHES.includes(normalized)) {
      throw new Error(`SECURITY VIOLATION: Access to protected branch '${branch}' is strictly forbidden.`);
    }

    if (!GitHubClient.VALID_BRANCH_REGEX.test(branch)) {
      throw new Error(`SECURITY VIOLATION: Branch '${branch}' does not follow the required naming convention (feat/* or discovery/*).`);
    }
  }

  private async request(path: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API Error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Creates a blob for a file content.
   */
  async createBlob(content: string, encoding: 'utf-8' | 'base64' = 'utf-8') {
    return this.request('/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content, encoding }),
    });
  }

  /**
   * Creates a new tree based on an existing tree.
   */
  async createTree(baseTreeSha: string, tree: { path: string; mode: '100644' | '100755' | '040000' | '160000' | '120000'; type: 'blob' | 'tree' | 'commit'; sha: string }[]) {
    return this.request('/git/trees', {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree,
      }),
    });
  }

  /**
   * Creates a new commit.
   */
  async createCommit(message: string, treeSha: string, parentShas: string[]) {
    return this.request('/git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: treeSha,
        parents: parentShas,
      }),
    });
  }

  /**
   * Updates a reference (branch).
   */
  async updateRef(branch: string, commitSha: string) {
    this.validateBranch(branch);
    return this.request(`/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commitSha }),
    });
  }

  /**
   * Gets the latest commit SHA and tree SHA for a branch.
   */
  async getBranchState(branch: string) {
    this.validateBranch(branch);
    const ref = await this.request(`/git/refs/heads/${branch}`);
    const commit = await this.request(`/git/commits/${ref.object.sha}`);
    return {
      commitSha: ref.object.sha,
      treeSha: commit.tree.sha,
    };
  }

  /**
   * Posts a comment to a Pull Request.
   */
  async postPRComment(prNumber: number, body: string) {
    return this.request(`/issues/${prNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  /**
   * Finds the active PR for a given branch.
   */
  async findPRForBranch(branch: string) {
    this.validateBranch(branch);
    const prs = await this.request('/pulls', {
      method: 'GET',
    });
    // Search for a PR where the head branch matches
    return prs.find((pr: any) => pr.head.ref === branch);
  }

  /**
   * Lists branches matching the discovery pattern.
   */
  async listDiscoveryBranches() {
    const branches = await this.request('/branches', {
      method: 'GET',
    });
    return branches.filter((b: any) => b.name.startsWith('discovery/feature-requirements-'));
  }

  /**
   * High-level helper to commit multiple files to a branch.
   */
  async commitFiles(branch: string, message: string, files: Record<string, string | { content: string, encoding: 'utf-8' | 'base64' }>) {
    this.validateBranch(branch);
    
    // 1. Get current branch state
    const { commitSha, treeSha } = await this.getBranchState(branch);

    // 2. Create blobs
    const treeItems = await Promise.all(
      Object.entries(files).map(async ([path, fileData]) => {
        const content = typeof fileData === 'string' ? fileData : fileData.content;
        const encoding = typeof fileData === 'string' ? 'utf-8' : fileData.encoding;
        
        const blob = await this.createBlob(content, encoding);
        return {
          path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha,
        };
      })
    );

    // 3. Create new tree
    const newTree = await this.createTree(treeSha, treeItems);

    // 4. Create commit
    const newCommit = await this.createCommit(message, newTree.sha, [commitSha]);

    // 5. Update branch ref
    await this.updateRef(branch, newCommit.sha);

    return newCommit;
  }

  /**
   * Reads raw file content from the repository.
   */
  async getFileContent(path: string): Promise<string | null> {
    try {
      const res = await this.request(`/contents/${path}`);
      if (res && typeof res.content === 'string') {
        return Buffer.from(res.content, 'base64').toString('utf-8');
      }
      return null;
    } catch {
      return null; // missing file / no access -> skip silently
    }
  }
}

/**
 * Factory to create a GitHubClient for a user and project.
 */
export async function createGitHubClient(userId: string, projectId: string) {
  const [account, project] = await Promise.all([
    prisma.account.findFirst({
      where: { userId, provider: 'github' },
      select: { access_token: true },
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { githubFullName: true },
    }),
  ]);

  if (!account?.access_token) throw new Error('GitHub account not linked');
  if (!project?.githubFullName) throw new Error('Project repository not configured');

  const [owner, repo] = project.githubFullName.split('/');

  return new GitHubClient({
    owner,
    repo,
    accessToken: account.access_token,
  });
}
