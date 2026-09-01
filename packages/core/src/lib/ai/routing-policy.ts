import { catalogEntry, providerOf } from './model-registry';

/**
 * Define ordered ladders for model escalation (cost/capability order).
 * Derived from MODEL_CATALOG and grouped by provider/key slot.
 */
const LADDERS: Record<string, string[]> = {
  'anthropic': ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-6'],
  'gemini': ['gemini-3.6-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-pro'],
  'jules': ['gemini-3.1-pro'],
  'openai': ['gpt-5.4'],
};

/**
 * Returns the next model up the ladder for the current model's key slot,
 * or null if the current model is at the top (or not in a known ladder).
 */
export function nextModelUp(currentId: string): string | null {
  const entry = catalogEntry(currentId);
  let keySlot = entry?.keySlot;
  
  // If not in catalog, try to infer provider family
  if (!keySlot) {
    try {
      const family = providerOf(currentId);
      keySlot = family === 'anthropic' ? 'anthropic' : family === 'openai' ? 'openai' : 'gemini';
    } catch {
      return null;
    }
  }

  const ladder = LADDERS[keySlot];
  if (!ladder) return null;

  const idx = ladder.indexOf(currentId);
  if (idx === -1 || idx >= ladder.length - 1) return null;

  return ladder[idx + 1];
}

/**
 * Determines whether the loop is stalled and should escalate.
 * Escalates when the last two scores are both < passThreshold and not improving.
 */
export function shouldEscalate(scores: number[], passThreshold: number): boolean {
  if (scores.length < 2) return false;
  const last = scores[scores.length - 1];
  const prev = scores[scores.length - 2];
  
  return last < passThreshold && prev < passThreshold && (last - prev <= 0);
}
