import {
  generateText,
  Output,
  type LanguageModel,
  type LanguageModelUsage,
} from 'ai';

import { MODELS } from '../../../app/api/chat/constants';
import { createModel, providerOf } from '../model-registry';
import {
  assertDistinctModels,
  buildRoleModel,
  keyFor,
  toResponsibility,
  type ResolveCtx,
} from '../model-resolver';
import { assertCanCritique } from '../model-capabilities';
import type { ReflexionRunner } from './engine';
import { PRICE_PER_MTOK } from './pricing';
import { CritiqueSchema, InterviewSchema } from './schema';

/**
 * Inspects the error status or message to identify hard connection/auth/rate limit failures.
 */
export function isHardApiFailure(error: unknown): boolean {
  if (!error) return false;
  const errObj =
    typeof error === 'object' && error !== null
      ? (error as Record<string, unknown>)
      : undefined;
  // Check HTTP status code
  const status = errObj ? (errObj.status ?? errObj.statusCode) : undefined;
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
  const message = (
    errObj && typeof errObj.message === 'string'
      ? errObj.message
      : String(error)
  ).toLowerCase();
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
  let accumulatedCacheReadTokens = 0;
  let accumulatedCacheWriteTokens = 0;
  let totalCostUsd = 0;
  let totalCacheSavingsUsd = 0;
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
    
    const rawInputTokens = usageFallback.promptTokens ?? usage.inputTokens ?? 0;
    const outputTokens = usageFallback.completionTokens ?? usage.outputTokens ?? 0;
    
    const providerMetadata = (usage as any).providerMetadata;
    const cacheReadTokens = Number(providerMetadata?.anthropic?.cacheReadInputTokens || 0);
    const cacheWriteTokens = Number(providerMetadata?.anthropic?.cacheCreationInputTokens || 0);

    let inputCost = 0;

    if (cacheReadTokens > 0 || cacheWriteTokens > 0) {
      const freshInputTokens = Math.max(0, rawInputTokens - cacheReadTokens - cacheWriteTokens);
      inputCost += (freshInputTokens / 1_000_000) * pricing.inputUsdPerMTok;

      if (cacheReadTokens > 0 && pricing.cachedInputUsdPerMTok !== undefined) {
        inputCost += (cacheReadTokens / 1_000_000) * pricing.cachedInputUsdPerMTok;
        accumulatedCacheReadTokens += cacheReadTokens;
        totalCacheSavingsUsd += (cacheReadTokens / 1_000_000) * (pricing.inputUsdPerMTok - pricing.cachedInputUsdPerMTok);
      } else if (cacheReadTokens > 0) {
        inputCost += (cacheReadTokens / 1_000_000) * pricing.inputUsdPerMTok;
      }

      if (cacheWriteTokens > 0 && pricing.cacheWriteUsdPerMTok !== undefined) {
        inputCost += (cacheWriteTokens / 1_000_000) * pricing.cacheWriteUsdPerMTok;
        accumulatedCacheWriteTokens += cacheWriteTokens;
        totalCacheSavingsUsd += (cacheWriteTokens / 1_000_000) * (pricing.inputUsdPerMTok - pricing.cacheWriteUsdPerMTok);
      } else if (cacheWriteTokens > 0) {
        inputCost += (cacheWriteTokens / 1_000_000) * pricing.inputUsdPerMTok;
      }
    } else {
      inputCost = (rawInputTokens / 1_000_000) * pricing.inputUsdPerMTok;
    }

    const outputCost = (outputTokens / 1_000_000) * pricing.outputUsdPerMTok;
    totalCostUsd += inputCost + outputCost;
  }

  function formatCacheOptions(system: string, promptStr: string, modelId: string) {
    let family = 'unknown';
    try {
      family = providerOf(modelId);
    } catch {
      // Ignored for tests
    }
    
    const stackMatch = promptStr.match(/^(PROJECT STACK CONTEXT[\s\S]*?)(?=\n(?:ORIGINAL )?BRIEF:|\nPLAN TO GRADE:)/);
    const stackBlock = stackMatch ? stackMatch[1] : '';
    const volatilePrompt = stackMatch ? promptStr.slice(stackMatch[0].length).trimStart() : promptStr;

    if (family === 'anthropic') {
      return {
        messages: [
          {
            role: 'system',
            content: [
              {
                type: 'text',
                text: system + (stackBlock ? '\n\n' + stackBlock : ''),
                providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }
              }
            ]
          },
          { role: 'user', content: volatilePrompt }
        ] as any
      };
    } else if (family === 'google') {
      if (!(globalThis as any).__warnedGoogleCache) {
        console.warn('reflexion: Google prompt caching via cached-content is not natively exposed in this SDK version; falling back gracefully to no caching.');
        (globalThis as any).__warnedGoogleCache = true;
      }
      return { system, prompt: promptStr };
    }
    return { system, prompt: promptStr };
  }

  return {
    models,
    wasDegraded() {
      return degraded;
    },
    async generate(prompt, system) {
      const opts = formatCacheOptions(system, prompt, models.creator);
      const { text, usage } = await generateText({
        model: creator,
        ...opts,
      });
      addUsage(usage, models.creator);
      return text.trim();
    },
    async critique(prompt, system) {
      try {
        const opts = formatCacheOptions(system, prompt, models.critic);
        const { output, usage } = await generateText({
          model: critic,
          output: Output.object({ schema: CritiqueSchema }),
          ...opts,
        });
        addUsage(usage, models.critic);
        return output;
      } catch (error) {
        if (isHardApiFailure(error) && fallbackCritic) {
          degraded = true;
          const opts = formatCacheOptions(system, prompt, MODELS.GEMINI_FALLBACK_CRITIC);
          const { output, usage } = await generateText({
            model: fallbackCritic,
            output: Output.object({ schema: CritiqueSchema }),
            ...opts,
          });
          addUsage(usage, MODELS.GEMINI_FALLBACK_CRITIC);
          return output;
        }
        throw error;
      }
    },
    async adjudicate(prompt, system) {
      try {
        const opts = formatCacheOptions(system, prompt, models.adjudicator);
        const { text, usage } = await generateText({
          model: adjudicator,
          ...opts,
        });
        addUsage(usage, models.adjudicator);
        return text.trim();
      } catch (error) {
        if (isHardApiFailure(error) && fallbackCritic) {
          degraded = true;
          const opts = formatCacheOptions(system, prompt, MODELS.GEMINI_FALLBACK_CRITIC);
          const { text, usage } = await generateText({
            model: fallbackCritic,
            ...opts,
          });
          addUsage(usage, MODELS.GEMINI_FALLBACK_CRITIC);
          return text.trim();
        }
        throw error;
      }
    },
    async interview(prompt, system) {
      try {
        const opts = formatCacheOptions(system, prompt, models.critic);
        const { output, usage } = await generateText({
          model: critic,
          output: Output.object({ schema: InterviewSchema }),
          ...opts,
        });
        addUsage(usage, models.critic);
        return { ...output, questions: output.questions.slice(0, 5) };
      } catch (error) {
        if (isHardApiFailure(error) && fallbackCritic) {
          degraded = true;
          const opts = formatCacheOptions(system, prompt, MODELS.GEMINI_FALLBACK_CRITIC);
          const { output, usage } = await generateText({
            model: fallbackCritic,
            output: Output.object({ schema: InterviewSchema }),
            ...opts,
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
        cachedReadTokens: accumulatedCacheReadTokens,
        cacheWriteTokens: accumulatedCacheWriteTokens,
        estimatedCacheSavingsUsd: Number(totalCacheSavingsUsd.toFixed(6)),
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
  const planner = buildRoleModel(toResponsibility('creator'), ctx);
  let auditor = buildRoleModel(toResponsibility('critic'), ctx);
  const adjudicator = buildRoleModel(toResponsibility('adjudicator'), ctx);

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

  // Capability guard: Ensure the selected auditor supports structured output.
  let degraded = false;
  try {
    assertCanCritique(auditor.id);
  } catch (err) {
    if (fallbackCritic) {
      console.warn(`reflexion: Auditor ${auditor.id} lacks structured output capability. Falling back to degraded critic.`);
      auditor = { id: MODELS.GEMINI_FALLBACK_CRITIC, model: fallbackCritic };
      degraded = true;
    } else {
      throw err;
    }
  }

  const runner = buildRunner(
    planner.model,
    auditor.model,
    adjudicator.model,
    { creator: planner.id, critic: auditor.id, adjudicator: adjudicator.id },
    fallbackCritic
  );

  // If we already fell back during setup due to capabilities, mark the runner as degraded.
  if (degraded) {
    runner.wasDegraded = () => true;
  }

  return runner;
}
