import { Critique } from './schema';
import {
  CRITIC_SYSTEM,
  GENERATOR_SYSTEM,
  ADJUDICATOR_SYSTEM,
  buildIdeHandoffPrompt,
  generatorRevisionPrompt,
  stackContextBlock,
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
  /** The resolved model ids, for display/telemetry. */
  models: { creator: string; critic: string; adjudicator: string };
}

export interface ReflexionConfig {
  brief: string;
  /** Phase-0 stack context (concatenated config files). May be empty. */
  stack?: string;
  maxRevisions?: number;
  passThreshold?: number;
}

export interface ReflexionRound {
  revision: number;
  draft: string;
  critique: Critique;
}

export interface ReflexionResult {
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
}

export type StepEvent =
  | { phase: 'generate'; revision: number }
  | { phase: 'critique'; revision: number }
  | { phase: 'scored'; revision: number; critique: Critique }
  | { phase: 'adjudicate' };

export async function runReflexion(
  runner: ReflexionRunner,
  cfg: ReflexionConfig,
  onStep?: (e: StepEvent) => void
): Promise<ReflexionResult> {
  const maxRevisions = cfg.maxRevisions ?? 3;
  const passThreshold = cfg.passThreshold ?? 8;
  const stackBlock = stackContextBlock(cfg.stack ?? '');

  const rounds: ReflexionRound[] = [];
  const scores: number[] = [];

  let draft = '';
  let fix = '';
  let score = 0;
  let last: Critique | null = null;

  for (let revision = 0; revision <= maxRevisions; revision++) {
    onStep?.({ phase: 'generate', revision });
    const prompt =
      revision === 0
        ? `${stackBlock}\nBRIEF:\n${cfg.brief}`
        : `${stackBlock}\nBRIEF:\n${cfg.brief}\n\n${generatorRevisionPrompt(draft, score, fix)}`;
    draft = await runner.generate(prompt, GENERATOR_SYSTEM);

    onStep?.({ phase: 'critique', revision });
    const critiquePrompt =
      `${stackBlock}\nORIGINAL BRIEF:\n${cfg.brief}\n\n` +
      `PLAN TO GRADE:\n---\n${draft}\n---`;
    const crit = await runner.critique(critiquePrompt, CRITIC_SYSTEM);

    last = crit;
    score = crit.score;
    fix = crit.actionableFix;
    rounds.push({ revision, draft, critique: crit });
    scores.push(score);
    onStep?.({ phase: 'scored', revision, critique: crit });

    // Router: pass OR cap -> stop. Otherwise loop carrying the single fix.
    if (crit.passed || score >= passThreshold) break;
    if (revision >= maxRevisions) break;
  }

  onStep?.({ phase: 'adjudicate' });
  const adjudicatorPrompt =
    `ORIGINAL BRIEF:\n${cfg.brief}\n\n` +
    `SCORE PER REVISION: ${JSON.stringify(scores)}\n` +
    `PASS THRESHOLD: ${passThreshold}/10 | REVISIONS USED: ${rounds.length - 1}/${maxRevisions} | PASSED: ${last?.passed}\n\n` +
    `FINAL CRITIQUE: ${JSON.stringify(last)}\n\n` +
    `FINAL PLAN:\n---\n${draft}\n---`;
  const verdict = await runner.adjudicate(adjudicatorPrompt, ADJUDICATOR_SYSTEM);

  return {
    brief: cfg.brief,
    rounds,
    scores,
    finalScore: score,
    finalPassed: Boolean(last?.passed),
    revisionsUsed: rounds.length - 1,
    verdict,
    idePrompt: buildIdeHandoffPrompt(cfg.brief, draft, score),
    models: runner.models,
  };
}
