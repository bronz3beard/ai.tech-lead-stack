import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { KiService } from '../../lib/ki/ki-service.js';
import { FileSystemService } from '../../lib/skills/fs-service.js';

export class KnowledgeHandlers {
  constructor(
    private kiService: KiService,
    private fsService: FileSystemService
  ) {}

  /*
   * Logic for the 'list_knowledge_items' tool.
   */
  async handleListKnowledgeItems(
    args: Record<string, unknown>
  ): Promise<CallToolResult> {
    try {
      const projectName =
        typeof args.projectName === 'string' ? args.projectName : undefined;
      const items = await this.kiService.listKnowledgeItems(projectName);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(items, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list Knowledge Items: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Logic for the 'approve_knowledge_item' tool.
   */
  async handleApproveKnowledgeItem(
    args: Record<string, unknown>
  ): Promise<CallToolResult> {
    try {
      const slug = args.slug as string;
      const status = args.status as 'draft' | 'human-approved' | 'rejected';
      const by = typeof args.by === 'string' ? args.by : undefined;

      await this.kiService.setApproval(slug, status, by);

      return {
        content: [
          {
            type: 'text',
            text: `Successfully updated approval status for '${slug}' to '${status}'.`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to approve Knowledge Item: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Logic for the 'read_knowledge_item' tool.
   */
  async handleReadKnowledgeItem(args: Record<string, unknown>) {
    const slug = args.slug as string;
    const item = await this.kiService.readKnowledgeItem(slug);

    if (!item) {
      return {
        content: [
          { type: 'text', text: `Error: Knowledge item "${slug}" not found.` },
        ],
        isError: true,
      };
    }

    let text = `# ${item.slug}\n\n`;
    text += `Summary: ${item.metadata.summary}\n`;
    text += `Project: ${item.metadata.projectName || 'global'}\n`;
    text += `Created: ${item.metadata.createdAt}\n`;
    text += `Updated: ${item.metadata.updatedAt}\n\n`;

    if (item.metadata.references?.length) {
      text += `## References\n${item.metadata.references.map((r) => `- ${r}`).join('\n')}\n\n`;
    }

    text += `## Artifacts\n\n`;
    for (const artifact of item.artifacts) {
      text += `### ${artifact.name}\n\n\`\`\`\n${artifact.content}\n\`\`\`\n\n`;
    }

    return {
      content: [{ type: 'text', text }],
      isError: false,
    };
  }

  /**
   * Logic for the 'create_knowledge_item' tool.
   */
  async handleCreateKnowledgeItem(args: Record<string, unknown>) {
    const slug = args.slug as string;
    const summary = args.summary as string;
    const artifacts = args.artifacts as { name: string; content: string }[];
    const references = args.references as string[] | undefined;
    const tags = args.tags as string[] | undefined;
    let projectName = args.projectName as string | undefined;

    // Automatic project name detection if not provided
    if (!projectName) {
      const projectRoot = await this.fsService.findProjectRoot(process.cwd());
      if (projectRoot) {
        try {
          const packagePath = path.join(projectRoot, 'package.json');
          const pkg = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
          projectName = pkg.name || path.basename(projectRoot);
        } catch {
          projectName = path.basename(projectRoot);
        }
      }
    }

    const item = await this.kiService.upsertKnowledgeItem({
      slug,
      summary,
      artifacts,
      references,
      tags,
      projectName,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Successfully created/updated knowledge item: ${item.slug} (Project: ${item.metadata.projectName || 'global'})`,
        },
      ],
      isError: false,
    };
  }
}
