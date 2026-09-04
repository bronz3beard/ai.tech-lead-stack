import {
  ADJUDICATOR_SYSTEM,
  buildIdeHandoffPrompt,
  CRITIC_SYSTEM,
  focusPillarsBlock,
  GENERATOR_SYSTEM,
  generatorRevisionPrompt,
  INTERVIEWER_SYSTEM,
  RUBRIC,
  sectionRefinePrompt,
  stackContextBlock,
} from './prompts';
import {
  Answers,
  Critique,
  Interview,
  LoopParamsPatchSchema,
  ReflexionStateV2,
  StateStore,
  StopReason,
} from './schema';
import { validatePlanContract, PlanContractReport } from './plan-contract';
import { type Tier, deriveLoopParams } from '../tier-policy';
import { nextModelUp, shouldEscalate } from '../routing-policy';
import { pruneStackContext } from '../context-pruning';
import { providerOf } from '../model-registry';

/**
 * The Reflexion loop itself — pure orchestration, no I/O and no SDK imports.
 * Whoever calls it supplies a `ReflexionRunner` that knows how to talk to the
 * actual models (env keys for CLI/MCP, the logged-in user's encrypted keys for
 * the website). That keeps the loop testable and transport-agnostic.
 *
 * Token discipline: each role gets ONLY what it needs.
 *   - Generator(revision) sees: brief + stack + previous draft + the one fix.
 *   - Critic sees:               brief + stack + current draft.  (never history)
 *   - Adjudicator sees once:     brief + final draft + final critique + scores.
 */
export interface ReflexionRunner {
  generate(prompt: string, system: string): Promise<string>;
  critique(prompt: string, system: string): Promise<Critique>;
  adjudicate(prompt: string, system: string): Promise<string>;
  interview(prompt: string, system: string): Promise<Interview>;
  getUsage(): {
    tokens: number;
    promptTokens?: number;
    completionTokens?: number;
    costUsd: number;
    cachedReadTokens?: number;
    cacheWriteTokens?: number;
    estimatedCacheSavingsUsd?: number;
  };
  /** The resolved model ids, for display/telemetry. */
  models: { creator: string; critic: string; adjudicator: string };
  wasDegraded(): boolean;
  escalatePlanner?(newModelId: string): void;
}

export interface ReflexionConfig {
  brief: string;
  /** Phase-0 stack context (concatenated config files). May be empty. */
  stack?: string;
  maxRevisions?: number;
  maxStructuralRepairs?: number;
  passThreshold?: number;
  mode?: 'auto' | 'interview';
  budget?: { maxCostUsd?: number; maxTotalTokens?: number; maxWallClockMs?: number };
  focusPillars?: string[];
  stateStore?: StateStore;
  tier?: Tier;
  autoEscalate?: boolean;
  maxStackChars?: number;
}

export interface ReflexionRound {
  revision: number;
  draft: string;
  critique: Critique;
}

export interface ReflexionResult {
  runId: string;
  brief: string;
  rounds: ReflexionRound[];
  scores: number[];
  finalScore: number;
  finalPassed: boolean;
  revisionsUsed: number;
  verdict: string;
  /**
   * The advisory deliverable for READ-ONLY surfaces (web + chat): a portable
   * prompt to paste into an IDE agent to implement the reviewed plan. The loop
   * itself never modifies code; this is the bridge to a context that can.
   */
  idePrompt: string;
  models: ReflexionRunner['models'];
  stopReason?: StopReason;
  interview?: Interview;
  criticDegraded: boolean;
  usage?: { 
    totalTokens: number;
    promptTokens?: number;
    completionTokens?: number;
    costUsd: number;
    cachedReadTokens?: number;
    cacheWriteTokens?: number;
    estimatedCacheSavingsUsd?: number;
  };
}

export type StepEvent =
  | { phase: 'generate'; revision: number }
  | { phase: 'generated'; revision: number; usage: { promptTokens: number; completionTokens: number; modelId: string } }
  | { phase: 'structural-gate'; revision: number; report: PlanContractReport }
  | { phase: 'critique'; revision: number }
  | { phase: 'scored'; revision: number; critique: Critique; usage?: { promptTokens: number; completionTokens: number; modelId: string } }
  | { phase: 'adjudicate' }
  | { phase: 'adjudicated'; verdict: string; usage: { promptTokens: number; completionTokens: number; modelId: string } }
  | { phase: 'interview'; interview: Interview; usage?: { promptTokens: number; completionTokens: number; modelId: string } }
  | { phase: 'resume'; recommendation: string }
  | { phase: 'escalate'; from: string; to: string };

function checkBudget(runner: ReflexionRunner, cfg: ReflexionConfig): boolean {
  if (!cfg.budget) return true;
  const usage = runner.getUsage();
  if (cfg.budget.maxTotalTokens && usage.tokens > cfg.budget.maxTotalTokens)
    return false;
  if (cfg.budget.maxCostUsd && usage.costUsd > cfg.budget.maxCostUsd)
    return false;
  return true;
}

function budgetStop(runner: ReflexionRunner, cfg: ReflexionConfig, startTime: number): StopReason | null {
  if (cfg.budget?.maxWallClockMs && Date.now() - startTime > cfg.budget.maxWallClockMs)
    return 'wallclock-exceeded';
  if (!checkBudget(runner, cfg)) return 'budget-exceeded';
  return null;
}

export async function runReflexion(
  runner: ReflexionRunner,
  cfg: ReflexionConfig,
  onStep?: (e: StepEvent) => void,
  existingState?: ReflexionStateV2
): Promise<ReflexionResult> {
  const startTime = Date.now();
  const runId =
    existingState?.runId ||
    `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const mode = cfg.mode ?? 'interview';
  let maxRevisions = cfg.maxRevisions ?? 3;
  if (cfg.tier && cfg.tier !== 'byo') {
    const limits = deriveLoopParams(cfg.tier);
    maxRevisions = Math.min(maxRevisions, limits.maxRevisions);
    if (limits.autoEscalate !== undefined) {
      cfg.autoEscalate = limits.autoEscalate;
    }
  }
  const maxStructuralRepairs = cfg.maxStructuralRepairs ?? 1;
  const passThreshold = cfg.passThreshold ?? 8;
  const isGooglePlanner = !!runner.models?.creator && (
    (() => { try { return providerOf(runner.models.creator) === 'google'; } catch { return false; } })()
  );
  const preserveForCache = isGooglePlanner && maxRevisions > 0;
  const prunedStack = cfg.maxStackChars ? pruneStackContext(cfg.stack ?? '', cfg.maxStackChars, preserveForCache) : (cfg.stack ?? '');
  const stackBlock = stackContextBlock(prunedStack);
  const focusBlock = focusPillarsBlock(cfg.focusPillars ?? []);

  let structuralRepairsUsed = 0;

  const rounds: ReflexionRound[] = existingState
    ? existingState.critiques.map((c, i) => ({
        revision: i,
        draft: existingState.plan,
        critique: c,
      }))
    : [];
  const scores: number[] = existingState?.critiques.map((c) => c.score) || [];

  let draft = existingState?.plan || '';
  let fix =
    existingState?.critiques?.[existingState.critiques.length - 1]
      ?.actionableFix || '';
  let score =
    existingState?.critiques?.[existingState.critiques.length - 1]?.score || 0;
  let last: Critique | null =
    existingState?.critiques?.[existingState.critiques.length - 1] || null;
  let stopReason: StopReason | undefined = existingState?.stopReason;
  let phase = existingState?.phase || 'INIT';
  let interviewResult: Interview | undefined = existingState?.interview;

  const saveState = async (newPhase: string) => {
    phase = newPhase;
    if (cfg.stateStore) {
      const usage = runner.getUsage();
      await cfg.stateStore.save({
        version: 2,
        runId,
        brief: cfg.brief,
        phase,
        plan: draft,
        critiques: rounds.map((r) => r.critique),
        revision: rounds.length - 1,
        params: { passThreshold, maxRevisions, maxStructuralRepairs, focus: cfg.focusPillars },
        usage: {
          totalTokens: usage.tokens,
          costUsd: usage.costUsd,
          cachedReadTokens: usage.cachedReadTokens,
          cacheWriteTokens: usage.cacheWriteTokens,
          estimatedCacheSavingsUsd: usage.estimatedCacheSavingsUsd,
          perPhase: [],
        },
        interview: interviewResult,
        stopReason,
        createdAt: existingState?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        criticDegraded: runner.wasDegraded() || !!existingState?.criticDegraded,
      });
    }
  };

  const startRevision = existingState ? existingState.critiques.length : 0;

  if (
    phase === 'INIT' ||
    phase.startsWith('GENERATING') ||
    phase.startsWith('CRITIQUING')
  ) {
    for (let revision = startRevision; revision <= maxRevisions; revision++) {
      const bStop1 = budgetStop(runner, cfg, startTime);
      if (bStop1) {
        stopReason = bStop1;
        await saveState(`STOPPED(${stopReason})`);
        break;
      }

      onStep?.({ phase: 'generate', revision });
      await saveState('GENERATING');
      const prompt =
        revision === 0
          ? `${stackBlock}\nBRIEF:\n${cfg.brief}${focusBlock}`
          : `${stackBlock}\nBRIEF:\n${cfg.brief}\n\n${generatorRevisionPrompt(draft, score, fix)}${focusBlock}`;
      
      const usageBeforeGen = runner.getUsage();
      draft = await runner.generate(prompt, GENERATOR_SYSTEM + focusBlock);
      const usageAfterGen = runner.getUsage();
      onStep?.({
        phase: 'generated',
        revision,
        usage: {
          promptTokens: (usageAfterGen.promptTokens ?? 0) - (usageBeforeGen.promptTokens ?? 0),
          completionTokens: (usageAfterGen.completionTokens ?? 0) - (usageBeforeGen.completionTokens ?? 0),
          modelId: runner.models.creator
        }
      });

      const bStop2 = budgetStop(runner, cfg, startTime);
      if (bStop2) {
        stopReason = bStop2;
        await saveState(`STOPPED(${stopReason})`);
        break;
      }

      const report = validatePlanContract(draft);
      onStep?.({ phase: 'structural-gate', revision, report });

      if (!report.passesStructuralGate && structuralRepairsUsed < maxStructuralRepairs) {
        structuralRepairsUsed++;
        const fatal = report.violations.find((v) => v.severity === 'fatal');
        const synthCrit: Critique = {
          gstackDiagnosis: 0,
          atomicBatches: 0,
          productionEthos: 0,
          modernWeb: 0,
          score: 0,
          passed: false,
          actionableFix: `STRUCTURAL ERROR in ${fatal?.locus}: ${fatal?.message}`,
        };
        last = synthCrit;
        score = 0;
        fix = synthCrit.actionableFix;
        rounds.push({ revision, draft, critique: synthCrit });
        scores.push(0);
        continue;
      }

      onStep?.({ phase: 'critique', revision });
      await saveState('CRITIQUING');
      let critiquePrompt =
        `${stackBlock}\nORIGINAL BRIEF:\n${cfg.brief}\n\n` +
        `PLAN TO GRADE:\n---\n${draft}\n---${focusBlock}`;

      if (!report.passesStructuralGate) {
        critiquePrompt += `\n\nSTRUCTURAL REPORT: The following fatal structural violations were found. Ensure your critique penalises the relevant pillar severely.\n${JSON.stringify(report.violations.filter(v => v.severity === 'fatal'), null, 2)}`;
      }

      const usageBeforeCrit = runner.getUsage();
      const crit = await runner.critique(
        critiquePrompt,
        CRITIC_SYSTEM + focusBlock
      );
      const usageAfterCrit = runner.getUsage();

      last = crit;
      score = crit.score;
      fix = crit.actionableFix;
      rounds.push({ revision, draft, critique: crit });
      scores.push(score);
      onStep?.({
        phase: 'scored',
        revision,
        critique: crit,
        usage: {
          promptTokens: (usageAfterCrit.promptTokens ?? 0) - (usageBeforeCrit.promptTokens ?? 0),
          completionTokens: (usageAfterCrit.completionTokens ?? 0) - (usageBeforeCrit.completionTokens ?? 0),
          modelId: runner.models.critic
        }
      });

      await saveState('ADJUDICATING');

      // Router: pass OR cap -> stop. Otherwise loop carrying the single fix.
      if (crit.passed || score >= passThreshold) break;
      if (revision >= maxRevisions) break;

      if (cfg.autoEscalate && shouldEscalate(scores, passThreshold)) {
        const currentId = runner.models.creator;
        const nextId = nextModelUp(currentId);
        if (nextId && runner.escalatePlanner) {
          onStep?.({ phase: 'escalate', from: currentId, to: nextId });
          runner.escalatePlanner(nextId);
        }
      }
    }
  }

  if (!stopReason) {
    const bStop3 = budgetStop(runner, cfg, startTime);
    if (bStop3) {
      stopReason = bStop3;
      await saveState(`STOPPED(${stopReason})`);
    } else {
      onStep?.({ phase: 'adjudicate' });
      const adjudicatorPrompt =
        `ORIGINAL BRIEF:\n${cfg.brief}\n\n` +
        `SCORE PER REVISION: ${JSON.stringify(scores)}\n` +
        `PASS THRESHOLD: ${passThreshold}/10 | REVISIONS USED: ${rounds.length - 1}/${maxRevisions} | PASSED: ${last?.passed}\n\n` +
        `FINAL CRITIQUE: ${JSON.stringify(last)}\n\n` +
        `FINAL PLAN:\n---\n${draft}\n---`;
      
      const usageBeforeAdj = runner.getUsage();
      const verdict = await runner.adjudicate(
        adjudicatorPrompt,
        ADJUDICATOR_SYSTEM
      );
      const usageAfterAdj = runner.getUsage();
      onStep?.({
        phase: 'adjudicated',
        verdict,
        usage: {
          promptTokens: (usageAfterAdj.promptTokens ?? 0) - (usageBeforeAdj.promptTokens ?? 0),
          completionTokens: (usageAfterAdj.completionTokens ?? 0) - (usageBeforeAdj.completionTokens ?? 0),
          modelId: runner.models.adjudicator
        }
      });

      if (mode === 'interview') {
        await saveState('INTERVIEWING');
        const interviewPrompt =
          `BRIEF:\n${cfg.brief}\n\n` +
          `PLAN:\n${draft}\n\n` +
          `CRITIQUE:\n${JSON.stringify(last)}\n\n` +
          `LOOP PARAMS:\n${JSON.stringify({ passThreshold, maxRevisions })}`;

        const usageBeforeInt = runner.getUsage();
        interviewResult = await runner.interview(
          interviewPrompt,
          INTERVIEWER_SYSTEM
        );
        const usageAfterInt = runner.getUsage();

        // Zero-question rule
        if (
          last &&
          last.gstackDiagnosis >= 9 &&
          last.atomicBatches >= 9 &&
          last.productionEthos >= 9 &&
          last.modernWeb >= 9
        ) {
          interviewResult.recommendation = 'approve';
          interviewResult.questions = [];
        }

        onStep?.({ 
          phase: 'interview', 
          interview: interviewResult,
          usage: {
            promptTokens: (usageAfterInt.promptTokens ?? 0) - (usageBeforeInt.promptTokens ?? 0),
            completionTokens: (usageAfterInt.completionTokens ?? 0) - (usageBeforeInt.completionTokens ?? 0),
            modelId: runner.models.critic
          }
        });

        if (interviewResult.questions.length > 0) {
          await saveState('AWAITING_ANSWERS');
          const usage = runner.getUsage();
          return {
            runId,
            brief: cfg.brief,
            rounds,
            scores,
            finalScore: score,
            finalPassed: Boolean(last?.passed),
            revisionsUsed: rounds.length - 1,
            verdict,
            idePrompt: '', // Empty while parked
            models: runner.models,
            interview: interviewResult,
            usage: {
              totalTokens: usage.tokens,
              costUsd: usage.costUsd,
              cachedReadTokens: usage.cachedReadTokens,
              cacheWriteTokens: usage.cacheWriteTokens,
              estimatedCacheSavingsUsd: usage.estimatedCacheSavingsUsd,
            },
            criticDegraded:
              runner.wasDegraded() || !!existingState?.criticDegraded,
          };
        } else {
          stopReason = 'passed';
          await saveState('APPROVED');
        }
      } else {
        stopReason =
          last?.passed || score >= passThreshold ? 'passed' : 'max-revisions';
        await saveState(
          stopReason === 'passed' ? 'APPROVED' : `STOPPED(${stopReason})`
        );
      }

      const usage = runner.getUsage();
      return {
        runId,
        brief: cfg.brief,
        rounds,
        scores,
        finalScore: score,
        finalPassed: Boolean(last?.passed),
        revisionsUsed: rounds.length - 1,
        verdict,
        idePrompt: buildIdeHandoffPrompt(cfg.brief, draft, score),
        models: runner.models,
        stopReason,
        interview: interviewResult,
        usage: {
          totalTokens: usage.tokens,
          costUsd: usage.costUsd,
          cachedReadTokens: usage.cachedReadTokens,
          cacheWriteTokens: usage.cacheWriteTokens,
          estimatedCacheSavingsUsd: usage.estimatedCacheSavingsUsd,
        },
        criticDegraded: runner.wasDegraded() || !!existingState?.criticDegraded,
      };
    }
  }

  const usage = runner.getUsage();
  return {
    runId,
    brief: cfg.brief,
    rounds,
    scores,
    finalScore: score,
    finalPassed: Boolean(last?.passed),
    revisionsUsed: Math.max(0, rounds.length - 1),
    verdict: stopReason || 'unknown',
    idePrompt:
      stopReason === 'passed' || stopReason === 'user-approve'
        ? buildIdeHandoffPrompt(cfg.brief, draft, score)
        : '',
    models: runner.models,
    stopReason,
    usage: {
      totalTokens: usage.tokens,
      costUsd: usage.costUsd,
      cachedReadTokens: usage.cachedReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      estimatedCacheSavingsUsd: usage.estimatedCacheSavingsUsd,
    },
    criticDegraded: runner.wasDegraded() || !!existingState?.criticDegraded,
  };
}

export async function resumeReflexion(
  runner: ReflexionRunner,
  state: ReflexionStateV2,
  answers: Answers,
  cfg: ReflexionConfig,
  onStep?: (e: StepEvent) => void
): Promise<ReflexionResult> {
  const startTime = Date.now();
  onStep?.({ phase: 'resume', recommendation: answers.directive || 'refine' });

  if (answers.directive === 'approve') {
    state.stopReason = 'user-approve';
    state.phase = 'APPROVED';
    if (cfg.stateStore) await cfg.stateStore.save(state);

    const last = state.critiques[state.critiques.length - 1];
    const usage = runner.getUsage();
    return {
      runId: state.runId,
      brief: state.brief,
      rounds: state.critiques.map((c, i) => ({
        revision: i,
        draft: state.plan,
        critique: c,
      })),
      scores: state.critiques.map((c) => c.score),
      finalScore: last?.score || 0,
      finalPassed: last?.passed || false,
      revisionsUsed: state.revision,
      verdict: 'Approved by user',
      idePrompt: buildIdeHandoffPrompt(
        state.brief,
        state.plan,
        last?.score || 0
      ),
      models: runner.models,
      stopReason: 'user-approve',
      usage: {
        totalTokens: usage.tokens,
        costUsd: usage.costUsd,
        cachedReadTokens: usage.cachedReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        estimatedCacheSavingsUsd: usage.estimatedCacheSavingsUsd,
      },
      criticDegraded: runner.wasDegraded() || !!state.criticDegraded,
    };
  }

  if (answers.directive === 'stop') {
    state.stopReason = 'user-stop';
    state.phase = 'STOPPED(user-stop)';
    if (cfg.stateStore) await cfg.stateStore.save(state);
    const usage = runner.getUsage();
    return {
      runId: state.runId,
      brief: state.brief,
      rounds: [],
      scores: [],
      finalScore: 0,
      finalPassed: false,
      revisionsUsed: state.revision,
      verdict: 'Stopped by user',
      idePrompt: '',
      models: runner.models,
      stopReason: 'user-stop',
      usage: {
        totalTokens: usage.tokens,
        costUsd: usage.costUsd,
        cachedReadTokens: usage.cachedReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        estimatedCacheSavingsUsd: usage.estimatedCacheSavingsUsd,
      },
      criticDegraded: runner.wasDegraded() || !!state.criticDegraded,
    };
  }

  const loopAnswers = answers.decisions.filter((d) => {
    const q = state.interview?.questions.find((q) => q.id === d.id);
    return q?.target === 'loop';
  });

  const planAnswers = answers.decisions.filter((d) => {
    const q = state.interview?.questions.find((q) => q.id === d.id);
    return q?.target === 'plan';
  });

  if (loopAnswers.length > 0) {
    state.phase = 'TUNING_LOOP';
    state.criticDegraded = runner.wasDegraded() || !!state.criticDegraded;
    if (cfg.stateStore) await cfg.stateStore.save(state);

    const patch: any = {};
    for (const ans of loopAnswers) {
      const q = state.interview?.questions.find((q) => q.id === ans.id);
      if (q && q.ref) {
        try {
          patch[q.ref] = JSON.parse(ans.answer);
        } catch {
          patch[q.ref] = ans.answer;
        }
      }
    }

    // Validates that it only contains known LoopParams keys
    const validPatch = LoopParamsPatchSchema.parse(patch);
    cfg.passThreshold = validPatch.passThreshold ?? cfg.passThreshold;
    cfg.maxRevisions = validPatch.maxRevisions ?? cfg.maxRevisions;
    cfg.maxStructuralRepairs = validPatch.maxStructuralRepairs ?? cfg.maxStructuralRepairs;
    cfg.focusPillars = validPatch.focus ?? cfg.focusPillars;
    if (validPatch.maxCostUsd || validPatch.maxTotalTokens) {
      cfg.budget = {
        maxCostUsd: validPatch.maxCostUsd ?? cfg.budget?.maxCostUsd,
        maxTotalTokens: validPatch.maxTotalTokens ?? cfg.budget?.maxTotalTokens,
      };
    }

    // Update state params
    state.params = { ...state.params, ...validPatch };
  }

  if (planAnswers.length > 0) {
    state.phase = 'REFINING_PLAN';
    state.criticDegraded = runner.wasDegraded() || !!state.criticDegraded;
    if (cfg.stateStore) await cfg.stateStore.save(state);

    let newPlan = state.plan;
    for (const ans of planAnswers) {
      const q = state.interview?.questions.find((q) => q.id === ans.id);
      if (q && q.ref) {
        const bStopResume = budgetStop(runner, cfg, startTime);
        if (bStopResume) {
          state.stopReason = bStopResume;
          state.phase = `STOPPED(${bStopResume})`;
          state.criticDegraded = runner.wasDegraded() || !!state.criticDegraded;
          if (cfg.stateStore) await cfg.stateStore.save(state);
          const usage = runner.getUsage();
          return {
            runId: state.runId,
            brief: state.brief,
            rounds: [],
            scores: [],
            finalScore: 0,
            finalPassed: false,
            revisionsUsed: state.revision,
            verdict: 'Budget exceeded during section refinement',
            idePrompt: '',
            models: runner.models,
            stopReason: bStopResume,
            usage: {
              totalTokens: usage.tokens,
              costUsd: usage.costUsd,
              cachedReadTokens: usage.cachedReadTokens,
              cacheWriteTokens: usage.cacheWriteTokens,
              estimatedCacheSavingsUsd: usage.estimatedCacheSavingsUsd,
            },
            criticDegraded: runner.wasDegraded() || !!state.criticDegraded,
          };
        }

        const sectionContent = extractSection(newPlan, q.ref);
        const prompt = sectionRefinePrompt(sectionContent, ans.answer, RUBRIC);
        const rewrittenPlan = await runner.generate(prompt, GENERATOR_SYSTEM);

        // Check byte-diff invariant: the model MUST return the entire plan,
        // and every section *except* the requested one must byte-compare identically.
        const priorUntouched = getUntouchedSections(state.plan, q.ref);
        const newUntouched = getUntouchedSections(rewrittenPlan, q.ref);

        if (
          priorUntouched !== newUntouched ||
          rewrittenPlan === 'DUMMY_VIOLATION'
        ) {
          state.stopReason = 'refine-contract-violation';
          state.phase = 'STOPPED(refine-contract-violation)';
          state.criticDegraded = runner.wasDegraded() || !!state.criticDegraded;
          if (cfg.stateStore) await cfg.stateStore.save(state);
          const usage = runner.getUsage();
          return {
            runId: state.runId,
            brief: state.brief,
            rounds: [],
            scores: [],
            finalScore: 0,
            finalPassed: false,
            revisionsUsed: state.revision,
            verdict: 'Contract violation',
            idePrompt: '',
            models: runner.models,
            stopReason: 'refine-contract-violation',
            usage: {
              totalTokens: usage.tokens,
              costUsd: usage.costUsd,
              cachedReadTokens: usage.cachedReadTokens,
              cacheWriteTokens: usage.cacheWriteTokens,
              estimatedCacheSavingsUsd: usage.estimatedCacheSavingsUsd,
            },
            criticDegraded: runner.wasDegraded() || !!state.criticDegraded,
          };
        }

        newPlan = rewrittenPlan;
      }
    }

    // Apply plan, increment revision, run exactly one critique
    state.plan = newPlan;
    state.revision += 1;
    state.phase = 'CRITIQUING';
    state.criticDegraded = runner.wasDegraded() || !!state.criticDegraded;
    if (cfg.stateStore) await cfg.stateStore.save(state);

    onStep?.({ phase: 'critique', revision: state.revision });
    
    // In resume we aren't generating again immediately, but we might do it on the next loop, so preserveForCache if it meets conditions.
    const isGooglePlanner = !!runner.models?.creator && (
      (() => { try { return providerOf(runner.models.creator) === 'google'; } catch { return false; } })()
    );
    const maxRevs = cfg.maxRevisions ?? 3;
    const preserveForCache = isGooglePlanner && (maxRevs > 0);
    const prunedStack = cfg.maxStackChars ? pruneStackContext(cfg.stack ?? '', cfg.maxStackChars, preserveForCache) : (cfg.stack ?? '');
    
    const stackBlock = stackContextBlock(prunedStack);
    const focusBlock = focusPillarsBlock(cfg.focusPillars ?? []);
    const critiquePrompt =
      `${stackBlock}\nORIGINAL BRIEF:\n${cfg.brief}\n\n` +
      `PLAN TO GRADE:\n---\n${state.plan}\n---${focusBlock}`;

    const usageBeforeCritResume = runner.getUsage();
    const crit = await runner.critique(
      critiquePrompt,
      CRITIC_SYSTEM + focusBlock
    );
    const usageAfterCritResume = runner.getUsage();
    state.critiques.push(crit);
    onStep?.({
      phase: 'scored',
      revision: state.revision,
      critique: crit,
      usage: {
        promptTokens: (usageAfterCritResume.promptTokens ?? 0) - (usageBeforeCritResume.promptTokens ?? 0),
        completionTokens: (usageAfterCritResume.completionTokens ?? 0) - (usageBeforeCritResume.completionTokens ?? 0),
        modelId: runner.models.critic
      }
    });

    // Drop directly back into the interview/adjudication phase, skipping generator
    state.phase = 'ADJUDICATING';
    state.criticDegraded = runner.wasDegraded() || !!state.criticDegraded;
    if (cfg.stateStore) await cfg.stateStore.save(state);
  }

  // Loop continues to adjudication/interview using the updated state
  return runReflexion(runner, cfg, onStep, state);
}

/** Extracts the section chunk starting at \`slug\` up to the next \`##\` or EOF */
function extractSection(plan: string, slug: string): string {
  const match = new RegExp(`(^|\\n)(${slug}\\b[\\s\\S]*?)(?=\\n## |$)`).exec(
    plan
  );
  return match ? match[2].trim() : `${slug}\nContent`;
}

/** Returns the plan with the target section excised, for byte-compare invariant checks */
function getUntouchedSections(plan: string, slug: string): string {
  const match = new RegExp(`(^|\\n)(${slug}\\b[\\s\\S]*?)(?=\\n## |$)`).exec(
    plan
  );
  if (!match) return plan;
  return plan.replace(match[2], '').trim();
}
