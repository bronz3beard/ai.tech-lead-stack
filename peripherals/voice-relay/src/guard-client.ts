/**
 * @file guard-client.ts
 * @desc L2 — Tiered guard cascade (Local Ollama → Gemini Cloud → Regex).
 *
 * Ensures every TTS-bound text has an assessor if L1 flags it.
 * Fails open (falls back to lower tiers) without blocking the voice path.
 */

import crypto from 'node:crypto';
import { sanitizeSpoken } from './spoken-guard.js';

export interface GuardResult {
  source: 'local-ollama' | 'gemini-cloud' | 'regex-sanitizer';
  spoken_ok: boolean;
  markdown_consistent: boolean;
  repaired_spoken: string;
  reason: string;
}

/** Schema matching what both LLMs are instructed to return. */
interface GuardLLMResponse {
  spoken_ok?: boolean;
  markdown_consistent?: boolean;
  repaired_spoken?: string;
  reason?: string;
}

/* ------------------------------------------------------------------ */
/* State / Cache                                                       */
/* ------------------------------------------------------------------ */

// In-memory cache to prevent re-judging identical prompt/spoken pairs
const guardCache = new Map<string, GuardResult>();

function hashCacheKey(prompt: string, spoken: string): string {
  return crypto
    .createHash('sha256')
    .update(prompt)
    .update(spoken)
    .digest('hex');
}

/** Expose cache clearing for tests. */
export function __clearGuardCache() {
  guardCache.clear();
}

/* ------------------------------------------------------------------ */
/* Tiered Guard Implementation                                          */
/* ------------------------------------------------------------------ */

/**
 * Main entry point for the tiered guard cascade.
 *
 * TIER A: Local Ollama (if OLLAMA_GUARD_MODEL is set)
 * TIER B: Gemini Flash-Lite (if GEMINI_API_KEY is set)
 * TIER C: Regex sanitizer (always available fallback)
 */
export async function guardSpoken(
  prompt: string,
  spoken: string,
  markdown: string,
  taskClass: string = 'freeform'
): Promise<GuardResult> {
  // Check cache first
  const cacheKey = hashCacheKey(prompt, spoken);
  if (guardCache.has(cacheKey)) {
    return guardCache.get(cacheKey)!;
  }

  const systemPrompt =
    `You are a strict Text-to-Speech (TTS) quality judge. Your job is to evaluate proposed spoken text for cleanliness and repair it if necessary.\n` +
    `The user asked a '${taskClass}' question.\n\n` +
    `1. "spoken_ok": Is it free of markdown (*, #, _, \`, []), ordered list indices (1., 2.), and preamble ("Here is...")?\n` +
    `2. "markdown_consistent": Does the spoken text contain the same facts as the markdown text (just without the formatting)?\n` +
    `3. "repaired_spoken": You MUST aggressively prune the text. If the text contains extraneous information (like python code, 'alternative formats', tables, or conversational filler), DELETE it. Return ONLY the direct answer. If spoken_ok is false, provide the cleaned, plain-speech version.\n` +
    `4. "reason": A very brief explanation of your verdict.\n\n` +
    `You MUST return valid JSON matching this schema: { "spoken_ok": boolean, "markdown_consistent": boolean, "repaired_spoken": string, "reason": string }`;

  const userPrompt = `User Prompt: ${prompt}\n\nProposed Markdown:\n${markdown}\n\nProposed Spoken (for TTS):\n${spoken}`;

  // TIER A: Local Ollama
  const localModel = process.env.OLLAMA_GUARD_MODEL;
  if (localModel) {
    try {
      const res = await fetchOllamaGuard(localModel, systemPrompt, userPrompt);
      if (res && res.repaired_spoken) {
        const result: GuardResult = {
          source: 'local-ollama',
          spoken_ok: res.spoken_ok ?? true,
          markdown_consistent: res.markdown_consistent ?? true,
          repaired_spoken: res.repaired_spoken,
          reason: res.reason ?? 'Local guard passed',
        };
        guardCache.set(cacheKey, result);
        return result;
      }
    } catch (e) {
      console.warn(
        '[Guard] Tier A (Local) failed/timed out, falling back:',
        e instanceof Error ? e.message : e
      );
    }
  }

  // TIER B: Gemini Cloud
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    const geminiModel =
      process.env.GEMINI_GUARD_MODEL || 'gemini-2.0-flash-lite';
    try {
      const res = await fetchGeminiGuard(
        geminiKey,
        geminiModel,
        systemPrompt,
        userPrompt
      );
      if (res && res.repaired_spoken) {
        const result: GuardResult = {
          source: 'gemini-cloud',
          spoken_ok: res.spoken_ok ?? true,
          markdown_consistent: res.markdown_consistent ?? true,
          repaired_spoken: res.repaired_spoken,
          reason: res.reason ?? 'Gemini guard passed',
        };
        guardCache.set(cacheKey, result);
        return result;
      }
    } catch (e) {
      console.warn(
        '[Guard] Tier B (Gemini) failed/timed out, falling back:',
        e instanceof Error ? e.message : e
      );
    }
  }

  // TIER C: Regex fallback
  const cleaned = sanitizeSpoken(spoken);
  const result: GuardResult = {
    source: 'regex-sanitizer',
    spoken_ok: false, // by definition, we got here because L1 failed
    markdown_consistent: true, // assume true since we couldn't check
    repaired_spoken: cleaned,
    reason:
      'Fell back to local regex sanitizer due to LLM guard unavailability',
  };

  // Don't cache Tier C heavily, in case network recovers
  return result;
}

/* ------------------------------------------------------------------ */
/* Tier A — Local Ollama Fetch                                        */
/* ------------------------------------------------------------------ */

async function fetchOllamaGuard(
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<GuardLLMResponse | null> {
  const url = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(2500), // local should be fast, but don't block
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0 },
      format: {
        type: 'object',
        properties: {
          spoken_ok: { type: 'boolean' },
          markdown_consistent: { type: 'boolean' },
          repaired_spoken: { type: 'string' },
          reason: { type: 'string' },
        },
        required: [
          'spoken_ok',
          'markdown_consistent',
          'repaired_spoken',
          'reason',
        ],
      },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const data = (await res.json()) as any;
  const content = data?.message?.content;
  if (!content) return null;

  try {
    return JSON.parse(content) as GuardLLMResponse;
  } catch (e) {
    return null; // parse failed
  }
}

/* ------------------------------------------------------------------ */
/* Tier B — Gemini Fetch                                               */
/* ------------------------------------------------------------------ */

async function fetchGeminiGuard(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<GuardLLMResponse | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // 1000ms hard timeout, with one retry
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(1000), // strict 1s timeout
        body: JSON.stringify({
          system_instruction: { parts: { text: systemPrompt } },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                spoken_ok: { type: 'BOOLEAN' },
                markdown_consistent: { type: 'BOOLEAN' },
                repaired_spoken: { type: 'STRING' },
                reason: { type: 'STRING' },
              },
              required: [
                'spoken_ok',
                'markdown_consistent',
                'repaired_spoken',
                'reason',
              ],
            },
          },
        }),
      });

      if (!res.ok) throw new Error(`Gemini returned ${res.status}`);
      const data = (await res.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;

      try {
        return JSON.parse(text) as GuardLLMResponse;
      } catch (e) {
        return null;
      }
    } catch (e: any) {
      if (attempt === 2) throw e;
      // Retry once if timeout/network error
    }
  }
  return null;
}
