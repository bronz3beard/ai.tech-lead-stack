/**
 * @file eval-local-model.ts
 * @desc Evaluates the local Ollama backend used by the voice-relay peripheral.
 *
 * Voice-relay is a "dual output" assistant: for every turn the model is asked to
 * emit a <spoken> block (short, TTS-safe, no markdown) AND a <markdown> block
 * (rich text for the screen). This harness measures, per prompt:
 *   - latency + throughput (tokens/sec)   -> is the local box fast enough?
 *   - correctness                         -> did it actually answer?
 *   - conciseness of the spoken text      -> is it short enough to read aloud?
 *   - dual-output compliance              -> did it emit BOTH blocks?
 *   - TTS-friendliness of the spoken text -> any markdown leaking into speech?
 *   - repetition                          -> did it loop (common small-model failure)?
 *
 * All runs are traced + scored in Langfuse. Every score is normalised so that
 * 1.0 = good and 0.0 = bad (see the NOTE on repetition below).
 */

import * as dotenv from 'dotenv';
import { Langfuse } from 'langfuse';
import path from 'path';
import { fileURLToPath } from 'url';
import { LocalOllamaBackend } from '../src/backends.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * Default model tag, used only when OLLAMA_MODEL is not set.
 * NOTE: confirm the exact tag you actually pulled with `ollama list`.
 * The original file defaulted to "qwen3:14b" — set OLLAMA_MODEL to override.
 */
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:9b';

/** How many times to run each prompt (local latency is noisy; >1 lets us average). */
const RUNS_PER_PROMPT = Math.max(
  1,
  Number(process.env.RUNS_PER_PROMPT ?? 1) || 1
);

/** Reuse a session id across runs by setting EVAL_SESSION_ID; otherwise unique per run. */
const SESSION_ID =
  process.env.EVAL_SESSION_ID ||
  `eval-${new Date().toISOString().replace(/[:.]/g, '-')}`;

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
});

/**
 * Shape of the metadata Ollama returns on /api/chat. All optional because we
 * fall back gracefully if the backend doesn't surface the raw response.
 * Durations are in NANOSECONDS.
 */
interface OllamaRaw {
  message?: { content?: string };
  eval_count?: number; // completion tokens
  prompt_eval_count?: number; // prompt tokens
  eval_duration?: number; // ns spent generating
  total_duration?: number; // ns for the whole request
}

/** A single eval case. `check` is an optional correctness assertion. */
interface EvalCase {
  prompt: string;
  /** Return true if the answer is correct. Receives spoken text + full raw text. */
  check?: (spoken: string, raw: string) => boolean;
}

/** Case-insensitive "contains" helper for building checks. */
const has = (needle: string) => (_spoken: string, raw: string) =>
  raw.toLowerCase().includes(needle.toLowerCase());

/**
 * Test cases. The `check`s are deliberately loose heuristics — tighten or
 * swap them for your real acceptance criteria as needed.
 */
const evalConfig: EvalCase[] = [
  { prompt: 'How many weeks are in a year?', check: has('52') },
  {
    prompt: 'Explain polymorphism in 1 sentence.',
    check: (s) => s.trim().length > 0,
  },
  { prompt: 'What is 2 + 2?', check: has('4') },
  {
    prompt: 'Count backwards from 10 to 0.',
    check: (_s, raw) =>
      [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].every((n) => raw.includes(String(n))),
  },
  { prompt: 'Write a python hello world script.', check: has('print(') },
];

/* ------------------------------------------------------------------ */
/* Helpers — pure functions, 1.0 = good, 0.0 = bad.                    */
/* ------------------------------------------------------------------ */

/** Word count that returns 0 for empty/whitespace strings. */
function wordCount(text: string): number {
  const t = text.trim();
  return t.length === 0 ? 0 : t.split(/\s+/).length;
}

/** Ollama nanoseconds -> ms; undefined-safe. */
const nsToMs = (ns?: number): number | undefined =>
  ns == null ? undefined : ns / 1e6;

/**
 * Pull the spoken portion out of a dual-output response so the spoken-based
 * scores aren't accidentally measured on the whole <markdown> blob when the
 * backend didn't pre-parse it. Falls back to the raw text if no tag is found.
 */
function extractSpoken(text: string): string {
  const m = text.match(/<spoken>([\s\S]*?)<\/spoken>/i);
  return (m ? m[1] : text).trim();
}

/**
 * Conciseness of the spoken reply. Kept identical to the original formula so
 * historical Langfuse data stays comparable: <=20 words = 1.0, decaying to
 * 0.0 at 100 words.
 */
function concisenessScore(spoken: string): number {
  const words = wordCount(spoken);
  if (words <= 20) return 1.0;
  return Math.max(0, 1.0 - (words - 20) / 80);
}

/** 1.0 only if BOTH <spoken> and <markdown> blocks are present. */
function dualOutputScore(raw: string): number {
  return raw.includes('<spoken>') && raw.includes('<markdown>') ? 1.0 : 0.0;
}

/**
 * 1.0 if the spoken text is clean for TTS, 0.0 if it contains markdown-ish
 * artifacts a screen reader would mangle: * # ` , "- " bullets, "1." ordered
 * lists, _underscores_, or [text](links).
 */
function ttsFriendlyScore(spoken: string): number {
  const bad = /[*#`]|(^|\s)-\s|(^|\s)\d+\.\s|_[^_]+_|\[[^\]]+\]\([^)]+\)/m;
  return bad.test(spoken) ? 0.0 : 1.0;
}

/**
 * Repetition detection. Returns 1.0 for NO repetition (good) down to 0.0 for
 * heavy looping. Two signals:
 *   1) exact repeated sentences/lines -> hard fail (0.0)
 *   2) repeated word trigrams         -> graded
 *
 * NOTE: this REPLACES the original `repetition_penalty`, which was inverted
 * (0.0 = good). If you have Langfuse charts on "repetition_penalty", point
 * them at "no_repetition_score" (or flip the axis) — the direction is now
 * consistent with every other score.
 */
function noRepetitionScore(spoken: string): number {
  // 1) exact duplicate sentences
  const sentences = spoken
    .split(/[.?!\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 10);
  if (new Set(sentences).size < sentences.length) return 0.0;

  // 2) repeated trigrams
  const words = spoken.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 6) return 1.0;
  const trigrams = new Map<string, number>();
  for (let i = 0; i <= words.length - 3; i++) {
    const g = words.slice(i, i + 3).join(' ');
    trigrams.set(g, (trigrams.get(g) ?? 0) + 1);
  }
  const totalSlots = words.length - 2;
  const repeatedSlots = [...trigrams.values()]
    .filter((c) => c > 1)
    .reduce((acc, c) => acc + (c - 1), 0);
  const ratio = repeatedSlots / totalSlots; // fraction of trigram slots that repeat
  return Math.max(0, 1 - ratio * 3); // small amounts tolerated, heavy looping -> 0
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

interface RowResult {
  prompt: string;
  ok: boolean; // did the request succeed (no throw)?
  correct: number; // 1.0 / 0.0 from check (NaN if no check)
  latency_ms: number;
  tokens_out: number;
  tokens_per_sec: number;
  conciseness: number;
  dual_output: number;
  tts_friendly: number;
  no_repetition: number;
}

async function runEvals() {
  const backend = new LocalOllamaBackend();
  const cwd = process.cwd();

  console.log(
    `Starting evaluations for ${backend.label} (model: ${DEFAULT_MODEL})`
  );
  console.log(`Session: ${SESSION_ID} | runs/prompt: ${RUNS_PER_PROMPT}\n`);

  const rows: RowResult[] = [];

  for (const testCase of evalConfig) {
    for (let run = 1; run <= RUNS_PER_PROMPT; run++) {
      const runLabel =
        RUNS_PER_PROMPT > 1 ? ` (run ${run}/${RUNS_PER_PROMPT})` : '';
      console.log(`Testing: "${testCase.prompt}"${runLabel}`);

      const trace = langfuse.trace({
        name: 'voice-relay-eval',
        sessionId: SESSION_ID,
        input: testCase.prompt,
        metadata: { backend: backend.label, model: DEFAULT_MODEL, run },
      });

      const generation = trace.generation({
        name: 'local-ollama-generation',
        model: DEFAULT_MODEL,
        input: testCase.prompt,
      });

      const startTime = Date.now();

      try {
        const result = await backend.ask({
          prompt: testCase.prompt,
          cwd,
          requestId: trace.id,
        });

        if (!result.ok) {
          throw new Error(result.error || 'Backend request failed silently');
        }

        const wallLatency = Date.now() - startTime;
        const raw = (result.raw as OllamaRaw) ?? {};
        const rawContent: string = raw.message?.content ?? result.text ?? '';
        const spokenText: string = (
          result.spokenText || extractSpoken(rawContent)
        ).trim();

        // Prefer Ollama's real token + timing numbers; fall back to word count / wall clock.
        const tokensOut = raw.eval_count ?? wordCount(rawContent);
        const tokensIn = raw.prompt_eval_count ?? wordCount(testCase.prompt);
        const genMs = nsToMs(raw.eval_duration) ?? wallLatency;
        const latencyMs = nsToMs(raw.total_duration) ?? wallLatency;
        const tokensPerSec = genMs > 0 ? (tokensOut / genMs) * 1000 : 0;

        // Quality scores (all: 1.0 = good)
        const conciseness = concisenessScore(spokenText);
        const dualOutput = dualOutputScore(rawContent);
        const ttsFriendly = ttsFriendlyScore(spokenText);
        const noRepetition = noRepetitionScore(spokenText);
        const correct = testCase.check
          ? testCase.check(spokenText, rawContent)
            ? 1.0
            : 0.0
          : NaN;

        generation.end({
          output: rawContent,
          usage: {
            promptTokens: tokensIn,
            completionTokens: tokensOut,
            totalTokens: tokensIn + tokensOut,
          },
        });

        // Console feedback
        console.log(
          `  raw:    ${rawContent.slice(0, 80).replace(/\n/g, ' ')}...`
        );
        console.log(
          `  spoken: ${spokenText.slice(0, 80).replace(/\n/g, ' ')}...`
        );
        console.log(
          `  ${latencyMs.toFixed(0)}ms | ${tokensOut} tok | ${tokensPerSec.toFixed(1)} tok/s | ` +
            `correct=${Number.isNaN(correct) ? 'n/a' : correct} concise=${conciseness.toFixed(2)} ` +
            `dual=${dualOutput} tts=${ttsFriendly} norep=${noRepetition.toFixed(2)}\n`
        );

        // Langfuse scores
        const scores: Record<string, number> = {
          latency_ms: latencyMs,
          tokens_used: tokensOut,
          tokens_per_sec: tokensPerSec,
          is_concise: conciseness,
          dual_output_score: dualOutput,
          tts_friendly_score: ttsFriendly,
          no_repetition_score: noRepetition,
        };
        if (!Number.isNaN(correct)) scores.is_correct = correct;
        for (const [name, value] of Object.entries(scores))
          trace.score({ name, value });

        rows.push({
          prompt: testCase.prompt,
          ok: true,
          correct,
          latency_ms: latencyMs,
          tokens_out: tokensOut,
          tokens_per_sec: tokensPerSec,
          conciseness,
          dual_output: dualOutput,
          tts_friendly: ttsFriendly,
          no_repetition: noRepetition,
        });
      } catch (err) {
        const wallLatency = Date.now() - startTime;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  ERROR: ${message}\n`);

        generation.end({ output: `ERROR: ${message}` });
        trace.score({ name: 'request_error', value: 1 });

        rows.push({
          prompt: testCase.prompt,
          ok: false,
          correct: NaN,
          latency_ms: wallLatency,
          tokens_out: 0,
          tokens_per_sec: 0,
          conciseness: 0,
          dual_output: 0,
          tts_friendly: 0,
          no_repetition: 0,
        });
      }
    }
  }

  printSummary(rows);

  // Ensure all background requests to Langfuse complete before exiting.
  await langfuse.flushAsync();
  console.log('\nEvaluations complete and flushed to Langfuse.');
}

/** Print averages + pass rates across all rows. */
function printSummary(rows: RowResult[]) {
  const ok = rows.filter((r) => r.ok);
  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  const rate = (xs: number[]) =>
    xs.length ? `${(avg(xs) * 100).toFixed(0)}%` : 'n/a';
  const scored = ok.filter((r) => !Number.isNaN(r.correct));

  console.log('\n──────── Summary ────────');
  console.log(
    `cases run:        ${rows.length}  (ok: ${ok.length}, errored: ${rows.length - ok.length})`
  );
  if (scored.length)
    console.log(`correctness:      ${rate(scored.map((r) => r.correct))}`);
  console.log(
    `avg latency:      ${avg(ok.map((r) => r.latency_ms)).toFixed(0)} ms`
  );
  console.log(
    `avg throughput:   ${avg(ok.map((r) => r.tokens_per_sec)).toFixed(1)} tok/s`
  );
  console.log(
    `avg conciseness:  ${avg(ok.map((r) => r.conciseness)).toFixed(2)}`
  );
  console.log(`dual-output pass: ${rate(ok.map((r) => r.dual_output))}`);
  console.log(`tts-friendly:     ${rate(ok.map((r) => r.tts_friendly))}`);
  console.log(
    `no-repetition:    ${avg(ok.map((r) => r.no_repetition)).toFixed(2)}`
  );
  console.log('─────────────────────────');
}

runEvals().catch(console.error);
