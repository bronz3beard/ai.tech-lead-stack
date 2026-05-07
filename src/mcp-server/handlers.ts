import * as fs from 'fs/promises';
import * as path from 'path';
import { KiService } from '../lib/ki/ki-service.js';
import { AlignmentService } from '../lib/skills/alignment-service.js';
import { FileSystemService } from '../lib/skills/fs-service.js';
import { isSkillTrace } from '../lib/trace-utils.js';
import { Telemetry } from './telemetry.js';

/**
 * Handlers manages the execution logic for all MCP tools.
 * Enforces SRP by separating request handling from server configuration.
 */
export class Handlers {
  constructor(
    private fsService: FileSystemService,
    private telemetry: Telemetry,
    private alignmentService: AlignmentService,
    private kiService: KiService
  ) {}

  /**
   * Logic for the 'list_skills' tool.
   */
  async handleListSkills() {
    const searchDirs = this.fsService.getSearchDirs();
    const allSkills = new Set<string>();

    await Promise.all(
      searchDirs.map(async (dir) => {
        try {
          const files = await fs.readdir(dir);
          files
            .filter((file) => file.endsWith('.md'))
            .forEach((file) => allSkills.add(path.basename(file, '.md')));
        } catch {
          /* skip directory if missing */
        }
      })
    );

    const skillFiles = Array.from(allSkills)
      .filter((skill) => !isSkillTrace(undefined, skill) && !skill.startsWith('pm-'))
      .sort();

    return {
      content: [
        {
          type: 'text',
          text: `Available skills (found in ${searchDirs.join(', ')}):\n${skillFiles.map((s) => `- ${s}`).join('\n')}`,
        },
      ],
      isError: false,
    };
  }

  /**
   * Logic for 'get_skills' and 'get_skill' tools (and dynamic tool aliases).
   */
  async handleGetSkill(name: string, args: Record<string, unknown>) {
    const skillName = args.skillName as string | undefined;
    const projectName = args.projectName as string | undefined;
    const model = args.model as string | undefined;
    const agent = args.agent as string | undefined;

    // Normalize tool name to skill filename
    const isDiscreteTool =
      name.startsWith('get_') && name !== 'get_skill' && name !== 'get_skills';

    // Reverse map: "get_planning_expert" -> "planning-expert"
    const toolToSkillName = (tool: string) =>
      tool.replace(/^get_/, '').replace(/_/g, '-');

    const effectiveSkillName = isDiscreteTool
      ? toolToSkillName(name)
      : path.basename(skillName || 'unknown', '.md');
    const safeSkillName = path.basename(effectiveSkillName, '.md');

    const skill = await this.fsService.readSkill(safeSkillName);

    if (skill) {
      const { content: rawContent } = skill;
      let actualProjectName = projectName;

      const isTrustedProjectName =
        !!actualProjectName &&
        actualProjectName.toLowerCase() !== 'unknown' &&
        actualProjectName !== '.' &&
        !actualProjectName.includes('tech-lead-stack');

      if (!isTrustedProjectName) {
        // Attempt to resolve the caller's project root. findProjectRoot skips the
        // tech-lead-stack itself, so null means we are the server - use a safe fallback.
        const projectRoot = await this.fsService.findProjectRoot(
          /*turbopackIgnore: true*/ process.cwd()
        );
        if (projectRoot) {
          try {
            const packagePath = path.join(projectRoot, 'package.json');
            const pkg = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
            actualProjectName =
              pkg.name && !pkg.name.includes('tech-lead-stack')
                ? pkg.name
                : path.basename(projectRoot);
          } catch {
            actualProjectName = path.basename(projectRoot);
          }
        } else {
          // cwd is the tech-lead-stack install itself - record as anonymous
          actualProjectName = 'unknown-project';
        }
      }

      const shouldSkipAnalytics = isSkillTrace(undefined, safeSkillName);

      let skillCost = 'unknown';
      const metaMatch = rawContent.match(/cost:\s*(.*)/);
      if (metaMatch) skillCost = metaMatch[1].trim();

      const fileContent = shouldSkipAnalytics
        ? rawContent
        : await this.telemetry.withAnalytics(
            safeSkillName,
            actualProjectName,
            model,
            agent,
            skillCost,
            async () => rawContent
          );

      return {
        content: [{ type: 'text', text: fileContent }],
        isError: false,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Error: Skill file "${safeSkillName}" not found. Use list_skills to see available skills.`,
        },
      ],
      isError: true,
    };
  }

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

  /*
   * Logic for the 'list_knowledge_items' tool.
   */
  async handleListKnowledgeItems(args: Record<string, unknown>) {
    const projectName = args.projectName as string | undefined;
    const items = await this.kiService.listKnowledgeItems(projectName);

    return {
      content: [
        {
          type: 'text',
          text:
            items.length > 0
              ? `Found ${items.length} knowledge items:\n${items.map((i) => `- ${i.slug}: ${i.summary} (${i.projectName || 'global'})`).join('\n')}`
              : 'No knowledge items found.',
        },
      ],
      isError: false,
    };
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
