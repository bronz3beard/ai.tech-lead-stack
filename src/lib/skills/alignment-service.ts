import * as fs from 'fs/promises';
import * as path from 'path';

export interface AlignmentState {
  agent: string;
  projectName: string;
  timestamp: string;
  aligned: boolean;
}

/**
 * AlignmentService manages the "Mission Alignment" state for agents.
 * It ensures that agents have performed a Phase 0 initialization via MCP
 * before they are allowed to use RTK CLI tools.
 */
export class AlignmentService {
  constructor(private projectRoot: string) {}

  /**
   * Records a successful mission alignment for an agent.
   * Creates a hidden file in the .ai directory as a compliance token.
   */
  async recordAlignment(agent: string, projectName: string): Promise<string> {
    const aiDir = path.join(this.projectRoot, '.ai');
    const alignmentFile = path.join(aiDir, '.mission-alignment.json');

    const state: AlignmentState = {
      agent,
      projectName,
      timestamp: new Date().toISOString(),
      aligned: true,
    };

    try {
      // Ensure .ai directory exists
      await fs.mkdir(aiDir, { recursive: true });
      await fs.writeFile(alignmentFile, JSON.stringify(state, null, 2), 'utf-8');
      
      return `✅ Mission Alignment Recorded for ${agent} in ${projectName}.\nCompliance token created at ${alignmentFile}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to record mission alignment: ${msg}`);
    }
  }

  /**
   * Verifies if a mission alignment token exists and is valid.
   */
  async getAlignmentState(): Promise<AlignmentState | null> {
    const alignmentFile = path.join(this.projectRoot, '.ai', '.mission-alignment.json');
    try {
      const data = await fs.readFile(alignmentFile, 'utf-8');
      return JSON.parse(data) as AlignmentState;
    } catch {
      return null;
    }
  }
}
