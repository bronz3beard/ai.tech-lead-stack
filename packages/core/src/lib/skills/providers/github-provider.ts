import { Octokit } from 'octokit';
import { CodeProvider } from './base-provider';

export class GitHubCodeProvider implements CodeProvider {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  
  // Basic in-memory cache to mitigate rate limits
  private fileCache = new Map<string, { content: string; timestamp: number }>();
  private skillMapCache: { 
    data: Map<string, { description: string; cost: string; internal: boolean; type: 'skill' | 'workflow' }>;
    timestamp: number;
  } | null = null;
  
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(token: string, githubFullName: string) {
    this.octokit = new Octokit({ auth: token });
    const [owner, repo] = githubFullName.split('/');
    this.owner = owner;
    this.repo = repo;
  }

  async readFile(relativePath: string): Promise<string> {
    const cached = this.fileCache.get(relativePath);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.content;
    }

    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: relativePath,
      });

      if (
        'content' in response.data &&
        typeof response.data.content === 'string'
      ) {
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        this.fileCache.set(relativePath, { content, timestamp: Date.now() });
        return content;
      }
      throw new Error(`Path ${relativePath} is not a file.`);
    } catch (error: any) {
      throw new Error(
        `GitHub read failed for ${relativePath}: ${error.message}`
      );
    }
  }

  async readSkill(
    safeName: string,
    type: 'skill' | 'workflow' = 'skill'
  ): Promise<{ content: string; path: string } | null> {
    const baseDir = type === 'skill' ? '.ai/skills' : '.agents/workflows';
    const fullPath = `${baseDir}/${safeName}.md`;

    try {
      const content = await this.readFile(fullPath);
      return {
        content,
        path: `github://${this.owner}/${this.repo}/${fullPath}`,
      };
    } catch {
      return null;
    }
  }

  async getDynamicSkills(): Promise<
    Map<
      string,
      {
        description: string;
        cost: string;
        internal: boolean;
        type: 'skill' | 'workflow';
      }
    >
  > {
    if (this.skillMapCache && Date.now() - this.skillMapCache.timestamp < this.CACHE_TTL) {
      return this.skillMapCache.data;
    }

    const dynamicSkills = new Map<
      string,
      {
        description: string;
        cost: string;
        internal: boolean;
        type: 'skill' | 'workflow';
      }
    >();

    const configs = [
      { dir: '.ai/skills', type: 'skill' as const },
      { dir: '.agents/workflows', type: 'workflow' as const },
    ];

    for (const config of configs) {
      try {
        const response = await this.octokit.rest.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: config.dir,
        });

        if (Array.isArray(response.data)) {
          for (const item of response.data) {
            if (item.name.endsWith('.md')) {
              const name = item.name.replace('.md', '');
              // For now, minimal metadata to avoid too many API calls
              // In production, we'd cache this or batch fetch
              dynamicSkills.set(name, {
                description: `GitHub ${config.type}: ${name}`,
                cost: 'unknown',
                internal: false,
                type: config.type,
              });
            }
          }
        }
      } catch {
        /* skip missing directories */
      }
    }

    this.skillMapCache = { data: dynamicSkills, timestamp: Date.now() };
    return dynamicSkills;
  }

  getSearchDirs(): string[] {
    return [
      `github://${this.owner}/${this.repo}/.ai/skills`,
      `github://${this.owner}/${this.repo}/.agents/workflows`,
    ];
  }
}
