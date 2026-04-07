import * as fs from "fs/promises";
import * as path from "path";

/**
 * FileSystemService handles all directory traversal and skill file discovery logic.
 * Enforces SRP by isolating file system concerns from server orchestration.
 */
export class FileSystemService {
  private repoSkillsDir: string;

  constructor(repoRoot: string) {
    this.repoSkillsDir = path.join(repoRoot, ".ai", "skills");
  }

  /**
   * Recursively finds the project root by looking for package.json.
   * Ignores the tech-lead-stack repository itself to ensure proper context discovery.
   */
  async findProjectRoot(startDir: string): Promise<string | null> {
    let current = startDir;
    while (current !== path.parse(current).root) {
      try {
        const pkgPath = path.join(current, "package.json");
        await fs.access(pkgPath);
        const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
        
        // Ignore the tech-lead-stack itself unless we are explicitly testing it
        if (pkg.name && !pkg.name.includes("tech-lead-stack")) {
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
  async getDynamicSkills(): Promise<Map<string, { description: string; cost: string }>> {
    const dynamicSkills = new Map<string, { description: string; cost: string }>();
    const localSkillsDir = path.join(process.cwd(), ".ai", "skills");
    const searchDirs = [localSkillsDir, this.repoSkillsDir];

    for (const dir of searchDirs) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (file.endsWith(".md")) {
            const name = path.basename(file, ".md");
            if (!dynamicSkills.has(name)) {
              try {
                const content = await fs.readFile(path.join(dir, file), "utf-8");
                const matchDescription = content.match(/description:\s*(.*)/);
                const matchCost = content.match(/cost:\s*(.*)/);
                dynamicSkills.set(name, {
                  description: matchDescription ? matchDescription[1].trim() : "Reads the content of this skill.",
                  cost: matchCost ? matchCost[1].trim() : "unknown",
                });
              } catch {
                dynamicSkills.set(name, { description: `Skill: ${name}`, cost: "unknown" });
              }
            }
          }
        }
      } catch { /* skip */ }
    }
    return dynamicSkills;
  }

  /**
   * Reads a specific skill file content from the search path priority.
   */
  async readSkill(safeSkillName: string): Promise<{ content: string; path: string } | null> {
    const localSkillsDir = path.join(process.cwd(), ".ai", "skills");
    const searchDirs = [localSkillsDir, this.repoSkillsDir];

    for (const dir of searchDirs) {
      const skillPath = path.join(dir, `${safeSkillName}.md`);
      try {
        const content = await fs.readFile(skillPath, "utf-8");
        return { content, path: skillPath };
      } catch {
        // Continue to fallback
      }
    }
    return null;
  }

  /**
   * Get all directory search paths for skill discovery.
   */
  getSearchDirs(): string[] {
    return [path.join(process.cwd(), ".ai", "skills"), this.repoSkillsDir];
  }
}
