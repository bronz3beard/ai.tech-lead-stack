import { z } from 'zod';
import { tool } from 'ai';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';

const execFileAsync = promisify(execFile);

/**
 * @desc Factory that creates agent tools with access to the current skill
 * content from the editor. This avoids the LLM needing to re-send the
 * entire skill content as a tool argument — tools that need it can fall
 * back to the `currentContent` from the request body.
 *
 * @param currentContent - The current skill markdown content from the editor
 * @returns AI SDK tool definitions for skill analysis, linting, and editing
 */
export function createAgentTools(currentContent: string) {
  return {
    lint_and_format: tool({
      description:
        'Runs prettier and markdownlint to automatically format the skill content and fix lint issues. If no content argument is provided, it uses the current editor content.',
      parameters: z.object({
        content: z
          .string()
          .optional()
          .describe(
            'The markdown content to format. Defaults to the current editor content if omitted.'
          ),
      }),
      execute: async (args: any) => {
        const content = args.content ?? currentContent;
        if (!content) {
          return {
            success: false,
            error: 'No content available to format.',
          };
        }

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-lint-'));
        const tempFile = path.join(tempDir, 'temp-skill.md');
        try {
          await fs.writeFile(tempFile, content, 'utf-8');

          // Format with Prettier
          await execFileAsync('npx', ['prettier', '--write', tempFile]);

          // Run markdownlint --fix
          try {
            await execFileAsync('npx', ['markdownlint-cli', '--fix', tempFile]);
          } catch (lintErr: unknown) {
            // markdownlint exits non-zero on unfixable warnings — that's okay
            const errObj = lintErr as { stderr?: string };
            if (errObj.stderr && !errObj.stderr.includes('Error')) {
              // Non-fatal lint warnings, continue
            }
          }

          // Run Prettier again in case markdownlint changed formatting
          await execFileAsync('npx', ['prettier', '--write', tempFile]);

          const formattedContent = await fs.readFile(tempFile, 'utf-8');
          return { success: true, formattedContent };
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          return { success: false, error: message };
        } finally {
          try {
            await fs.rm(tempDir, { recursive: true, force: true });
          } catch (_) {
            /* cleanup best-effort */
          }
        }
      },
    } as any),

    validate_ethos: tool({
      description:
        'Validates the skill content against the Tech-Lead Stack ethos (G-stack, MinimumCD) by running validation scripts. If no content argument is provided, it uses the current editor content.',
      parameters: z.object({
        content: z
          .string()
          .optional()
          .describe(
            'The markdown content to validate. Defaults to the current editor content if omitted.'
          ),
      }),
      execute: async (args: any) => {
        const content = args.content ?? currentContent;
        if (!content) {
          return {
            success: false,
            error: 'No content available to validate.',
          };
        }

        const tempDir = await fs.mkdtemp(
          path.join(os.tmpdir(), 'skill-validate-')
        );
        const tempFile = path.join(tempDir, 'temp-skill.md');
        try {
          await fs.writeFile(tempFile, content, 'utf-8');
          const scriptPath = path.join(
            process.cwd(),
            'scripts',
            'validate-skills.sh'
          );
          const { stdout, stderr } = await execFileAsync('bash', [
            scriptPath,
            tempFile,
          ]);
          return {
            success: true,
            output: stdout || stderr || 'Validation successful',
          };
        } catch (error: unknown) {
          const errObj = error as {
            stdout?: string;
            stderr?: string;
            message?: string;
          };
          return {
            success: false,
            error:
              errObj.stdout ||
              errObj.stderr ||
              errObj.message ||
              'Validation failed',
          };
        } finally {
          try {
            await fs.rm(tempDir, { recursive: true, force: true });
          } catch (_) {
            /* cleanup best-effort */
          }
        }
      },
    } as any),

    get_stylistic_examples: tool({
      description:
        'Fetches 2-3 random files from .ai/skills/ to use as reference for tone and formatting.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const skillsDir = path.join(process.cwd(), '.ai', 'skills');
          const files = await fs.readdir(skillsDir);
          const mdFiles = files.filter((f) => f.endsWith('.md'));

          // Shuffle and pick 2
          const shuffled = mdFiles.sort(() => 0.5 - Math.random());
          const selected = shuffled.slice(0, 2);

          const examples = await Promise.all(
            selected.map(async (file) => {
              const fileContent = await fs.readFile(
                path.join(skillsDir, file),
                'utf-8'
              );
              return { filename: file, content: fileContent };
            })
          );

          return { success: true, examples };
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          return { success: false, error: message };
        }
      },
    } as any),

    check_schema: tool({
      description:
        'Validates the frontmatter against the SKILL_TEMPLATE.md structure. If no content argument is provided, it uses the current editor content.',
      parameters: z.object({
        content: z
          .string()
          .optional()
          .describe(
            'The markdown content containing the frontmatter to validate. Defaults to the current editor content if omitted.'
          ),
      }),
      execute: async (args: any) => {
        const content = args.content ?? currentContent;
        if (!content) {
          return {
            success: false,
            error: 'No content available to validate schema.',
          };
        }

        try {
          const parsed = matter(content);
          const data = parsed.data;
          const errors: string[] = [];

          if (!data.name) errors.push("Missing 'name' in frontmatter");
          if (!data.description)
            errors.push("Missing 'description' in frontmatter");
          if (!data.cost) errors.push("Missing 'cost' in frontmatter");

          if (errors.length > 0) {
            return { success: false, errors };
          }
          return { success: true, message: 'Schema is valid.' };
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          return { success: false, error: message };
        }
      },
    } as any),

    update_skill_template: tool({
      description:
        'Proposes an update to the current skill content in the editor. Use this when the user asks for changes, or when correcting errors found by other tools.',
      parameters: z.object({
        newContent: z
          .string()
          .describe('The full updated markdown content for the skill.'),
        explanation: z
          .string()
          .describe('Short explanation of the changes made.'),
      }),
      execute: async (args: any) => {
        const { newContent, explanation } = args;
        // The client intercepts this tool result to trigger onUpdateContent
        return { success: true, formattedContent: newContent, explanation };
      },
    } as any),
  };
}
