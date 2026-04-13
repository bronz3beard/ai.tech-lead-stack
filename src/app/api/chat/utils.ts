import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { User } from '@prisma/client';
import { tool } from 'ai';
import * as fs from 'fs/promises';
import * as nodePath from 'path';
import { z } from 'zod';
import { MODELS } from './constants';

/**
 * Strictly extracts a string message from an unknown error object.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Strictly fetches an environment variable or throws a descriptive error.
 */
export function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `CRITICAL: Missing required environment variable '${name}'`
    );
  }
  return value;
}

/**
 * Reads a workflow definition from the filesystem.
 */
export async function readWorkflow(workflowName: string) {
  try {
    const repoRoot = process.cwd();
    const workflowPath = nodePath.join(
      repoRoot,
      '.agents',
      'workflows',
      `${workflowName}.md`
    );
    const content = await fs.readFile(workflowPath, 'utf-8');
    return content;
  } catch (err: unknown) {
    console.error(
      `Workflow read error for ${workflowName}:`,
      getErrorMessage(err)
    );
    return null;
  }
}

/**
 * Reads Gemini-compatible API keys from the environment.
 * Matches @ai-sdk/google, which falls back to GOOGLE_GENERATIVE_AI_API_KEY when apiKey is omitted.
 *
 * @returns First non-empty value from GEMINI_API_KEY then GOOGLE_GENERATIVE_AI_API_KEY
 */
export function readGeminiKeysFromEnv(): string | undefined {
  const gemini = process.env.GEMINI_API_KEY?.trim();
  if (gemini) return gemini;
  const google = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (google) return google;
  return undefined;
}

/**
 * Whether to prefer server env keys over the user row (self-hosted: paid key in .env, stale free key in DB).
 * Set GEMINI_API_KEY_PRECEDENCE=env to use GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY first.
 */
function getGeminiKeyPrecedence(): 'user' | 'env' {
  const raw = process.env.GEMINI_API_KEY_PRECEDENCE?.trim().toLowerCase();
  return raw === 'env' ? 'env' : 'user';
}

/**
 * Resolves the Gemini API key for chat: user DB vs environment, with explicit precedence rules.
 * Trims whitespace so pasted keys remain valid.
 *
 * Default precedence is **user** (saved key wins). If you store an old free-tier key in the DB but
 * put a billing-enabled key only in `.env`, requests still use the DB key until you delete it or
 * set GEMINI_API_KEY_PRECEDENCE=env.
 *
 * @param user - Prisma user row (may include geminiApiKey)
 * @param decrypt - decrypt() from @/lib/crypto
 * @returns The API key string to pass to the Google provider
 * @throws If no usable key exists
 */
export function resolveGeminiApiKey(
  user: Pick<User, 'geminiApiKey'>,
  decrypt: (ciphertext: string) => string
): string {
  const envKey = readGeminiKeysFromEnv();
  const stored = user.geminiApiKey?.trim();
  let dbKey: string | null = null;
  if (stored) {
    const key = decrypt(stored).trim();
    if (!key) {
      throw new Error(
        'Your saved Gemini API key is empty after decryption. Delete it in Settings and save it again.'
      );
    }
    dbKey = key;
  }

  const precedence = getGeminiKeyPrecedence();

  if (precedence === 'env') {
    if (envKey) {
      if (process.env.NODE_ENV === 'development') {
        console.info(
          '[chat] Gemini: using environment key (GEMINI_API_KEY_PRECEDENCE=env; DB key ignored if both set)'
        );
      }
      return envKey;
    }
    if (dbKey) {
      if (process.env.NODE_ENV === 'development') {
        console.info(
          '[chat] Gemini: env precedence set but no GEMINI_API_KEY/GOOGLE_GENERATIVE_AI_API_KEY; using user-stored key'
        );
      }
      return dbKey;
    }
  } else {
    if (dbKey) {
      if (process.env.NODE_ENV === 'development') {
        console.info(
          '[chat] Gemini: using user-stored API key (set GEMINI_API_KEY_PRECEDENCE=env to prefer .env instead)'
        );
      }
      return dbKey;
    }
    if (envKey) {
      if (process.env.NODE_ENV === 'development') {
        console.info(
          '[chat] Gemini: using GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY from environment'
        );
      }
      return envKey;
    }
  }

  throw new Error(
    'No Gemini API key configured. Add one in Settings, or set GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.'
  );
}

/**
 * Factory for initializing the AI model based on user preference and API keys.
 */
export async function initializeModel(user: User) {
  const preferredModel = user.preferredModel ?? 'gemini';
  const { decrypt } = await import('@/lib/crypto');

  if (preferredModel === 'claude') {
    if (!user.claudeApiKey?.trim()) {
      throw new Error(
        'Claude is set as the default model, but no Claude API key is saved. Open Settings to add your key, or switch the default model to Gemini or OpenAI.'
      );
    }
    const anthropic = createAnthropic({
      apiKey: decrypt(user.claudeApiKey.trim()).trim(),
    });
    return anthropic(MODELS.CLAUDE);
  }

  if (preferredModel === 'openai') {
    if (!user.openaiApiKey?.trim()) {
      throw new Error(
        'OpenAI is set as the default model, but no OpenAI API key is saved. Open Settings to add your key, or switch the default model.'
      );
    }
    const openai = createOpenAI({
      apiKey: decrypt(user.openaiApiKey.trim()).trim(),
    });
    return openai(MODELS.OPENAI);
  }

  const geminiKey = resolveGeminiApiKey(user, decrypt);
  // Never pass an empty string: @ai-sdk/google loadApiKey treats "" as valid and sends a broken key.
  if (!geminiKey) {
    throw new Error('Resolved Gemini API key was empty.');
  }
  const google = createGoogleGenerativeAI({ apiKey: geminiKey });
  return google(MODELS.GEMINI);
}

/**
 * Defines the toolset available to the AI agent during analytical and streaming turns.
 */
export function getChatTools() {
  return {
    list_skills: tool({
      description: 'Lists all available skills and workflows.',
      parameters: z.object({}),
      execute: async () => {
        const skillsDir = nodePath.join(process.cwd(), '.ai', 'skills');
        const workflowsDir = nodePath.join(
          process.cwd(),
          '.agents',
          'workflows'
        );
        try {
          const [skills, workflows] = await Promise.all([
            fs.readdir(skillsDir).catch(() => []),
            fs.readdir(workflowsDir).catch(() => []),
          ]);
          return { skills, workflows };
        } catch (e: unknown) {
          return { error: `Skills discovery failed: ${getErrorMessage(e)}` };
        }
      },
    } as any),
    get_skill: tool({
      description: 'Reads the specific content of a skill or workflow.',
      parameters: z.object({
        name: z
          .string()
          .describe('The name of the skill or workflow file (without .md)'),
        type: z.enum(['skill', 'workflow']).default('skill'),
      }),
      execute: async ({ name, type }: { name: string; type: 'skill' | 'workflow' }) => {
        const baseDir =
          type === 'skill'
            ? nodePath.join(process.cwd(), '.ai', 'skills')
            : nodePath.join(process.cwd(), '.agents', 'workflows');
        try {
          const content = await fs.readFile(
            nodePath.join(baseDir, `${name}.md`),
            'utf-8'
          );
          return { content };
        } catch (e: unknown) {
          return { error: `Lookup failed for ${name}: ${getErrorMessage(e)}` };
        }
      },
    } as any),
    read_file: tool({
      description: 'Reads a file from the project for analysis.',
      parameters: z.object({
        path: z
          .string()
          .describe('The relative path to the file from the project root'),
      }),
      execute: async ({ path: filePath }: { path: string }) => {
        try {
          const content = await fs.readFile(
            nodePath.join(process.cwd(), filePath),
            'utf-8'
          );
          return { content };
        } catch (e: unknown) {
          return {
            error: `Read failed for ${filePath}: ${getErrorMessage(e)}`,
          };
        }
      },
    } as any),
  };
}
