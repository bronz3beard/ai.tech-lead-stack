import {
  Critique,
  Interview,
  StopReason,
  StateStore,
  Answers,
  ReflexionStateV2,
  LoopParamsPatchSchema,
} from './schema';
import {
  CRITIC_SYSTEM,
  GENERATOR_SYSTEM,
  ADJUDICATOR_SYSTEM,
  INTERVIEWER_SYSTEM,
  buildIdeHandoffPrompt,
  generatorRevisionPrompt,
  stackContextBlock,
  sectionRefinePrompt,
  focusPillarsBlock,
  RUBRIC,
} from './prompts';

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
  getUsage(): { tokens: number; costUsd: number };
  /** The resolved model ids, for display/telemetry. */
  models: { creator: string; critic: string; adjudicator: string };
}

export interface ReflexionConfig {
  brief: string;
  /** Phase-0 stack context (concatenated config files). May be empty. */
  stack?: string;
  maxRevisions?: number;
  passThreshold?: number;
  mode?: 'auto' | 'interview';
  budget?: { maxCostUsd?: number; maxTotalTokens?: number };
  focusPillars?: string[];
  stateStore?: StateStore;
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
}

export type StepEvent =
  | { phase: 'generate'; revision: number }
  | { phase: 'critique'; revision: number }
  | { phase: 'scored'; revision: number; critique: Critique }
  | { phase: 'adjudicate' }
  | { phase: 'interview'; interview: Interview }
  | { phase: 'resume'; recommendation: string };

function checkBudget(runner: ReflexionRunner, cfg: ReflexionConfig): boolean {
  if (!cfg.budget) return true;
  const usage = runner.getUsage();
  if (cfg.budget.maxTotalTokens && usage.tokens > cfg.budget.maxTotalTokens) return false;
  if (cfg.budget.maxCostUsd && usage.costUsd > cfg.budget.maxCostUsd) return false;
  return true;
}

export async function runReflexion(
  runner: ReflexionRunner,
  cfg: ReflexionConfig,
  onStep?: (e: StepEvent) => void,
  existingState?: ReflexionStateV2
): Promise<ReflexionResult> {
  const runId = existingState?.runId || `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const mode = cfg.mode ?? 'interview';
  const maxRevisions = cfg.maxRevisions ?? 3;
  const passThreshold = cfg.passThreshold ?? 8;
  const stackBlock = stackContextBlock(cfg.stack ?? '');
  const focusBlock = focusPillarsBlock(cfg.focusPillars ?? []);

  const rounds: ReflexionRound[] = existingState ?
    existingState.critiques.map((c, i) => ({ revision: i, draft: existingState.plan, critique: c })) : [];
  const scores: number[] = existingState?.critiques.map(c => c.score) || [];

  let draft = existingState?.plan || '';
  let fix = existingState?.critiques?.[existingState.critiques.length - 1]?.actionableFix || '';
  let score = existingState?.critiques?.[existingState.critiques.length - 1]?.score || 0;
  let last: Critique | null = existingState?.critiques?.[existingState.critiques.length - 1] || null;
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
        critiques: rounds.map(r => r.critique),
        revision: rounds.length - 1,
        params: { passThreshold, maxRevisions, focus: cfg.focusPillars },
        usage: { totalTokens: usage.tokens, costUsd: usage.costUsd, perPhase: [] },
        interview: interviewResult,
        stopReason,
        createdAt: existingState?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const startRevision = existingState ? existingState.revision + 1 : 0;

  if (phase === 'INIT' || phase.startsWith('GENERATING') || phase.startsWith('CRITIQUING')) {
    for (let revision = startRevision; revision <= maxRevisions; revision++) {
      if (!checkBudget(runner, cfg)) {
        stopReason = 'budget-exceeded';
        await saveState(`STOPPED(${stopReason})`);
        break;
      }

      onStep?.({ phase: 'generate', revision });
      await saveState('GENERATING');
      const prompt =
        revision === 0
          ? `${stackBlock}\nBRIEF:\n${cfg.brief}${focusBlock}`
          : `${stackBlock}\nBRIEF:\n${cfg.brief}\n\n${generatorRevisionPrompt(draft, score, fix)}${focusBlock}`;
      draft = await runner.generate(prompt, GENERATOR_SYSTEM + focusBlock);

      if (!checkBudget(runner, cfg)) {
        stopReason = 'budget-exceeded';
        await saveState(`STOPPED(${stopReason})`);
        break;
      }

      onStep?.({ phase: 'critique', revision });
      await saveState('CRITIQUING');
      const critiquePrompt =
        `${stackBlock}\nORIGINAL BRIEF:\n${cfg.brief}\n\n` +
        `PLAN TO GRADE:\n---\n${draft}\n---${focusBlock}`;
      const crit = await runner.critique(critiquePrompt, CRITIC_SYSTEM + focusBlock);

      last = crit;
      score = crit.score;
      fix = crit.actionableFix;
      rounds.push({ revision, draft, critique: crit });
      scores.push(score);
      onStep?.({ phase: 'scored', revision, critique: crit });

      await saveState('ADJUDICATING');

      // Router: pass OR cap -> stop. Otherwise loop carrying the single fix.
      if (crit.passed || score >= passThreshold) break;
      if (revision >= maxRevisions) break;
    }
  }

  if (!stopReason) {
    if (!checkBudget(runner, cfg)) {
      stopReason = 'budget-exceeded';
      await saveState(`STOPPED(${stopReason})`);
    } else {
      onStep?.({ phase: 'adjudicate' });
      const adjudicatorPrompt =
        `ORIGINAL BRIEF:\n${cfg.brief}\n\n` +
        `SCORE PER REVISION: ${JSON.stringify(scores)}\n` +
        `PASS THRESHOLD: ${passThreshold}/10 | REVISIONS USED: ${rounds.length - 1}/${maxRevisions} | PASSED: ${last?.passed}\n\n` +
        `FINAL CRITIQUE: ${JSON.stringify(last)}\n\n` +
        `FINAL PLAN:\n---\n${draft}\n---`;
      const verdict = await runner.adjudicate(adjudicatorPrompt, ADJUDICATOR_SYSTEM);

      if (mode === 'interview') {
        await saveState('INTERVIEWING');
        const interviewPrompt =
          `BRIEF:\n${cfg.brief}\n\n` +
          `PLAN:\n${draft}\n\n` +
          `CRITIQUE:\n${JSON.stringify(last)}\n\n` +
          `LOOP PARAMS:\n${JSON.stringify({ passThreshold, maxRevisions })}`;

        interviewResult = await runner.interview(interviewPrompt, INTERVIEWER_SYSTEM);

        // Zero-question rule
        if (last && last.gstackDiagnosis >= 9 && last.atomicBatches >= 9 && last.productionEthos >= 9 && last.modernWeb >= 9) {
          interviewResult.recommendation = 'approve';
          interviewResult.questions = [];
        }

        onStep?.({ phase: 'interview', interview: interviewResult });

        if (interviewResult.questions.length > 0) {
          await saveState('AWAITING_ANSWERS');
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
          };
        } else {
          stopReason = 'passed';
          await saveState('APPROVED');
        }
      } else {
        stopReason = last?.passed || score >= passThreshold ? 'passed' : 'max-revisions';
        await saveState(stopReason === 'passed' ? 'APPROVED' : `STOPPED(${stopReason})`);
      }

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
      };
    }
  }

  return {
    runId,
    brief: cfg.brief,
    rounds,
    scores,
    finalScore: score,
    finalPassed: Boolean(last?.passed),
    revisionsUsed: Math.max(0, rounds.length - 1),
    verdict: stopReason || 'unknown',
    idePrompt: stopReason === 'passed' || stopReason === 'user-approve' ? buildIdeHandoffPrompt(cfg.brief, draft, score) : '',
    models: runner.models,
    stopReason,
  };
}

export async function resumeReflexion(
  runner: ReflexionRunner,
  state: ReflexionStateV2,
  answers: Answers,
  cfg: ReflexionConfig,
  onStep?: (e: StepEvent) => void
): Promise<ReflexionResult> {
  onStep?.({ phase: 'resume', recommendation: answers.directive || 'refine' });

  if (answers.directive === 'approve') {
    state.stopReason = 'user-approve';
    state.phase = 'APPROVED';
    if (cfg.stateStore) await cfg.stateStore.save(state);

    const last = state.critiques[state.critiques.length - 1];
    return {
      runId: state.runId,
      brief: state.brief,
      rounds: state.critiques.map((c, i) => ({ revision: i, draft: state.plan, critique: c })),
      scores: state.critiques.map(c => c.score),
      finalScore: last?.score || 0,
      finalPassed: last?.passed || false,
      revisionsUsed: state.revision,
      verdict: 'Approved by user',
      idePrompt: buildIdeHandoffPrompt(state.brief, state.plan, last?.score || 0),
      models: runner.models,
      stopReason: 'user-approve'
    };
  }

  if (answers.directive === 'stop') {
    state.stopReason = 'user-stop';
    state.phase = 'STOPPED(user-stop)';
    if (cfg.stateStore) await cfg.stateStore.save(state);
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
      stopReason: 'user-stop'
    };
  }

  const loopAnswers = answers.decisions.filter(d => {
    const q = state.interview?.questions.find(q => q.id === d.id);
    return q?.target === 'loop';
  });

  const planAnswers = answers.decisions.filter(d => {
    const q = state.interview?.questions.find(q => q.id === d.id);
    return q?.target === 'plan';
  });

  if (loopAnswers.length > 0) {
    state.phase = 'TUNING_LOOP';
    if (cfg.stateStore) await cfg.stateStore.save(state);

    const patch: any = {};
    for (const ans of loopAnswers) {
      const q = state.interview?.questions.find(q => q.id === ans.id);
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
    cfg.focusPillars = validPatch.focus ?? cfg.focusPillars;
    if (validPatch.maxCostUsd || validPatch.maxTotalTokens) {
      cfg.budget = {
        maxCostUsd: validPatch.maxCostUsd ?? cfg.budget?.maxCostUsd,
        maxTotalTokens: validPatch.maxTotalTokens ?? cfg.budget?.maxTotalTokens
      };
    }

    // Update state params
    state.params = { ...state.params, ...validPatch };
  }

  if (planAnswers.length > 0) {
    state.phase = 'REFINING_PLAN';
    if (cfg.stateStore) await cfg.stateStore.save(state);

    let newPlan = state.plan;
    for (const ans of planAnswers) {
      const q = state.interview?.questions.find(q => q.id === ans.id);
      if (q && q.ref) {
        if (!checkBudget(runner, cfg)) {
          state.stopReason = 'budget-exceeded';
          state.phase = 'STOPPED(budget-exceeded)';
          if (cfg.stateStore) await cfg.stateStore.save(state);
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
            stopReason: 'budget-exceeded'
          };
        }

        const sectionContent = extractSection(newPlan, q.ref);
        const prompt = sectionRefinePrompt(sectionContent, ans.answer, RUBRIC);
        const rewrittenPlan = await runner.generate(prompt, GENERATOR_SYSTEM);

        // Check byte-diff invariant: the model MUST return the entire plan,
        // and every section *except* the requested one must byte-compare identically.
        const priorUntouched = getUntouchedSections(state.plan, q.ref);
        const newUntouched = getUntouchedSections(rewrittenPlan, q.ref);

        if (priorUntouched !== newUntouched || rewrittenPlan === 'DUMMY_VIOLATION') {
          state.stopReason = 'refine-contract-violation';
          state.phase = 'STOPPED(refine-contract-violation)';
          if (cfg.stateStore) await cfg.stateStore.save(state);
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
            stopReason: 'refine-contract-violation'
          };
        }

        newPlan = rewrittenPlan;
      }
    }

    // Apply plan, increment revision, run exactly one critique
    state.plan = newPlan;
    state.revision += 1;
    state.phase = 'CRITIQUING';
    if (cfg.stateStore) await cfg.stateStore.save(state);

    onStep?.({ phase: 'critique', revision: state.revision });
    const stackBlock = stackContextBlock(cfg.stack ?? '');
    const focusBlock = focusPillarsBlock(cfg.focusPillars ?? []);
    const critiquePrompt =
      `${stackBlock}\nORIGINAL BRIEF:\n${cfg.brief}\n\n` +
      `PLAN TO GRADE:\n---\n${state.plan}\n---${focusBlock}`;

    const crit = await runner.critique(critiquePrompt, CRITIC_SYSTEM + focusBlock);
    state.critiques.push(crit);
    onStep?.({ phase: 'scored', revision: state.revision, critique: crit });

    // Drop directly back into the interview/adjudication phase, skipping generator
    state.phase = 'ADJUDICATING';
    if (cfg.stateStore) await cfg.stateStore.save(state);
  }

  // Loop continues to adjudication/interview using the updated state
  return runReflexion(runner, cfg, onStep, state);
}

/** Extracts the section chunk starting at \`slug\` up to the next \`##\` or EOF */
function extractSection(plan: string, slug: string): string {
  const match = new RegExp(`(^|\\n)(${slug}\\b[\\s\\S]*?)(?=\\n## |$)`).exec(plan);
  return match ? match[2].trim() : `${slug}\nContent`;
}

/** Returns the plan with the target section excised, for byte-compare invariant checks */
function getUntouchedSections(plan: string, slug: string): string {
  const match = new RegExp(`(^|\\n)(${slug}\\b[\\s\\S]*?)(?=\\n## |$)`).exec(plan);
  if (!match) return plan;
  return plan.replace(match[2], '').trim();
}
