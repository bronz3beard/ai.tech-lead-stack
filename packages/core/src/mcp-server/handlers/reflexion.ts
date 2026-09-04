import { resumeReflexion, runReflexion } from '../../lib/ai/reflexion/engine.js';
import { runnerFromEnv } from '../../lib/ai/reflexion/providers-env.js';
import { FileStateStore } from '../../lib/ai/reflexion/state-store.js';
import { assessTask, enforceTier, type Tier } from '../../lib/ai/tier-policy.js';
import { decrypt } from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';
import { UserResolver } from '../user-resolver.js';

export class ReflexionHandlers {
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
        import('../../lib/telemetry-service.js')
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
              loopPhase: state.intentPhase || e.phase,
              teamRole,
              promptTokens: ('usage' in e && e.usage) ? e.usage.promptTokens : undefined,
              completionTokens: ('usage' in e && e.usage) ? e.usage.completionTokens : undefined,
              model: ('usage' in e && e.usage) ? e.usage.modelId : undefined,
              metadata: {
                revision: revisionCounter,
                score: 'critique' in e ? e.critique.score : undefined,
                passed: 'critique' in e ? e.critique.passed : undefined,
                criticFallback: runner.wasDegraded() ? true : undefined,
                totalSteps: revisionCounter,
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
          content: [
            { type: 'text', text: `Run ID ${runId} not found in ${outDir}.` },
          ],
          isError: true,
        };
      }

      let extra = '';
      if (state.phase === 'AWAITING_ANSWERS') {
        extra =
          '\nRun is parked for interview. Use reflexion_resume with answers to proceed.\nQuestions:\n' +
          JSON.stringify(state.interview?.questions, null, 2);
      } else if (
        state.phase === 'APPROVED' ||
        state.phase.startsWith('STOPPED')
      ) {
        extra = `\nRun is finished. Final verdict: ${state.stopReason}. \nTo get the final IDE Prompt, you can call reflexion_resume with { directive: "approve" } or read the state file directly.`;
      }

      const score =
        state.critiques.length > 0
          ? state.critiques[state.critiques.length - 1].score
          : 'N/A';

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
    const tier = args.tier as Tier | undefined;
    const budget =
      tier === 'local'
        ? {
            maxTotalTokens: args.budget?.maxTotalTokens,
            maxWallClockMs:
              Number(process.env.REFLEXION_MAX_WALLCLOCK_MS) || undefined,
          }
        : args.budget;

    if (tier && tier !== 'byo') {
      const sizeScore = args.sizeScore ?? 0;
      const riskSignals = args.riskSignals ?? [];
      const assessment = assessTask({ sizeScore, riskSignals });
      const enforcement = enforceTier(tier, assessment);

      if (!enforcement.allowed) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  refused: true,
                  reason: enforcement.reason,
                  escalateTo: enforcement.escalateTo,
                },
                null,
                2
              ),
            },
          ],
          isError: false,
        };
      }
    }

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
        params: {
          passThreshold,
          maxRevisions,
          maxStructuralRepairs: 1,
          focus: [],
        },
        usage: { totalTokens: 0, costUsd: 0, perPhase: [] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        criticDegraded: false,
        intentPhase: args.intentPhase as string | undefined,
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
          if (e.phase === 'critique' || e.phase === 'scored')
            teamRole = 'critic';
          if (e.phase === 'adjudicate') teamRole = 'adjudicator';
          if (e.phase === 'interview') teamRole = 'interviewer';

          // Call telemetryService directly because this.telemetry is ITelemetry (no recordEvent exposed)
          import('../../lib/telemetry-service.js')
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
                loopPhase: initialState.intentPhase || e.phase,
                teamRole,
                promptTokens: ('usage' in e && e.usage) ? e.usage.promptTokens : undefined,
                completionTokens: ('usage' in e && e.usage) ? e.usage.completionTokens : undefined,
                model: ('usage' in e && e.usage) ? e.usage.modelId : undefined,
                metadata: {
                  revision: revisionCounter,
                  score: 'critique' in e ? e.critique.score : undefined,
                  passed: 'critique' in e ? e.critique.passed : undefined,
                  criticFallback: runner.wasDegraded() ? true : undefined,
                  totalSteps: revisionCounter,
                },
              })
            )
            .catch(() => {});
        },
        initialState
      ).catch((e) => {
        console.error('[MCP] Async reflexion loop failed:', e);
        stateStore
          .load(runId)
          .then((s) => {
            if (s) {
              s.phase = 'STOPPED(error)';
              s.stopReason = 'error' as any;
              stateStore.save(s).catch(() => {});
            }
          })
          .catch(() => {});
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
