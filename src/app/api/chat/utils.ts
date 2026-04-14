import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { User } from '@prisma/client';
import { tool } from 'ai';
import { z } from 'zod';
import { MODELS } from './constants';
import { skillsService } from '@/lib/skills';
import { CodeProvider } from '@/lib/skills/providers/base-provider';

/**
 * Strictly extracts a string message from an unknown error object.
 * Handles nested JSON structures common in AI provider responses,
 * specifically targeting the .data, .response, and .error fields.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  const anyErr = error as any;
  const message =
    anyErr?.error?.message ||
    anyErr?.message ||
    anyErr?.data?.error?.message ||
    anyErr?.response?.data?.error?.message ||
    (typeof anyErr === 'object' ? JSON.stringify(anyErr) : String(anyErr));

  return message;
}

/**
 * Robustly detects if an error is a Gemini/AI quota or rate-limit error.
 * Uses aggressive recursive scanning to catch keywords in any property.
 */
export function isQuotaError(err: any): boolean {
  if (!err) return false;

  // 1. Direct check on status/code properties
  const status = Number(err.status || err.statusCode || err.code || err.error_code);
  if (status === 429) return true;

  // 2. String mapping check for common Resource Exhausted codes
  const stringCode = String(err.code || err.status || '').toUpperCase();
  if (
    stringCode === 'RESOURCE_EXHAUSTED' ||
    stringCode === 'RATE_LIMIT_EXCEEDED' ||
    stringCode === 'FORBIDDEN' || // Sometimes used for tier limits
    err.reason === 'resource_exhausted' ||
    err.reason === 'RATE_LIMIT_EXCEEDED'
  ) {
    return true;
  }

  // 3. Deep heuristic check via stringification
  // This catches cases where the error is wrapped or the detail is deep
  const msg = getErrorMessage(err).toLowerCase();
  const raw = typeof err === 'object' ? JSON.stringify(err).toLowerCase() : String(err).toLowerCase();

  const keywords = [
    '429',
    'quota',
    'limit',
    'exceeded',
    'rate_limit',
    'rate limit',
    'resource_exhausted',
    'resource exhausted',
    'too many requests',
  ];

  return keywords.some(k => msg.includes(k) || raw.includes(k));
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
    const result = await skillsService.readSkill(workflowName, 'workflow');
    return result?.content ?? null;
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
 * Resolves the Gemini API keys available: user DB and environment.
 * @returns Array of available keys [preferred, fallback]
 */
export function resolveGeminiApiKeys(
  user: Pick<User, 'geminiApiKey'>,
  decrypt: (ciphertext: string) => string
): string[] {
  const envKey = readGeminiKeysFromEnv();
  const stored = user.geminiApiKey?.trim();
  let dbKey: string | null = null;

  if (stored) {
    const key = decrypt(stored).trim();
    if (key) dbKey = key;
  }

  const precedence = getGeminiKeyPrecedence();
  const keys: string[] = [];

  const mask = (k: string) => `${k.substring(0, 4)}...${k.substring(k.length - 2)}`;

  if (precedence === 'env') {
    if (envKey) keys.push(envKey);
    if (dbKey) keys.push(dbKey);
  } else {
    if (dbKey) keys.push(dbKey);
    if (envKey) keys.push(envKey);
  }

  if (process.env.NODE_ENV === 'development' && keys.length > 0) {
    console.info(
      `[chat] Gemini: Found ${keys.length} key(s). Preferred: ${mask(keys[0])}`
    );
  }

  if (keys.length === 0) {
    throw new Error(
      'No Gemini API key configured. Add one in Settings, or set GEMINI_API_KEY in your .env file.'
    );
  }

  return keys;
}

// Deprecated alias for backward compatibility if needed, but we should update callers.
export function resolveGeminiApiKey(
  user: Pick<User, 'geminiApiKey'>,
  decrypt: (ciphertext: string) => string
): string {
  return resolveGeminiApiKeys(user, decrypt)[0];
}

/**
 * Factory for initializing the AI model based on user preference and API keys.
 * Supports fallback rotation via modelId and keyIndex.
 */
export async function initializeModel(user: User, modelId?: string, keyIndex = 0) {
  const preferredModel = user.preferredModel ?? 'gemini';
  const { decrypt } = await import('@/lib/crypto');

  if (preferredModel === 'claude') {
    if (!user.claudeApiKey?.trim()) {
      throw new Error(
        'Claude is set as the default model, but no Claude API key is saved.'
      );
    }
    const anthropic = createAnthropic({
      apiKey: decrypt(user.claudeApiKey.trim()).trim(),
    });
    return anthropic(modelId ?? MODELS.CLAUDE);
  }

  if (preferredModel === 'openai') {
    if (!user.openaiApiKey?.trim()) {
      throw new Error(
        'OpenAI is set as the default model, but no OpenAI API key is saved.'
      );
    }
    const openai = createOpenAI({
      apiKey: decrypt(user.openaiApiKey.trim()).trim(),
    });
    return openai(modelId ?? MODELS.OPENAI);
  }

  // Gemini specific logic with key rotation
  const geminiKeys = resolveGeminiApiKeys(user, decrypt);
  const targetKey = geminiKeys[keyIndex] || geminiKeys[0];

  if (!targetKey) {
    throw new Error('Resolved Gemini API key was empty.');
  }

  const google = createGoogleGenerativeAI({ apiKey: targetKey });
  return google(modelId ?? MODELS.GEMINI);
}

/**
 * Defines the toolset available to the AI agent during analytical and streaming turns.
 */
export function getChatTools(provider: CodeProvider = skillsService) {
  return {
    list_skills: tool({
      description: 'Lists all available skills and workflows.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const skillsMap = await provider.getDynamicSkills();
          const skills: string[] = [];
          const workflows: string[] = [];

          skillsMap.forEach((meta, name) => {
            if (meta.type === 'skill') skills.push(`${name}.md`);
            else workflows.push(`${name}.md`);
          });

          return { skills, workflows };
        } catch (e: unknown) {
          return { error: `Skills discovery failed: ${getErrorMessage(e)}` };
        }
      },
    } as any),
    get_skill: tool({
      description: 'Reads the specific content of a skill or workflow.',
      parameters: z.object({
        name: z.string().optional().describe('Skill/Workflow name'),
        skillName: z.string().optional().describe('Skill/Workflow name (alias)'),
        skill_id: z.string().optional().describe('Skill/Workflow name (alias 2)'),
        type: z.enum(['skill', 'workflow']).default('skill'),
      }),
      execute: async (args: any) => {
        const name = args.name || args.skillName || args.skill_id;
        const type = args.type || 'skill';
        
        if (!name) return { error: 'Missing skill name parameter (expected name, skillName, or skill_id)' };

        try {
          // Strip extension if provided by model
          const safeName = name.replace(/\.md$/, '');
          const result = await provider.readSkill(safeName, type);
          
          if (!result) return { error: `Skill or workflow '${name}' not found.` };
          return { content: result.content };
        } catch (e: unknown) {
          return { error: `Lookup failed for ${name}: ${getErrorMessage(e)}` };
        }
      },
    } as any),
    read_file: tool({
      description: 'Reads a file from the project for analysis.',
      parameters: z.object({
        path: z.string().optional().describe('Relative path to the file'),
        filepath: z.string().optional().describe('Relative path to the file (alias)'),
      }),
      execute: async (args: any) => {
        const filePath = args.path || args.filepath;
        if (!filePath) return { error: 'Missing file path parameter (expected path or filepath)' };

        try {
          const content = await provider.readFile(filePath);
          return { content };
        } catch (e: unknown) {
          const msg = getErrorMessage(e).toLowerCase();
          // Distinguish between "file does not exist" and a real access/permission failure.
          // GitHub 404s and ENOENT both indicate the file simply isn't present at that path.
          const isNotFound =
            msg.includes('404') ||
            msg.includes('not found') ||
            msg.includes('enoent') ||
            msg.includes('no such file') ||
            msg.includes('directory not found');

          return {
            error: isNotFound
              ? `File not found: ${filePath}`
              : `Access error for ${filePath}: ${getErrorMessage(e)}`,
          };
        }
      },
    } as any),
  };
}
