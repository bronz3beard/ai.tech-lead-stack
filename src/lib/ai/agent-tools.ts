import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';

const execFileAsync = promisify(execFile);

export const agentTools: any = {
  lint_and_format: {
    description: 'Runs prettier and markdownlint to automatically format the skill content and fix lint issues.',
    parameters: z.object({
      content: z.string().describe('The markdown content of the skill to format.'),
    }),
    execute: async function({ content }: { content: string }): Promise<any> {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-lint-'));
      const tempFile = path.join(tempDir, 'temp-skill.md');
      try {
        await fs.writeFile(tempFile, content, 'utf-8');

        // Format with Prettier
        await execFileAsync('npx', ['prettier', '--write', tempFile]);

        // Run markdownlint --fix
        await execFileAsync('npx', ['markdownlint-cli', '--fix', tempFile]);

        // Run Prettier again just in case markdownlint changed formatting
        await execFileAsync('npx', ['prettier', '--write', tempFile]);

        const formattedContent = await fs.readFile(tempFile, 'utf-8');
        return { success: true, formattedContent };
      } catch (error: any) {
        return { success: false, error: error.message || String(error) };
      } finally {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (e) {}
      }
    },
  },

  validate_ethos: {
    description: 'Validates the skill content against the Tech-Lead Stack ethos (G-stack, MinimumCD) by running validation scripts.',
    parameters: z.object({
      content: z.string().describe('The markdown content of the skill to validate.'),
    }),
    execute: async function({ content }: { content: string }): Promise<any> {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-validate-'));
      const tempFile = path.join(tempDir, 'temp-skill.md');
      try {
        await fs.writeFile(tempFile, content, 'utf-8');
        const scriptPath = path.join(process.cwd(), 'scripts', 'validate-skills.sh');
        const { stdout, stderr } = await execFileAsync('bash', [scriptPath, tempFile]);
        return { success: true, output: stdout || stderr || 'Validation successful' };
      } catch (error: any) {
        return { success: false, error: error.stdout || error.stderr || error.message || 'Validation failed' };
      } finally {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (e) {}
      }
    },
  },

  get_stylistic_examples: {
    description: 'Fetches 2-3 random files from .ai/skills/ to use as reference for tone and formatting.',
    parameters: z.object({}),
    execute: async function(): Promise<any> {
      try {
        const skillsDir = path.join(process.cwd(), '.ai', 'skills');
        const files = await fs.readdir(skillsDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        // Shuffle and pick 2
        const shuffled = mdFiles.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 2);

        const examples = await Promise.all(selected.map(async file => {
          const content = await fs.readFile(path.join(skillsDir, file), 'utf-8');
          return { filename: file, content };
        }));

        return { success: true, examples };
      } catch (error: any) {
        return { success: false, error: error.message || String(error) };
      }
    },
  },

  check_schema: {
    description: 'Validates the frontmatter against the SKILL_TEMPLATE.md structure.',
    parameters: z.object({
      content: z.string().describe('The markdown content containing the frontmatter to validate.'),
    }),
    execute: async function({ content }: { content: string }): Promise<any> {
      try {
        const parsed = matter(content);
        const data = parsed.data;
        const errors: string[] = [];

        if (!data.name) errors.push("Missing 'name' in frontmatter");
        if (!data.description) errors.push("Missing 'description' in frontmatter");
        if (!data.cost) errors.push("Missing 'cost' in frontmatter");

        if (errors.length > 0) {
          return { success: false, errors };
        }
        return { success: true, message: "Schema is valid." };
      } catch (error: any) {
        return { success: false, error: error.message || String(error) };
      }
    },
  }
};
