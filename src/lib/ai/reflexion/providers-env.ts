import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, generateObject, type LanguageModel } from 'ai';

// Relative import (NOT the '@/' alias): this module is run under `tsx` by the
// CLI and the MCP server, where the '@/' path alias does not resolve. constants
// is a pure no-import file, so this stays tsx-safe. Do NOT import
// '@/lib/ai/orchestrator' here — it pulls in '@/' and would break tsx.
import { MODELS } from '../../../app/api/chat/constants';
import { CritiqueSchema } from './schema';
import type { ReflexionRunner } from './engine';

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
  models: ReflexionRunner['models']
): ReflexionRunner {
  return {
    models,
    async generate(prompt, system) {
      const { text } = await generateText({ model: creator, system, prompt });
      return text.trim();
    },
    async critique(prompt, system) {
      const { object } = await generateObject({
        model: critic,
        schema: CritiqueSchema,
        system,
        prompt,
      });
      return object;
    },
    async adjudicate(prompt, system) {
      const { text } = await generateText({ model: adjudicator, system, prompt });
      return text.trim();
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
  const adjudicatorId = process.env.REFLEXION_ADJUDICATOR_MODEL || MODELS.CLAUDE;

  assertDistinct(creatorId, criticId);

  return buildRunner(
    google(creatorId),
    anthropic(criticId),
    anthropic(adjudicatorId),
    { creator: creatorId, critic: criticId, adjudicator: adjudicatorId }
  );
}
