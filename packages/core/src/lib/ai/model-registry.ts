/**
 *
 * WHY THIS EXISTS
 * Today the repo picks the SDK by *role slot*, not by the model you asked for:
 *   - src/lib/ai/reflexion/providers-env.ts   → runnerFromEnv() always does
 *       google(creatorId) and anthropic(criticId)
 *   - src/lib/ai/reflexion/providers-user.ts  → runnerFromUser() always does
 *       google(creatorModel), critic pinned to anthropic(MODELS.CLAUDE)
 *   - src/app/api/chat/utils.ts               → initializeModel() picks the
 *       provider from user.preferredModel, then applies modelId *within* it.
 * That hard-couples a responsibility to a provider, which is exactly why you
 * cannot currently say "creator = claude-opus-4-6". This module inverts it:
 * given a concrete model id, infer the provider FROM THE ID and build the client.
 *
 * DESIGN RULES
 *  - Keep this module PURE and taxonomy-independent. It takes ONE already-resolved
 *    API key and returns a LanguageModel. Deciding *which* key to use — including
 *    the Jules-vs-Gemini nuance (both ride the Google SDK but use different key
 *    slots: user.julesApiKey vs user.geminiApiKey) — belongs in the resolver
 *    (src/lib/ai/model-resolver.ts), NOT here.
 *  - NO '@/' path alias in this file. It is imported by tsx CLI scripts where the
 *    alias does not resolve (same reason providers-env.ts avoids '@/').
 */
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

export type ProviderFamily = 'anthropic' | 'google' | 'openai';

/**
 * Prefix rules, evaluated top-to-bottom. Add rows here when you onboard a new
 * model family. Jules models are Gemini variants → they resolve to 'google'
 * (the *key* used for them is chosen by the resolver, not by this table).
 */
const PREFIX_RULES: Array<[RegExp, ProviderFamily]> = [
  [/^claude/i, 'anthropic'],
  [/^(gemini|jules|models\/gemini)/i, 'google'],
  [/^(gpt|o[1-9]|chatgpt|text-|omni)/i, 'openai'],
];

export function providerOf(modelId: string): ProviderFamily {
  const id = (modelId ?? '').trim();
  for (const [re, family] of PREFIX_RULES) {
    if (re.test(id)) return family;
  }
  throw new Error(
    `model-registry: cannot infer a provider for model id "${modelId}". ` +
      `Add a rule to PREFIX_RULES or pass an explicit family.`
  );
}

/**
 * Build a LanguageModel for `modelId` using the supplied key. The SDK is chosen
 * purely from the model id, so any responsibility can be pointed at any model.
 */
export function createModel(modelId: string, apiKey: string): LanguageModel {
  if (!apiKey?.trim()) {
    throw new Error(
      `model-registry: no API key supplied for model "${modelId}".`
    );
  }
  const key = apiKey.trim();
  switch (providerOf(modelId)) {
    case 'anthropic':
      return createAnthropic({ apiKey: key })(modelId);
    case 'google':
      return createGoogleGenerativeAI({ apiKey: key })(modelId);
    case 'openai':
      return createOpenAI({ apiKey: key })(modelId);
  }
}

/**
 * Optional catalog the UI can render as dropdown options and the resolver can
 * validate against. Keep this the single list of "models we know how to route".
 * Extend freely — the point of the whole exercise is Opus-vs-Flash granularity,
 * so list concrete ids, not just provider families.
 */
export type KeySlot = 'anthropic' | 'gemini' | 'openai' | 'jules';

export interface ModelCatalogEntry {
  id: string; // exact model id passed to the SDK
  label: string; // shown in the UI
  family: ProviderFamily;
  keySlot: KeySlot; // which user/env key to use
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  // Anthropic
  {
    id: 'claude-opus-4-6',
    label: 'Claude Opus 4.6',
    family: 'anthropic',
    keySlot: 'anthropic',
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    family: 'anthropic',
    keySlot: 'anthropic',
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    family: 'anthropic',
    keySlot: 'anthropic',
  },
  // Google (Gemini)
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    family: 'google',
    keySlot: 'gemini',
  },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro (preview)',
    family: 'google',
    keySlot: 'gemini',
  },
  // Google (Jules — same SDK, different key slot)
  {
    id: 'gemini-3.1-pro',
    label: 'Google Jules (Gemini 3.1 Pro)',
    family: 'google',
    keySlot: 'jules',
  },
  // OpenAI
  { id: 'gpt-5.4', label: 'GPT-5.4', family: 'openai', keySlot: 'openai' },
];

export function catalogEntry(modelId: string): ModelCatalogEntry | undefined {
  return MODEL_CATALOG.find((m) => m.id === modelId);
}
