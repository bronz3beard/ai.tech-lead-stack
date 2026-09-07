import { AlignmentService } from '../../lib/skills/alignment-service.js';

export class AlignmentHandlers {
  constructor(private alignmentService: AlignmentService) {}

  /**
   * Logic for the 'verify_mission_alignment' tool.
   */
  async handleVerifyMissionAlignment(args: Record<string, unknown>) {
    const agent = args.agent as string | undefined;
    const projectName = args.projectName as string | undefined;

    if (!agent || !projectName) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Please provide both "agent" and "projectName" to align.',
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await this.alignmentService.recordAlignment(
        agent,
        projectName
      );
      return {
        content: [{ type: 'text', text: result }],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
