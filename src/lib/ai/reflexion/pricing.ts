import { MODELS } from '@/app/api/chat/constants';

/**
 * Operator-maintained rates per 1M tokens.
 * These rates may drift from actual provider pricing over time.
 * Do not hardcode prices outside of this single source of truth.
 *
 * TODO: Operator must fill these in from the providers' official pricing pages.
 */
export const PRICE_PER_MTOK: Record<
  string,
  { inputUsdPerMTok: number; outputUsdPerMTok: number }
> = {
  [MODELS.GEMINI]: {
    inputUsdPerMTok: 1.5, // For prompts and input context
    outputUsdPerMTok: 9.0, // For generated text
  },
  [MODELS.CLAUDE]: {
    inputUsdPerMTok: 3.0, // For prompts and input context
    outputUsdPerMTok: 15.0, // For generated text (including "extended thinking" tokens)
  },
  [MODELS.GEMINI_FALLBACK_CRITIC]: {
    inputUsdPerMTok: 2.0, // For prompts up to 200K tokens
    outputUsdPerMTok: 12.0, // For generated text
  },
};
