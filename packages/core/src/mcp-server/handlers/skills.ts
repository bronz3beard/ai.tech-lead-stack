import * as fs from 'fs/promises';
import matter from 'gray-matter';
import * as path from 'path';
import { KiService } from '../../lib/ki/ki-service.js';
import { FileSystemService } from '../../lib/skills/fs-service.js';
import { isSkillTrace } from '../../lib/trace-utils.js';
import { Telemetry } from '../telemetry.js';

export class SkillHandlers {
  constructor(
    private fsService: FileSystemService,
    private telemetry: Telemetry,
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
      .filter(
        (skill) => !isSkillTrace(undefined, skill) && !skill.startsWith('pm-')
      )
      .sort();

    const formattedSkills = await Promise.all(
      skillFiles.map(async (s) => {
        const skill = await this.fsService.readSkill(s);
        if (skill) {
          const parsed = matter(skill.content);
          const modes = Array.isArray(parsed.data?.modes)
            ? parsed.data.modes
            : [];
          if (modes.length > 0) {
            return `- ${s} [modes: ${modes.join(', ')}]`;
          }
        }
        return `- ${s}`;
      })
    );

    return {
      content: [
        {
          type: 'text',
          text: `Available skills (found in ${searchDirs.join(', ')}):\n${formattedSkills.join('\n')}`,
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

      if (args.story) {
        await this.kiService.upsertKnowledgeItem({
          slug: 'feature-spec',
          summary: 'Direct user story input',
          projectName: actualProjectName,
          artifacts: [{ name: 'spec.md', content: args.story as string }],
          approval: { status: 'human-approved', by: 'user', timestamp: new Date().toISOString() }
        });
      }
      
      if (args.slice) {
        await this.kiService.upsertKnowledgeItem({
          slug: 'atomic-batches',
          summary: 'Direct vertical slice input',
          projectName: actualProjectName,
          artifacts: [{ name: 'slice.md', content: args.slice as string }],
          approval: { status: 'human-approved', by: 'user', timestamp: new Date().toISOString() }
        });
      }

      let fileContent = rawContent;
      const graph = await this.fsService.loadGraph();
      if (graph && graph.nodes) {
        const node = graph.nodes.find((n: any) => n.id === safeSkillName);
        if (node) {
          const requires = graph.edges
            ? graph.edges
                .filter(
                  (e: any) => e.from === safeSkillName && e.type === 'requires'
                )
                .map((e: any) => e.to)
            : [];
          const suggests = graph.edges
            ? graph.edges
                .filter(
                  (e: any) => e.from === safeSkillName && e.type === 'suggests'
                )
                .map((e: any) => e.to)
            : [];
          const consumes = graph.artifactFlow
            ? graph.artifactFlow
                .filter((f: any) => f.consumedBy?.includes(node.phase))
                .map((f: any) => f.type)
            : [];
          const emits = graph.artifactFlow
            ? graph.artifactFlow
                .filter((f: any) => f.emittedBy?.includes(node.phase))
                .map((f: any) => f.type)
            : [];
          const targets = node.targets || [];

          const footer = `\n\n---\n[GRAPH] phase=${node.phase || 'none'} kind=${node.kind || 'none'} domain=${node.domain || 'none'}\nrequires=[${requires.join(',')}] suggests=[${suggests.join(',')}]\nconsumes=[${consumes.join(',')}] emits=[${emits.join(',')}] targets=[${targets.join(',')}]`;
          fileContent += footer;
        }
      }

      const parsed = matter(rawContent);
      if (Array.isArray(parsed.data?.policies)) {
        const policyText = await this.fsService.resolvePolicies(
          parsed.data.policies
        );
        if (policyText) {
          fileContent += `\n\n---\n## Injected policies\n${policyText}`;
        }
      }

      const shouldSkipAnalytics = isSkillTrace(undefined, safeSkillName);

      let skillCost = 'unknown';
      const metaMatch = rawContent.match(/cost:\s*(.*)/);
      if (metaMatch) skillCost = metaMatch[1].trim();

      const overrides: {
        actorType?: string | null;
        autonomy?: string | null;
        loopRunId?: string | null;
        loopPhase?: string | null;
        teamRole?: string | null;
      } = {};

      if (typeof args.actorType === 'string')
        overrides.actorType = args.actorType;
      if (typeof args.autonomy === 'string') overrides.autonomy = args.autonomy;
      if (typeof args.loopRunId === 'string')
        overrides.loopRunId = args.loopRunId;
      if (typeof args.loopPhase === 'string')
        overrides.loopPhase = args.loopPhase;
      if (typeof args.teamRole === 'string') overrides.teamRole = args.teamRole;

      if (safeSkillName === 'qa-handover-generator') {
        if (overrides.teamRole === undefined) {
          overrides.teamRole = 'qa';
        }
        if (overrides.actorType === undefined) {
          overrides.actorType = 'AGENT';
        }
      }

      const trackedContent = shouldSkipAnalytics
        ? fileContent
        : await this.telemetry.withAnalytics(
            safeSkillName,
            actualProjectName,
            model,
            agent,
            skillCost,
            async () => fileContent,
            overrides
          );

      return {
        content: [{ type: 'text', text: trackedContent }],
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
}
