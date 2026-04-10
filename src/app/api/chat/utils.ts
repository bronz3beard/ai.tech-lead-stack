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
 * Factory for initializing the AI model based on user preference and API keys.
 */
export async function initializeModel(user: User) {
  const preferredModel = user.preferredModel ?? 'gemini';
  const { decrypt } = await import('@/lib/crypto');

  if (preferredModel === 'claude' && user.claudeApiKey) {
    const anthropic = createAnthropic({ apiKey: decrypt(user.claudeApiKey) });
    return anthropic(MODELS.CLAUDE);
  }

  if (preferredModel === 'openai' && user.openaiApiKey) {
    const openai = createOpenAI({ apiKey: decrypt(user.openaiApiKey) });
    return openai(MODELS.OPENAI);
  }

  const geminiKey = user.geminiApiKey
    ? decrypt(user.geminiApiKey)
    : getEnvVar('GEMINI_API_KEY');

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
    }),
    get_skill: tool({
      description: 'Reads the specific content of a skill or workflow.',
      parameters: z.object({
        name: z
          .string()
          .describe('The name of the skill or workflow file (without .md)'),
        type: z.enum(['skill', 'workflow']).default('skill'),
      }),
      execute: async ({ name, type }) => {
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
    }),
    read_file: tool({
      description: 'Reads a file from the project for analysis.',
      parameters: z.object({
        path: z
          .string()
          .describe('The relative path to the file from the project root'),
      }),
      execute: async ({ path: filePath }) => {
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
    }),
  };
}
