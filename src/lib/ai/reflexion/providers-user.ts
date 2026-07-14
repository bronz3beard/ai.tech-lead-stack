import type { User } from '@prisma/client';

import { MODELS } from '@/app/api/chat/constants';
import { resolveGeminiApiKeys } from '@/app/api/chat/utils';
import {
  getOrchestratorModels,
  validateDistinctModels,
} from '@/lib/ai/orchestrator';
import { decrypt } from '@/lib/crypto';

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

import type { ReflexionRunner } from './engine';
import { buildRunner } from './providers-env';

/**
 * Website mode: keys come from the logged-in user's encrypted, stored keys —
 * the same source `initializeModel` uses for /chat. The user's chosen creator
 * model is honoured (via `getOrchestratorModels`); the critic is pinned to
 * Claude so the grader is always a different model from the writer.
 *
 * This file is imported ONLY from server code (the API route). It is never run
 * under `tsx`, so the '@/' alias resolves fine.
 */
export function runnerFromUser(user: User): ReflexionRunner {
  const geminiKey = resolveGeminiApiKeys(user, decrypt)[0];
  if (!geminiKey) {
    throw new Error(
      'No Gemini API key saved. Add one in Settings to use the Reflexion Loop.'
    );
  }
  if (!user.claudeApiKey?.trim()) {
    throw new Error(
      'No Claude API key saved. The Reflexion Loop uses Claude as its critic — add one in Settings.'
    );
  }

  const google = createGoogleGenerativeAI({ apiKey: geminiKey });
  const anthropic = createAnthropic({
    apiKey: decrypt(user.claudeApiKey).trim(),
  });

  const { creatorModel } = getOrchestratorModels(user);
  const criticId = MODELS.CLAUDE;
  validateDistinctModels(creatorModel, criticId);

  return buildRunner(
    google(creatorModel),
    anthropic(criticId),
    anthropic(criticId),
    { creator: creatorModel, critic: criticId, adjudicator: criticId },
    google(MODELS.GEMINI_FALLBACK_CRITIC)
  );
}
