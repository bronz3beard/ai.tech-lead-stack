/**
 * Operator-maintained rates per 1M tokens: the single price table for every
 * cost the stack reports (reflexion budgets, ReflexionRun.costUsd and
 * AnalyticsEvent.totalCost). Do not hardcode prices anywhere else.
 *
 * Keep one entry per MODEL_CATALOG id (model-catalog.test.ts enforces it).
 * Anthropic rates verified 2026-10-08. Known upcoming change: Gemini Flash
 * doubles to $1.50 / $7.50 on 2027-01-01 (AGENTS.md freshness check).
 */
export interface ModelPrice {
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
  /** Cache-read rate; when absent cached tokens are priced as fresh input. */
  cachedInputUsdPerMTok?: number;
  /** 5-minute cache-write rate; when absent written tokens are priced as fresh input. */
  cacheWriteUsdPerMTok?: number;
}

export const PRICE_PER_MTOK: Record<string, ModelPrice> = {
  // Anthropic
  'claude-opus-5-5': { inputUsdPerMTok: 4, outputUsdPerMTok: 20, cachedInputUsdPerMTok: 0.2, cacheWriteUsdPerMTok: 5 },
  'claude-sonnet-5-5': { inputUsdPerMTok: 2, outputUsdPerMTok: 10, cachedInputUsdPerMTok: 0.2, cacheWriteUsdPerMTok: 2.5 },
  'claude-opus-4-6': { inputUsdPerMTok: 5, outputUsdPerMTok: 25, cachedInputUsdPerMTok: 0.5, cacheWriteUsdPerMTok: 6.25 },
  'claude-sonnet-4-6': { inputUsdPerMTok: 3, outputUsdPerMTok: 15, cachedInputUsdPerMTok: 0.3, cacheWriteUsdPerMTok: 3.75 },
  'claude-haiku-4-5': { inputUsdPerMTok: 1, outputUsdPerMTok: 5, cachedInputUsdPerMTok: 0.1, cacheWriteUsdPerMTok: 1.25 },
  // Google. Cache rates: TODO verify with provider (implicit caching, 25% of input).
  'gemini-3.8-flash': { inputUsdPerMTok: 0.75, outputUsdPerMTok: 3.75, cachedInputUsdPerMTok: 0.1875 },
  'gemini-3.7-flash': { inputUsdPerMTok: 0.75, outputUsdPerMTok: 3.75, cachedInputUsdPerMTok: 0.1875 },
  'gemini-3.1-pro-preview': { inputUsdPerMTok: 2, outputUsdPerMTok: 12, cachedInputUsdPerMTok: 0.5 },
  'gemini-3.1-pro-preview-customtools': { inputUsdPerMTok: 2, outputUsdPerMTok: 12, cachedInputUsdPerMTok: 0.5 },
  // OpenAI. Cache rate: TODO verify with provider.
  'gpt-6.1-sol': { inputUsdPerMTok: 2, outputUsdPerMTok: 10 },
};

/** Ids outside the table are priced like the closest family member. */
const FAMILY_FALLBACK: Array<[RegExp, string]> = [
  [/^gemini-.*flash/i, 'gemini-3.8-flash'],
  [/^gemini-.*pro/i, 'gemini-3.1-pro-preview'],
  [/^claude-.*opus/i, 'claude-opus-5-5'],
  [/^claude-.*sonnet/i, 'claude-sonnet-5-5'],
  [/^claude-.*haiku/i, 'claude-haiku-4-5'],
];

export function priceFor(
  modelId: string
): { price: ModelPrice; exact: boolean } | undefined {
  const exact = PRICE_PER_MTOK[modelId];
  if (exact) return { price: exact, exact: true };
  const family = FAMILY_FALLBACK.find(([re]) => re.test(modelId));
  return family ? { price: PRICE_PER_MTOK[family[1]], exact: false } : undefined;
}

/**
 * Cost of one model call. `inputTokens` is the provider's total input, which
 * includes cache reads and writes; those are re-priced at their own rates.
 * Returns undefined when the model has no known price.
 */
export function estimateCostUsd(usage: {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}): { costUsd: number; exactPrice: boolean } | undefined {
  const priced = priceFor(usage.modelId);
  if (!priced) return undefined;
  const { price } = priced;
  const cacheRead = usage.cacheReadTokens ?? 0;
  const cacheWrite = usage.cacheWriteTokens ?? 0;
  const freshInput = Math.max(0, usage.inputTokens - cacheRead - cacheWrite);

  const usd =
    freshInput * price.inputUsdPerMTok +
    cacheRead * (price.cachedInputUsdPerMTok ?? price.inputUsdPerMTok) +
    cacheWrite * (price.cacheWriteUsdPerMTok ?? price.inputUsdPerMTok) +
    usage.outputTokens * price.outputUsdPerMTok;

  return { costUsd: Number((usd / 1_000_000).toFixed(6)), exactPrice: priced.exact };
}
