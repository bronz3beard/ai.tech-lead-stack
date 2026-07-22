import * as fs from 'fs/promises';
import * as path from 'path';
import { resumeReflexion, runReflexion } from '../lib/ai/reflexion/engine.js';
import { runnerFromEnv } from '../lib/ai/reflexion/providers-env.js';
import { FileStateStore } from '../lib/ai/reflexion/state-store.js';
import { KiService } from '../lib/ki/ki-service.js';
import { AlignmentService } from '../lib/skills/alignment-service.js';
import { FileSystemService } from '../lib/skills/fs-service.js';
import { isSkillTrace } from '../lib/trace-utils.js';
import { Telemetry } from './telemetry.js';
import { UserResolver } from './user-resolver.js';
import { decrypt } from '../lib/crypto.js';
import { prisma } from '../lib/prisma.js';

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
      .filter(
        (skill) => !isSkillTrace(undefined, skill) && !skill.startsWith('pm-')
      )
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

      const overrides: {
        actorType?: string | null;
        autonomy?: string | null;
        loopRunId?: string | null;
        loopPhase?: string | null;
        teamRole?: string | null;
      } = {};

      if (typeof args.actorType === 'string') overrides.actorType = args.actorType;
      if (typeof args.autonomy === 'string') overrides.autonomy = args.autonomy;
      if (typeof args.loopRunId === 'string') overrides.loopRunId = args.loopRunId;
      if (typeof args.loopPhase === 'string') overrides.loopPhase = args.loopPhase;
      if (typeof args.teamRole === 'string') overrides.teamRole = args.teamRole;

      if (safeSkillName === 'qa-handover-generator') {
        if (overrides.teamRole === undefined) {
          overrides.teamRole = 'qa';
        }
        if (overrides.actorType === undefined) {
          overrides.actorType = 'AGENT';
        }
      }

      const fileContent = shouldSkipAnalytics
        ? rawContent
        : await this.telemetry.withAnalytics(
            safeSkillName,
            actualProjectName,
            model,
            agent,
            skillCost,
            async () => rawContent,
            overrides
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

      const runner = runnerFromEnv({ decrypt });
      const cfg = {
        brief: state.brief,
        maxRevisions: state.params.maxRevisions,
        passThreshold: state.params.passThreshold,
        mode: 'interview' as const,
        stateStore,
      };

      let revisionCounter = state.revision;
      const result = await resumeReflexion(runner, state, answers, cfg, (e) => {
        let teamRole: string | undefined;
        if ('revision' in e) revisionCounter = e.revision;
        if (e.phase === 'critique' || e.phase === 'scored') teamRole = 'critic';
        if (e.phase === 'adjudicate') teamRole = 'adjudicator';
        if (e.phase === 'interview') teamRole = 'interviewer';

        // Call telemetryService directly because this.telemetry is ITelemetry (no recordEvent exposed)
        import('../lib/telemetry-service.js')
          .then((m) =>
            m.telemetryService.recordEvent({
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
              metadata: {
                revision: revisionCounter,
                score: 'critique' in e ? e.critique.score : undefined,
                passed: 'critique' in e ? e.critique.passed : undefined,
                criticFallback: runner.wasDegraded() ? true : undefined,
              },
            })
          )
          .catch(() => {});
      });

      const finalPass =
        result.stopReason === 'passed' || result.stopReason === 'user-approve';

      return {
        content: [
          {
            type: 'text',
            text:
              `Run ID: ${result.runId}\n` +
              `Verdict: ${result.verdict}\n` +
              (result.interview?.questions.length
                ? '\nQuestions waiting:\n' +
                  JSON.stringify(result.interview.questions, null, 2) +
                  '\n'
                : '') +
              (finalPass ? '\nIDE Prompt:\n' + result.idePrompt : ''),
          },
        ],
      };
    } catch (e: any) {
      return { isError: true, content: [{ type: 'text', text: e.message }] };
    }
  }

  async handleReflexionStatus(args: Record<string, any>) {
    try {
      const { runId, stateDir } = args;
      if (!runId) throw new Error('runId is required');

      const outDir = stateDir || '.reflexion-out';
      const stateStore = new FileStateStore(outDir);
      const state = await stateStore.load(runId);

      if (!state) {
        return {
          content: [{ type: 'text', text: `Run ID ${runId} not found in ${outDir}.` }],
          isError: true,
        };
      }

      let extra = '';
      if (state.phase === 'AWAITING_ANSWERS') {
        extra = '\nRun is parked for interview. Use reflexion_resume with answers to proceed.\nQuestions:\n' + 
                JSON.stringify(state.interview?.questions, null, 2);
      } else if (state.phase === 'APPROVED' || state.phase.startsWith('STOPPED')) {
        extra = `\nRun is finished. Final verdict: ${state.stopReason}. \nTo get the final IDE Prompt, you can call reflexion_resume with { directive: "approve" } or read the state file directly.`;
      }

      const score = state.critiques.length > 0 ? state.critiques[state.critiques.length - 1].score : 'N/A';

      return {
        content: [
          {
            type: 'text',
            text: `Run ID: ${state.runId}\nPhase: ${state.phase}\nRevision: ${state.revision}\nLast Score: ${score}${extra}`,
          },
        ],
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

    try {
      let user = null;
      let project = null;

      try {
        const userResolver = new UserResolver();
        const userEmail = userResolver.getUserEmail();
        if (userEmail && userEmail !== 'unknown') {
          user = await prisma.user.findFirst({
            where: { email: userEmail },
          });
        }
      } catch {
        // Fallback gracefully
      }

      if (args.projectName && typeof args.projectName === 'string') {
        try {
          project = await prisma.project.findFirst({
            where: {
              OR: [
                { name: args.projectName },
                { githubFullName: args.projectName },
              ],
            },
          });
        } catch {
          // Fallback gracefully
        }
      }

      const runner = runnerFromEnv({
        user: user ?? undefined,
        project: project ?? undefined,
        decrypt,
      });
      const stateStore = new FileStateStore('.reflexion-out');
      const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const initialState = {
        version: 2 as const,
        runId,
        brief,
        phase: 'INIT',
        plan: '',
        critiques: [],
        revision: 0,
        params: { passThreshold, maxRevisions, focus: [] },
        usage: { totalTokens: 0, costUsd: 0, perPhase: [] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        criticDegraded: false,
      };

      await stateStore.save(initialState);

      // Fire and forget
      runReflexion(
        runner,
        {
          brief,
          stack,
          maxRevisions,
          passThreshold,
          mode: mode as any,
          budget,
          stateStore,
        },
        (e) => {
          let teamRole: string | undefined;
          let revisionCounter = 0;
          if ('revision' in e) revisionCounter = e.revision;
          if (e.phase === 'critique' || e.phase === 'scored') teamRole = 'critic';
          if (e.phase === 'adjudicate') teamRole = 'adjudicator';
          if (e.phase === 'interview') teamRole = 'interviewer';

          // Call telemetryService directly because this.telemetry is ITelemetry (no recordEvent exposed)
          import('../lib/telemetry-service.js')
            .then((m) =>
              m.telemetryService.recordEvent({
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
                metadata: {
                  revision: revisionCounter,
                  score: 'critique' in e ? e.critique.score : undefined,
                  passed: 'critique' in e ? e.critique.passed : undefined,
                  criticFallback: runner.wasDegraded() ? true : undefined,
                },
              })
            )
            .catch(() => {});
        },
        initialState
      ).catch((e) => {
        console.error('[MCP] Async reflexion loop failed:', e);
        stateStore.load(runId).then(s => {
          if (s) {
            s.phase = 'STOPPED(error)';
            s.stopReason = 'error' as any;
            stateStore.save(s).catch(() => {});
          }
        }).catch(() => {});
      });

      return {
        content: [
          {
            type: 'text',
            text: `Reflexion Loop started asynchronously.\nRun ID: ${runId}\nStatus: running\n\nUse the reflexion_status tool with this Run ID to poll for completion.`,
          },
        ],
      };
    } catch (e: any) {
      return { isError: true, content: [{ type: 'text', text: e.message }] };
    }
  }
}
