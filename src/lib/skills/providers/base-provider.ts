import { FileSystemService } from "../fs-service";

export interface CodeProvider {
  /**
   * Reads a file from the project for analysis.
   */
  readFile(relativePath: string): Promise<string>;

  /**
   * Reads a specific skill or workflow file content.
   */
  readSkill(safeName: string, type?: 'skill' | 'workflow'): Promise<{ content: string; path: string } | null>;

  /**
   * Retrieves all available skills from both the local project and the global repository.
   */
  getDynamicSkills(): Promise<Map<string, { description: string; cost: string; internal: boolean; type: 'skill' | 'workflow' }>>;

  /**
   * Get all directory search paths for skill discovery.
   */
  getSearchDirs(): string[];
}
