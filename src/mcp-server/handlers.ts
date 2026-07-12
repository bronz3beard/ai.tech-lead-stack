import { FileStateStore } from '../lib/ai/reflexion/state-store.js';
import { runReflexion, resumeReflexion } from '../lib/ai/reflexion/engine.js';
import { runnerFromEnv } from '../lib/ai/reflexion/providers-env.js';
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
      const result = await this.alignmentService.recordAlignment(agent, projectName);
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

  /**
   * Logic for the 'reflexion_loop' tool (✨ special feature).
   *
   * DEVELOPER PATH. Unlike the read-only web/chat surface, this runs inside an
   * IDE agent that CAN change code: the agent takes the returned plan/prompt and
   * implements it. Usage is logged to Prisma via telemetry, like every other
   * skill, so it shows up in the dashboard.
   */

  async handleReflexionResume(args: Record<string, any>) {
    try {
      const { runId, stateDir, answers } = args;
      if (!runId || !answers) {
        throw new Error('runId and answers are required');
      }

      const outDir = stateDir || '.reflexion-out';
      const stateStore = new FileStateStore(outDir);

      const state = await stateStore.load(runId);
      if (!state) {
        throw new Error('Run state not found in ' + outDir);
      }

      const runner = runnerFromEnv();
      const cfg = {
        brief: state.brief,
        maxRevisions: state.params.maxRevisions,
        passThreshold: state.params.passThreshold,
        mode: 'interview' as const,
        stateStore
      };


      let revisionCounter = state.revision;
      const result = await resumeReflexion(runner, state, answers, cfg, (e) => {
        let teamRole: string | undefined;
        if ('revision' in e) revisionCounter = e.revision;
        if (e.phase === 'critique' || e.phase === 'scored') teamRole = 'critic';
        if (e.phase === 'adjudicate') teamRole = 'adjudicator';
        if (e.phase === 'interview') teamRole = 'interviewer';

        // Call telemetryService directly because this.telemetry is ITelemetry (no recordEvent exposed)
        import('../lib/telemetry-service.js').then((m) => m.telemetryService.recordEvent({
          skillName: 'reflexion-loop',
          projectName: undefined,
          agent: undefined,
          duration: 0,
          status: 'SUCCESS',
          actorType: 'AGENT',
          autonomy: 'AUTONOMOUS',
          loopRunId: runId,
          loopPhase: e.phase,
          teamRole,
          metadata: { revision: revisionCounter, score: ('critique' in e) ? e.critique.score : undefined, passed: ('critique' in e) ? e.critique.passed : undefined }
        })).catch(() => {});
      });


      const finalPass = result.stopReason === 'passed' || result.stopReason === 'user-approve';

      return {
        content: [
          {
            type: 'text',
            text: `Run ID: ${result.runId}\n` +
              `Verdict: ${result.verdict}\n` +
              (result.interview?.questions.length ? '\nQuestions waiting:\n' + JSON.stringify(result.interview.questions, null, 2) + '\n' : '') +
              (finalPass ? '\nIDE Prompt:\n' + result.idePrompt : '')
          }
        ]
      };
    } catch (e: any) {
      return { isError: true, content: [{ type: 'text', text: e.message }] };
    }
  }

    async handleReflexionLoop(args: Record<string, any>) {
    const brief = args.brief?.trim();
    if (!brief) {
      return {
        content: [{ type: 'text', text: 'Error: "brief" is required.' }],
        isError: true,
      };
    }
    const maxRevisions = args.maxRevisions ?? 3;
    const passThreshold = args.passThreshold ?? 8;
    const stack = args.stack ?? '';
    const mode = args.mode || 'interview';
    const budget = args.budget;
    const projectName = args.projectName;
    const agent = args.agent;

    try {
      const runner = runnerFromEnv();

      const stateStore = new FileStateStore('.reflexion-out');


      let runId = 'unknown';
      let revisionCounter = 0;
      const result = await runReflexion(runner, {
        brief,
        stack,
        maxRevisions,
        passThreshold,
        mode,
        budget,
        stateStore
      }, (e) => {
        let teamRole: string | undefined;
        if ('revision' in e) revisionCounter = e.revision;
        if (e.phase === 'critique' || e.phase === 'scored') teamRole = 'critic';
        if (e.phase === 'adjudicate') teamRole = 'adjudicator';
        if (e.phase === 'interview') teamRole = 'interviewer';

        // Call telemetryService directly because this.telemetry is ITelemetry (no recordEvent exposed)
        import('../lib/telemetry-service.js').then((m) => m.telemetryService.recordEvent({
          skillName: 'reflexion-loop',
          projectName: undefined,
          agent: undefined,
          duration: 0,
          status: 'SUCCESS',
          actorType: 'AGENT',
          autonomy: 'AUTONOMOUS',
          loopRunId: runId,
          loopPhase: e.phase,
          teamRole,
          metadata: { revision: revisionCounter, score: ('critique' in e) ? e.critique.score : undefined, passed: ('critique' in e) ? e.critique.passed : undefined }
        })).catch(() => {});
      });
      runId = result.runId; // Unfortunately the events fired before this won't have it unless generated upfront.


      if (projectName || agent) {

      }

      return {
        content: [
          {
            type: 'text',
            text: `Reflexion Loop Finished.\n` +
                  `Final Score: ${result.finalScore}/10\n` +
                  `Verdict: ${result.verdict}\n` +
                  (result.interview?.questions.length ? '\nQuestions waiting:\n' + JSON.stringify(result.interview.questions, null, 2) + '\n' : '') +
                  ((result.stopReason === 'passed' || result.stopReason === 'user-approve') ? '\nIDE Prompt:\n' + result.idePrompt : '')
          }
        ]
      };
    } catch (e: any) {
      return { isError: true, content: [{ type: 'text', text: e.message }] };
    }
  }
}
