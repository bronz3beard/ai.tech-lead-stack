import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  generateText,
  Output,
  type LanguageModel,
  type LanguageModelUsage,
} from 'ai';
import { MODELS } from '../../../app/api/chat/constants';
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

/** Local copy of the distinctness guard so this file imports nothing via '@/'. */
function assertDistinct(creator: string, critic: string): void {
  if (creator === critic) {
    throw new Error(
      `Reflexion requires the creator (${creator}) and critic (${critic}) to be different models, so the writer never grades its own work.`
    );
  }
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

    const usageFallback = usage as { promptTokens?: number; completionTokens?: number } & typeof usage;
    const inputTokens = usageFallback.promptTokens ?? usage.inputTokens ?? 0;
    const outputTokens = usageFallback.completionTokens ?? usage.outputTokens ?? 0;
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
 * CLI / MCP mode: keys from the environment. Creator = Gemini, Critic +
 * Adjudicator = Claude. Works headless across ANY repo.
 */
export function runnerFromEnv(): ReflexionRunner {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const claudeKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!geminiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set (needed for the generator). Get one at https://aistudio.google.com/apikey'
    );
  }
  if (!claudeKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set (needed for the Claude critic). Get one at https://console.anthropic.com'
    );
  }

  const google = createGoogleGenerativeAI({ apiKey: geminiKey });
  const anthropic = createAnthropic({ apiKey: claudeKey });

  const creatorId = process.env.REFLEXION_CREATOR_MODEL || MODELS.GEMINI;
  const criticId = process.env.REFLEXION_CRITIC_MODEL || MODELS.CLAUDE;
  const adjudicatorId =
    process.env.REFLEXION_ADJUDICATOR_MODEL || MODELS.CLAUDE;

  assertDistinct(creatorId, criticId);

  return buildRunner(
    google(creatorId),
    anthropic(criticId),
    anthropic(adjudicatorId),
    { creator: creatorId, critic: criticId, adjudicator: adjudicatorId },
    google(MODELS.GEMINI_FALLBACK_CRITIC)
  );
}
