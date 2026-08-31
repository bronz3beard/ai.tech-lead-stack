import { skillsService } from '@/lib/skills';
import { CodeProvider } from '@/lib/skills/providers/base-provider';
import { User } from '@prisma/client';
import { jsonSchema, tool } from 'ai';
import { createModel } from '@/lib/ai/model-registry';
import { keyFor, slotForModel } from '@/lib/ai/model-resolver';
import { MODELS } from './constants';
import { FigmaService } from '@/lib/figma-api';
import { ClickUpService } from '@/lib/clickup-api';

/**
 * Strictly extracts a string message from an unknown error object.
 * Handles nested JSON structures common in AI provider responses,
 * specifically targeting the .data, .response, and .error fields.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  const anyErr = error as any;
  let fallback = '';
  if (typeof anyErr === 'object' && anyErr !== null) {
    try {
      fallback = JSON.stringify(anyErr);
    } catch {
      fallback = String(anyErr);
    }
  } else {
    fallback = String(anyErr);
  }

  const message =
    anyErr?.error?.message ||
    anyErr?.message ||
    anyErr?.data?.error?.message ||
    anyErr?.response?.data?.error?.message ||
    fallback;

  return message;
}

/**
 * Extracts plain text from AI SDK content structures, handling both raw strings
 * and arrays of ContentPart objects.
 */
export function extractTextFromContent(
  content: string | any[] | undefined | null
): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((p: any) => p.type === 'text' && p.text)
      .map((p: any) => p.text)
      .join('\n\n');
  }
  return '';
}

/**
 * Robustly detects if an error is a Gemini/AI quota or rate-limit error.
 * Uses aggressive recursive scanning to catch keywords in any property.
 */
export function isQuotaError(err: any): boolean {
  if (!err) return false;

  // 1. Direct check on status/code properties
  const status = Number(
    err.status || err.statusCode || err.code || err.error_code
  );
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
  let raw = '';
  try {
    raw =
      typeof err === 'object'
        ? JSON.stringify(err).toLowerCase()
        : String(err).toLowerCase();
  } catch {
    // If stringification fails (e.g., circular structure), fall back to String()
    raw = String(err).toLowerCase();
  }

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

  return keywords.some((k) => msg.includes(k) || raw.includes(k));
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
 * Reads Jules API keys from the environment.
 */
export function readJulesKeysFromEnv(): string | undefined {
  const jules = process.env.JULES_API_KEY?.trim();
  if (jules) return jules;
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

  const mask = (k: string) =>
    `${k.substring(0, 4)}...${k.substring(k.length - 2)}`;

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

/**
 * Resolves the Jules API keys available: user DB and environment.
 * @returns Array of available keys [preferred, fallback]
 */
export function resolveJulesApiKeys(
  user: Pick<User, 'julesApiKey'>,
  decrypt: (ciphertext: string) => string
): string[] {
  const envKey = readJulesKeysFromEnv();
  const stored = user.julesApiKey?.trim();
  let dbKey: string | null = null;

  if (stored) {
    const key = decrypt(stored).trim();
    if (key) dbKey = key;
  }

  // Jules doesn't use the GEMINI precedence env var, we just prefer DB then Env
  const keys: string[] = [];
  if (dbKey) keys.push(dbKey);
  if (envKey && !keys.includes(envKey)) keys.push(envKey);

  if (keys.length === 0) {
    throw new Error(
      'No Jules API key configured. Add one in Settings, or set JULES_API_KEY in your .env file.'
    );
  }

  return keys;
}

/**
 * Factory for initializing the AI model based on user preference and API keys.
 * Supports fallback rotation via modelId and keyIndex.
 */
export async function initializeModel(
  user: User,
  modelId?: string,
  keyIndex = 0
) {
  const preferredModel = user.preferredModel ?? 'gemini';
  const { decrypt } = await import('@/lib/crypto');

  const decryptKey = (key: string, name: string) => {
    try {
      return decrypt(key.trim()).trim();
    } catch (err) {
      console.error(`Failed to decrypt ${name} key:`, err);
      throw new Error(
        `Authentication Error: Failed to decrypt your ${name} API key. This usually happens if the ENCRYPTION_KEY in your .env has changed. Please go to Settings and re-save your API key.`
      );
    }
  };

  // Determine the default model ID if none is explicitly provided.
  let resolvedModelId = modelId;
  if (!resolvedModelId) {
    if (preferredModel === 'claude') resolvedModelId = MODELS.CLAUDE;
    else if (preferredModel === 'openai') resolvedModelId = MODELS.OPENAI;
    else if (preferredModel === 'jules') resolvedModelId = MODELS.JULES;
    else resolvedModelId = MODELS.GEMINI;
  }

  // Use the model-resolver to determine the correct key slot and fetch the key.
  // We mock a ctx object providing the user row and a decrypt implementation
  // that wraps our friendly decryptKey error handler.
  const slot = slotForModel(resolvedModelId);
  
  let key: string;
  try {
    // We pass our specific decryptKey that provides friendly auth errors
    key = keyFor(slot, { user, decrypt: (c) => decryptKey(c, slot) });
  } catch (err: any) {
    // If it's a specific key rotation request for Gemini/Jules (keyIndex > 0),
    // we need to handle that via resolveGeminiApiKeys/resolveJulesApiKeys
    // because keyFor only returns the *preferred* single key for a slot.
    // We preserve that fallback logic here for keyIndex > 0 only.
    if (keyIndex > 0) {
      if (preferredModel === 'jules' || slot === 'jules') {
        const julesKeys = resolveJulesApiKeys(user, decrypt);
        key = julesKeys[keyIndex] || julesKeys[0];
        if (!key) throw new Error('Resolved Jules API key was empty.');
      } else if (preferredModel === 'gemini' || slot === 'gemini') {
        const geminiKeys = resolveGeminiApiKeys(user, decrypt);
        key = geminiKeys[keyIndex] || geminiKeys[0];
        if (!key) throw new Error('Resolved Gemini API key was empty.');
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  return createModel(resolvedModelId, key);
}

/**
 * Defines the toolset available to the AI agent during analytical and streaming turns.
 */
export function getChatTools(provider: CodeProvider = skillsService, integrations: { figmaApiKey?: string; clickupToken?: string } = {}) {
  return {
    list_skills: tool({
      description: 'Lists all available skills and workflows.',
      inputSchema: jsonSchema<Record<string, never>>({
        type: 'object',
        properties: {},
      }),
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
    }),
    get_skill: tool({
      description: 'Reads the specific content of a skill or workflow.',
      inputSchema: jsonSchema<{
        name?: string;
        skillName?: string;
        skill_id?: string;
        type?: 'skill' | 'workflow';
      }>({
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Skill/Workflow name' },
          skillName: {
            type: 'string',
            description: 'Skill/Workflow name (alias)',
          },
          skill_id: {
            type: 'string',
            description: 'Skill/Workflow name (alias 2)',
          },
          type: {
            type: 'string',
            enum: ['skill', 'workflow'],
            description: 'Asset type',
            default: 'skill',
          },
        },
      }),
      execute: async (args: {
        name?: string;
        skillName?: string;
        skill_id?: string;
        type?: 'skill' | 'workflow';
      }) => {
        const name = args.name || args.skillName || args.skill_id;
        const type = args.type || 'skill';

        if (!name)
          return {
            error:
              'Missing skill name parameter (expected name, skillName, or skill_id)',
          };

        try {
          // Strip extension if provided by model
          const safeName = name.replace(/\.md$/, '');
          const result = await provider.readSkill(safeName, type);

          if (!result)
            return { error: `Skill or workflow '${name}' not found.` };
          return { content: result.content };
        } catch (e: unknown) {
          return { error: `Lookup failed for ${name}: ${getErrorMessage(e)}` };
        }
      },
    }),
    read_file: tool({
      description: 'Reads a file from the project for analysis.',
      inputSchema: jsonSchema<{ path?: string; filepath?: string }>({
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to the file' },
          filepath: {
            type: 'string',
            description: 'Relative path to the file (alias)',
          },
        },
      }),
      execute: async (args: { path?: string; filepath?: string }) => {
        const filePath = args.path || args.filepath;
        if (!filePath)
          return {
            error: 'Missing file path parameter (expected path or filepath)',
          };

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
    }),
    get_clickup_task: tool({
      description: 'Fetch a ClickUp task by its URL or task id. Call this whenever the user provides a ClickUp link or task id, so you can read the real title, description, and acceptance criteria.',
      inputSchema: jsonSchema<{ taskUrlOrId: string }>({
        type: 'object',
        properties: { taskUrlOrId: { type: 'string' } },
        required: ['taskUrlOrId'],
      }),
      execute: async (args: { taskUrlOrId: string }) => {
        if (!integrations.clickupToken) {
          return { error: 'No ClickUp API Key configured for this project. Add one in the Project Integrations settings.' };
        }
        try {
          const id = ClickUpService.parseTaskId(args.taskUrlOrId);
          const clickup = new ClickUpService(integrations.clickupToken);
          const task = await clickup.getTask(id);
          return task;
        } catch (e: unknown) {
          return { error: getErrorMessage(e) };
        }
      },
    }),
    get_figma_design: tool({
      description: "Fetch a Figma file's metadata (and top-level frames/comments) by its URL or file key, for design context.",
      inputSchema: jsonSchema<{ figmaUrlOrKey: string }>({
        type: 'object',
        properties: { figmaUrlOrKey: { type: 'string' } },
        required: ['figmaUrlOrKey'],
      }),
      execute: async (args: { figmaUrlOrKey: string }) => {
        if (!integrations.figmaApiKey) {
          return { error: 'No Figma API key configured for this project.' };
        }
        try {
          const m = args.figmaUrlOrKey.match(/(?:file|design)\/([A-Za-z0-9]+)/);
          const fileKey = m ? m[1] : args.figmaUrlOrKey;
          const figma = new FigmaService(integrations.figmaApiKey);
          
          const file = await figma.getFile(fileKey);
          
          let pages: string[] = [];
          if (file.document && Array.isArray(file.document.children)) {
            pages = file.document.children.map((child: any) => child.name);
          }
          
          let commentsList: any[] = [];
          try {
            const commentsData = await figma.getComments(fileKey);
            commentsList = (commentsData.comments || []).slice(0, 20);
          } catch (commentErr) {
            console.warn('Failed to fetch figma comments', commentErr);
          }
          
          return {
            name: file.name,
            lastModified: file.lastModified,
            thumbnailUrl: file.thumbnailUrl,
            version: file.version,
            pages,
            comments: commentsList,
          };
        } catch (e: unknown) {
          return { error: getErrorMessage(e) };
        }
      },
    }),
  };
}
