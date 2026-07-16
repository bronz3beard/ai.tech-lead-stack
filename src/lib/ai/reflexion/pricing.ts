import { MODELS } from '@/app/api/chat/constants';

/**
 * Operator-maintained rates per 1M tokens.
 * These rates may drift from actual provider pricing over time.
 * Do not hardcode prices outside of this single source of truth.
 *
 * TODO: Operator must fill these in from the providers' official pricing pages.
 */
export const PRICE_PER_MTOK: Record<string, { inputUsdPerMTok: number; outputUsdPerMTok: number }> = {
  [MODELS.GEMINI]: {
    inputUsdPerMTok: 0.0, // TODO: operator must fill
    outputUsdPerMTok: 0.0, // TODO: operator must fill
  },
  [MODELS.CLAUDE]: {
    inputUsdPerMTok: 0.0, // TODO: operator must fill
    outputUsdPerMTok: 0.0, // TODO: operator must fill
  },
  [MODELS.GEMINI_FALLBACK_CRITIC]: {
    inputUsdPerMTok: 0.0, // TODO: operator must fill
    outputUsdPerMTok: 0.0, // TODO: operator must fill
  },
};
