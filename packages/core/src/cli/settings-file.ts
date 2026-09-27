/**
 * ~/.tech-lead-stack/.env: the one settings file for npx installs. The MCP
 * server reads it (mcp-server/config.ts); init creates it and fills in the
 * answers people give. Pure text in, text out, so it is easy to test.
 */
import { z } from 'zod';

export const SETTINGS_TEMPLATE = `# Tech-Lead Stack settings. Every editor on this computer uses this file.
# A value in an editor's MCP "env" block wins over this file, for that editor.
# Keep it private: it may hold API keys. Lines starting with # are ignored.

# Usage metrics: the same database your web app uses.
# DATABASE_URL=""

# Two-model reflexion loop: needs both keys.
# ANTHROPIC_API_KEY=""
# GEMINI_API_KEY=""
`;

/** The questions init asks, in order. Every one is optional. */
export const SETTING_QUESTIONS = [
  {
    name: 'DATABASE_URL',
    question:
      "Usage metrics: paste your web app's database address (starts with postgresql://), or press Enter to skip",
    secret: true,
    schema: z
      .string()
      .regex(
        /^postgres(ql)?:\/\/\S+$/,
        'It must start with postgresql:// and contain no spaces.'
      ),
  },
  {
    name: 'ANTHROPIC_API_KEY',
    question:
      'Two-model reflexion loop: paste your Anthropic API key, or press Enter to skip',
    secret: true,
    schema: z
      .string()
      .regex(/^[^\s"]{20,}$/, 'That does not look like an API key.'),
  },
  {
    name: 'GEMINI_API_KEY',
    question:
      'Two-model reflexion loop: paste your Gemini API key, or press Enter to skip',
    secret: true,
    schema: z
      .string()
      .regex(/^[^\s"]{20,}$/, 'That does not look like an API key.'),
  },
] as const;

const assignment = (name: string) => new RegExp(`^\\s*${name}\\s*=`, 'm');

/** Names that have a value in the file (commented-out lines don't count). */
export function assignedNames(text: string): Set<string> {
  const names = new Set<string>();
  for (const [, name] of text.matchAll(
    /^\s*([A-Z][A-Z0-9_]*)\s*=\s*"?[^"\s]/gm
  )) {
    names.add(name);
  }
  return names;
}

/**
 * Adds values for names the file does not set yet: fills the commented
 * placeholder (`# NAME=""`) where there is one, otherwise appends. Never
 * changes a value that is already set.
 */
export function withSettings(
  text: string,
  values: Record<string, string>
): string {
  let result = text;
  for (const [name, value] of Object.entries(values)) {
    if (assignedNames(result).has(name)) continue;
    const line = `${name}="${value}"`;
    const placeholder = new RegExp(`^#\\s*${name}=.*$`, 'm');
    if (placeholder.test(result)) {
      result = result.replace(placeholder, line);
    } else if (assignment(name).test(result)) {
      // An empty assignment (NAME="") counts as unset; fill it in place.
      result = result.replace(new RegExp(`^\\s*${name}\\s*=.*$`, 'm'), line);
    } else {
      result = `${result.replace(/\n*$/, '\n')}${line}\n`;
    }
  }
  return result;
}
