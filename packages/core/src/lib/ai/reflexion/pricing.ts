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
    // Google's published rate from 2027-01-01 ($0.75 / $3.75 until then): budget
    // caps should over- rather than under-estimate.
    inputUsdPerMTok: 1.5, // For prompts and input context
    outputUsdPerMTok: 7.5, // For generated text
    cachedInputUsdPerMTok: 0.375, // TODO: verify with provider
    cacheWriteUsdPerMTok: 1.5, // TODO: verify with provider
  },
  [MODELS.CLAUDE]: {
    inputUsdPerMTok: 2.0, // For prompts and input context
    outputUsdPerMTok: 10.0, // For generated text (including thinking tokens)
    cachedInputUsdPerMTok: 0.2, // Published cache-read rate
    cacheWriteUsdPerMTok: 2.5, // 5-minute cache write (1.25x input)
  },
  [MODELS.GEMINI_FALLBACK_CRITIC]: {
    inputUsdPerMTok: 2.0, // For prompts up to 200K tokens
    outputUsdPerMTok: 12.0, // For generated text
    cachedInputUsdPerMTok: 0.5, // TODO: verify with provider
    cacheWriteUsdPerMTok: 2.0, // TODO: verify with provider
  },
};
