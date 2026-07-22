import * as fs from 'fs/promises';
import * as path from 'path';
import { CodeProvider } from './providers/base-provider';

/**
 * FileSystemService handles all directory traversal and skill file discovery logic.
 * Shared between the Next.js Chat API and the MCP Server.
 */
export class FileSystemService implements CodeProvider {
  private repoSkillsDir: string;
  private repoWorkflowsDir: string;
  private repoPmSkillsDir: string;
  private repoPmWorkflowsDir: string;
  private repoHrSkillsDir: string;
  private repoHrWorkflowsDir: string;
  /** Root of the caller's project (not the tech-lead-stack repo itself). Null when cwd IS the tech-lead-stack. */
  private clientProjectRoot: string | null;

  constructor(repoRoot: string, clientProjectRoot: string | null = null) {
    this.repoSkillsDir = path.join(repoRoot, '.ai', 'skills');
    this.repoWorkflowsDir = path.join(repoRoot, '.agents', 'workflows');
    this.repoPmSkillsDir = path.join(repoRoot, '.ai', 'pm-skills');
    this.repoPmWorkflowsDir = path.join(repoRoot, '.agents', 'pm-workflows');
    this.repoHrSkillsDir = path.join(repoRoot, '.ai', 'hr-skills');
    this.repoHrWorkflowsDir = path.join(repoRoot, '.agents', 'hr-workflows');
    this.clientProjectRoot = clientProjectRoot;
  }

  /** Updates the resolved client project root after async discovery at startup. */
  setClientProjectRoot(root: string | null): void {
    this.clientProjectRoot = root;
  }

  /**
   * Recursively finds the project root by looking for package.json.
   * Ignores the tech-lead-stack repository itself to ensure proper context discovery.
   */
  async findProjectRoot(startDir: string): Promise<string | null> {
    let current = startDir;
    while (current !== path.parse(current).root) {
      try {
        const pkgPath = path.join(
          /*turbopackIgnore: true*/ current,
          'package.json'
        );
        await fs.access(pkgPath);
        const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));

        // Ignore the tech-lead-stack itself unless we are explicitly testing it
        if (pkg.name && !pkg.name.includes('tech-lead-stack')) {
          return current;
        }
      } catch {
        // Continue searching up
      }
      current = path.dirname(current);
    }
    return null;
  }

  /**
   * Retrieves all available skills from both the local project and the global repository.
   */
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
    const dynamicSkills = new Map<
      string,
      {
        description: string;
        cost: string;
        internal: boolean;
        type: 'skill' | 'workflow';
      }
    >();

    // Build search dirs. When clientProjectRoot is set (caller's project), include
    // its local skills/workflows first. When null (we are the tech-lead-stack itself),
    // skip local lookups to avoid double-counting or wrong paths.
    const searchConfigs: { dir: string; type: 'skill' | 'workflow' }[] = [];

    if (this.clientProjectRoot) {
      searchConfigs.push(
        {
          dir: path.join(this.clientProjectRoot, '.ai', 'skills'),
          type: 'skill',
        },
        {
          dir: path.join(this.clientProjectRoot, '.agents', 'workflows'),
          type: 'workflow',
        },
        {
          dir: path.join(this.clientProjectRoot, '.ai', 'pm-skills'),
          type: 'skill',
        },
        {
          dir: path.join(this.clientProjectRoot, '.agents', 'pm-workflows'),
          type: 'workflow',
        },
        {
          dir: path.join(this.clientProjectRoot, '.ai', 'hr-skills'),
          type: 'skill',
        },
        {
          dir: path.join(this.clientProjectRoot, '.agents', 'hr-workflows'),
          type: 'workflow',
        }
      );
    }

    // Always include the tech-lead-stack repo skills/workflows as the authoritative source
    searchConfigs.push(
      { dir: this.repoSkillsDir, type: 'skill' },
      { dir: this.repoWorkflowsDir, type: 'workflow' },
      { dir: this.repoPmSkillsDir, type: 'skill' },
      { dir: this.repoPmWorkflowsDir, type: 'workflow' },
      { dir: this.repoHrSkillsDir, type: 'skill' },
      { dir: this.repoHrWorkflowsDir, type: 'workflow' }
    );

    for (const config of searchConfigs) {
      try {
        const files = await fs.readdir(config.dir);
        for (const file of files) {
          if (file.endsWith('.md')) {
            const name = path.basename(file, '.md');
            if (!dynamicSkills.has(name)) {
              try {
                const content = await fs.readFile(
                  path.join(/*turbopackIgnore: true*/ config.dir, file),
                  'utf-8'
                );
                const matchDescription = content.match(/description:\s*(.*)/);
                const matchCost = content.match(/cost:\s*(.*)/);
                const matchInternal = content.match(/internal:\s*(true|false)/);

                dynamicSkills.set(name, {
                  description: matchDescription
                    ? matchDescription[1].trim()
                    : `Reads the content of this ${config.type}.`,
                  cost: matchCost ? matchCost[1].trim() : 'unknown',
                  internal: matchInternal ? matchInternal[1] === 'true' : false,
                  type: config.type,
                });
              } catch {
                dynamicSkills.set(name, {
                  description: `${config.type}: ${name}`,
                  cost: 'unknown',
                  internal: false,
                  type: config.type,
                });
              }
            }
          }
        }
      } catch {
        /* skip missing directories */
      }
    }
    return dynamicSkills;
  }

  /**
   * Reads a specific skill or workflow file content.
   */
  async readSkill(
    safeName: string,
    type: 'skill' | 'workflow' = 'skill'
  ): Promise<{ content: string; path: string } | null> {
    const repoDir =
      type === 'skill' ? this.repoSkillsDir : this.repoWorkflowsDir;
    const repoPmDir = 
      type === 'skill' ? this.repoPmSkillsDir : this.repoPmWorkflowsDir;
    const repoHrDir =
      type === 'skill' ? this.repoHrSkillsDir : this.repoHrWorkflowsDir;

    // Only include local dir when we have a resolved client project root
    let localDir = null;
    let localPmDir = null;
    let localHrDir = null;
    if (this.clientProjectRoot) {
      localDir = path.join(
        this.clientProjectRoot,
        type === 'skill' ? path.join('.ai', 'skills') : path.join('.agents', 'workflows')
      );
      localPmDir = path.join(
        this.clientProjectRoot,
        type === 'skill' ? path.join('.ai', 'pm-skills') : path.join('.agents', 'pm-workflows')
      );
      localHrDir = path.join(
        this.clientProjectRoot,
        type === 'skill' ? path.join('.ai', 'hr-skills') : path.join('.agents', 'hr-workflows')
      );
    }

    const searchDirs = [repoDir, repoPmDir, repoHrDir, ...(localDir ? [localDir, localPmDir!, localHrDir!] : [])];

    for (const dir of searchDirs) {
      const fullPath = path.join(
        /*turbopackIgnore: true*/ dir,
        `${safeName}.md`
      );
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        return { content, path: fullPath };
      } catch {
        // Continue to fallback
      }
    }
    return null;
  }

  /**
   * Reads an arbitrary file from the project root.
   */
  async readFile(relativePath: string): Promise<string> {
    const fullPath = path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      relativePath
    );
    return await fs.readFile(fullPath, 'utf-8');
  }

  /**
   * Get all directory search paths for skill discovery.
   */
  getSearchDirs(): string[] {
    const dirs: string[] = [];
    if (this.clientProjectRoot) {
      dirs.push(
        path.join(this.clientProjectRoot, '.ai', 'skills'),
        path.join(this.clientProjectRoot, '.agents', 'workflows'),
        path.join(this.clientProjectRoot, '.ai', 'pm-skills'),
        path.join(this.clientProjectRoot, '.agents', 'pm-workflows'),
        path.join(this.clientProjectRoot, '.ai', 'hr-skills'),
        path.join(this.clientProjectRoot, '.agents', 'hr-workflows')
      );
    }
    dirs.push(this.repoSkillsDir, this.repoWorkflowsDir, this.repoPmSkillsDir, this.repoPmWorkflowsDir, this.repoHrSkillsDir, this.repoHrWorkflowsDir);
    return dirs;
  }
}
