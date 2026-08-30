import {
  generateText,
  Output,
  type LanguageModel,
  type LanguageModelUsage,
} from 'ai';

import { MODELS } from '../../../app/api/chat/constants';
import { createModel } from '../model-registry';
import {
  assertDistinctModels,
  buildRoleModel,
  keyFor,
  type ResolveCtx,
} from '../model-resolver';
import type { ReflexionRunner } from './engine';
import { PRICE_PER_MTOK } from './pricing';
import { CritiqueSchema, InterviewSchema } from './schema';

/**
 * Inspects the error status or message to identify hard connection/auth/rate limit failures.
 */
export function isHardApiFailure(error: any): boolean {
  if (!error) return false;
  // Check HTTP status code
  const status = error.status ?? error.statusCode;
  if (typeof status === 'number') {
    if (
      status === 401 ||
      status === 403 ||
      status === 429 ||
      (status >= 500 && status < 600)
    ) {
      return true;
    }
  }
  // Check message content
  const message = String(error.message ?? error).toLowerCase();
  const keywords = [
    'quota',
    'credit',
    'exhausted',
    'rate limit',
    'insufficient',
    'unauthorized',
  ];
  return keywords.some((keyword) => message.includes(keyword));
}

/** Local distinctness guard, kept for callers that import it from here. */
function assertDistinct(creator: string, critic: string): void {
  assertDistinctModels(creator, critic, 'creator', 'critic');
}

export function buildRunner(
  creator: LanguageModel,
  critic: LanguageModel,
  adjudicator: LanguageModel,
  models: ReflexionRunner['models'],
  fallbackCritic?: LanguageModel
): ReflexionRunner {
  let accumulatedTokens = 0;
  let totalCostUsd = 0;
  let degraded = false;

  const warnedAboutCost = new Set<string>();

  function addUsage(usage: LanguageModelUsage | undefined, modelId: string) {
    if (!usage) return;
    accumulatedTokens += usage.totalTokens || 0;

    const pricing = PRICE_PER_MTOK[modelId];
    if (!pricing) {
      if (!warnedAboutCost.has(modelId)) {
        console.warn(
          `reflexion: cost tracking not available for provider ${modelId}; cost contribution will be 0.`
        );
        warnedAboutCost.add(modelId);
      }
      return;
    }

    const usageFallback = usage as {
      promptTokens?: number;
      completionTokens?: number;
    } & typeof usage;
    const inputTokens = usageFallback.promptTokens ?? usage.inputTokens ?? 0;
    const outputTokens =
      usageFallback.completionTokens ?? usage.outputTokens ?? 0;
    const inputCost = (inputTokens / 1_000_000) * pricing.inputUsdPerMTok;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputUsdPerMTok;
    totalCostUsd += inputCost + outputCost;
  }

  return {
    models,
    wasDegraded() {
      return degraded;
    },
    async generate(prompt, system) {
      const { text, usage } = await generateText({
        model: creator,
        system,
        prompt,
      });
      addUsage(usage, models.creator);
      return text.trim();
    },
    async critique(prompt, system) {
      try {
        const { output, usage } = await generateText({
          model: critic,
          output: Output.object({ schema: CritiqueSchema }),
          system,
          prompt,
        });
        addUsage(usage, models.critic);
        return output;
      } catch (error) {
        if (isHardApiFailure(error) && fallbackCritic) {
          degraded = true;
          const { output, usage } = await generateText({
            model: fallbackCritic,
            output: Output.object({ schema: CritiqueSchema }),
            system,
            prompt,
          });
          addUsage(usage, MODELS.GEMINI_FALLBACK_CRITIC);
          return output;
        }
        throw error;
      }
    },
    async adjudicate(prompt, system) {
      try {
        const { text, usage } = await generateText({
          model: adjudicator,
          system,
          prompt,
        });
        addUsage(usage, models.adjudicator);
        return text.trim();
      } catch (error) {
        if (isHardApiFailure(error) && fallbackCritic) {
          degraded = true;
          const { text, usage } = await generateText({
            model: fallbackCritic,
            system,
            prompt,
          });
          addUsage(usage, MODELS.GEMINI_FALLBACK_CRITIC);
          return text.trim();
        }
        throw error;
      }
    },
    async interview(prompt, system) {
      try {
        const { output, usage } = await generateText({
          model: critic,
          output: Output.object({ schema: InterviewSchema }),
          system,
          prompt,
        });
        addUsage(usage, models.critic);
        return { ...output, questions: output.questions.slice(0, 5) };
      } catch (error) {
        if (isHardApiFailure(error) && fallbackCritic) {
          degraded = true;
          const { output, usage } = await generateText({
            model: fallbackCritic,
            output: Output.object({ schema: InterviewSchema }),
            system,
            prompt,
          });
          addUsage(usage, MODELS.GEMINI_FALLBACK_CRITIC);
          return { ...output, questions: output.questions.slice(0, 5) };
        }
        throw error;
      }
    },
    getUsage() {
      return {
        tokens: accumulatedTokens,
        costUsd: Number(totalCostUsd.toFixed(6)),
      };
    },
  };
}

/**
 * CLI / MCP mode: keys + model ids come from the environment (and, when supplied,
 * per-project routing). Any responsibility can be any model — the SDK is chosen
 * from the resolved model id, not hardcoded per slot. Works headless across ANY repo.
 *
 * The reflexion loop uses planner (creator), auditor (critic) and adjudicator;
 * the `implementer` responsibility is used by the sandbox/write path, not here.
 */
export function runnerFromEnv(
  ctx: ResolveCtx = {}
): ReflexionRunner {
  const planner = buildRoleModel('planner', ctx);
  const auditor = buildRoleModel('auditor', ctx);
  const adjudicator = buildRoleModel('adjudicator', ctx);

  assertDistinct(planner.id, auditor.id);

  // Fallback critic stays a fixed, cheap Gemini model, used only on hard critic
  // failure. Build it best-effort so an all-Anthropic config without a Gemini key
  // doesn't fail at setup.
  let fallbackCritic: LanguageModel | undefined;
  try {
    fallbackCritic = createModel(
      MODELS.GEMINI_FALLBACK_CRITIC,
      keyFor('gemini', ctx)
    );
  } catch {
    fallbackCritic = undefined;
  }

  return buildRunner(
    planner.model,
    auditor.model,
    adjudicator.model,
    { creator: planner.id, critic: auditor.id, adjudicator: adjudicator.id },
    fallbackCritic
  );
}
