import { MODELS } from '../constants';

/**
 * Operator-maintained rates per 1M tokens.
 * These rates may drift from actual provider pricing over time.
 * Do not hardcode prices outside of this single source of truth.
 *
 * TODO: Operator must fill these in from the providers' official pricing pages.
 */
export const PRICE_PER_MTOK: Record<
  string,
  {
    inputUsdPerMTok: number;
    outputUsdPerMTok: number;
    cachedInputUsdPerMTok?: number;
    cacheWriteUsdPerMTok?: number;
  }
> = {
  [MODELS.GEMINI]: {
    inputUsdPerMTok: 1.5, // For prompts and input context
    outputUsdPerMTok: 9.0, // For generated text
    cachedInputUsdPerMTok: 0.375, // TODO: verify with provider
    cacheWriteUsdPerMTok: 1.5, // TODO: verify with provider
  },
  [MODELS.CLAUDE]: {
    inputUsdPerMTok: 3.0, // For prompts and input context
    outputUsdPerMTok: 15.0, // For generated text (including "extended thinking" tokens)
    cachedInputUsdPerMTok: 0.3, // TODO: verify with provider (usually 10%)
    cacheWriteUsdPerMTok: 3.75, // TODO: verify with provider (usually +25%)
  },
  [MODELS.GEMINI_FALLBACK_CRITIC]: {
    inputUsdPerMTok: 2.0, // For prompts up to 200K tokens
    outputUsdPerMTok: 12.0, // For generated text
    cachedInputUsdPerMTok: 0.5, // TODO: verify with provider
    cacheWriteUsdPerMTok: 2.0, // TODO: verify with provider
  },
};
