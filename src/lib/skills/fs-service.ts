import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * FileSystemService handles all directory traversal and skill file discovery logic.
 * Shared between the Next.js Chat API and the MCP Server.
 */
export class FileSystemService {
  private repoSkillsDir: string;
  private repoWorkflowsDir: string;

  constructor(repoRoot: string) {
    this.repoSkillsDir = path.join(repoRoot, '.ai', 'skills');
    this.repoWorkflowsDir = path.join(repoRoot, '.agents', 'workflows');
  }

  /**
   * Recursively finds the project root by looking for package.json.
   * Ignores the tech-lead-stack repository itself to ensure proper context discovery.
   */
  async findProjectRoot(startDir: string): Promise<string | null> {
    let current = startDir;
    while (current !== path.parse(current).root) {
      try {
        const pkgPath = path.join(current, 'package.json');
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

    // Check local project skills/workflows
    const localSkillsDir = path.join(process.cwd(), '.ai', 'skills');
    const localWorkflowsDir = path.join(process.cwd(), '.agents', 'workflows');

    const searchConfigs = [
      { dir: localSkillsDir, type: 'skill' as const },
      { dir: this.repoSkillsDir, type: 'skill' as const },
      { dir: localWorkflowsDir, type: 'workflow' as const },
      { dir: this.repoWorkflowsDir, type: 'workflow' as const },
    ];

    for (const config of searchConfigs) {
      try {
        const files = await fs.readdir(config.dir);
        for (const file of files) {
          if (file.endsWith('.md')) {
            const name = path.basename(file, '.md');
            if (!dynamicSkills.has(name)) {
              try {
                const content = await fs.readFile(
                  path.join(config.dir, file),
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
    const localDir =
      type === 'skill'
        ? path.join(process.cwd(), '.ai', 'skills')
        : path.join(process.cwd(), '.agents', 'workflows');

    const repoDir =
      type === 'skill' ? this.repoSkillsDir : this.repoWorkflowsDir;

    const searchDirs = [localDir, repoDir];

    for (const dir of searchDirs) {
      const fullPath = path.join(dir, `${safeName}.md`);
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
    const fullPath = path.join(process.cwd(), relativePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  /**
   * Get all directory search paths for skill discovery.
   */
  getSearchDirs(): string[] {
    return [
      path.join(process.cwd(), '.ai', 'skills'),
      this.repoSkillsDir,
      path.join(process.cwd(), '.agents', 'workflows'),
      this.repoWorkflowsDir,
    ];
  }
}
