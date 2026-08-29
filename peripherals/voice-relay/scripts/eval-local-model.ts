/**
 * @file eval-local-model.ts
 * @desc Evaluates the performance (latency, conciseness, token usage) of the local Ollama backend.
 * Integrates with Langfuse to trace and score LLM generations.
 */

import { Langfuse } from 'langfuse';
import { LocalOllamaBackend } from '../src/backends.js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Resolve the directory path of the current module to locate the .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from the voice-relay peripheral directory
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * Initialize the Langfuse client for observability and tracing.
 * Relies on environment variables for authentication and routing.
 */
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com'
});

/**
 * @desc Configuration defining the test cases to evaluate against the local model.
 */
const evalConfig = [
  { prompt: "How many weeks are in a year?" },
  { prompt: "Explain polymorphism in 1 sentence." },
  { prompt: "What is 2 + 2?" }
];

/**
 * @desc Main evaluation function. Runs test prompts against the local model,
 * tracks latency, calculates conciseness, and logs traces to Langfuse.
 */
async function runEvals() {
  // Instantiate the local backend for querying Ollama
  const backend = new LocalOllamaBackend();
  const cwd = process.cwd();

  console.log("Starting evaluations for LocalOllamaBackend...");

  for (const testCase of evalConfig) {
    console.log(`\nTesting prompt: "${testCase.prompt}"`);
    
    // Create a new trace in Langfuse for this specific test case execution
    const trace = langfuse.trace({
      name: "voice-relay-eval",
      sessionId: "eval-session",
      metadata: {
        backend: backend.label
      }
    });

    const startTime = Date.now();
    
    // Log the generation start to Langfuse
    const generation = trace.generation({
      name: "local-ollama-generation",
      model: process.env.OLLAMA_MODEL || "qwen3:14b",
      input: testCase.prompt
    });

    // Execute the actual LLM prompt via the LocalOllamaBackend
    const result = await backend.ask({
      prompt: testCase.prompt,
      cwd: cwd,
      requestId: trace.id,
    });

    // Calculate latency and roughly estimate token usage by splitting words
    const latency_ms = Date.now() - startTime;
    const tokens_used = result.text.split(/\s+/).length; // Rough estimate for words/tokens

    // Log the completion output and token usage back to the Langfuse generation trace
    generation.end({
      output: result.text,
      usage: {
        totalTokens: tokens_used // Rough
      }
    });

    // Provide immediate console feedback for local debugging
    console.log(`Response: ${result.text.slice(0, 100).replace(/\n/g, ' ')}...`);
    console.log(`Latency: ${latency_ms}ms, Approx Words: ${tokens_used}`);

    // Calculate Conciseness Score (0.0 to 1.0)
    // - Less than 20 words gets a perfect score (1.0).
    // - Score degrades linearly; responses over 100 words hit 0.0.
    let conciseness = 1.0;
    if (tokens_used > 20) {
      conciseness = Math.max(0, 1.0 - ((tokens_used - 20) / 80));
    }

    // Append latency, token usage, and conciseness scores to the current Langfuse trace
    trace.score({
      name: "latency_ms",
      value: latency_ms
    });

    trace.score({
      name: "tokens_used",
      value: tokens_used
    });

    trace.score({
      name: "is_concise",
      value: conciseness
    });
  }

  // Ensure all background network requests to Langfuse are completed before exiting
  await langfuse.flushAsync();
  console.log("\nEvaluations complete and flushed to Langfuse.");
}

// Execute the evaluation suite and catch any unhandled top-level errors
runEvals().catch(console.error);
