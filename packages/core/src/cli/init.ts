/**
 * `tech-lead-stack init`: connects the toolbox to every editor on this
 * computer and creates the settings file. It shows the full plan and asks
 * once before changing anything; `--yes` accepts the recommended choices
 * (for AI assistants and scripts), `--dry-run` only shows the plan.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import { promisify } from 'node:util';

import { writeContinueServer } from '../install/continue-config.mjs';
import { updateJsonFile, withServer } from '../install/mcp-json.mjs';
import { globalTargets } from '../install/targets.mjs';
import { readEditorConfig } from './editor-config.js';
import {
  type EditorChange,
  type EditorState,
  type ServerSpec,
  describeChange,
  editorNames,
  planEditors,
} from './init-plan.js';
import {
  SETTINGS_TEMPLATE,
  SETTING_QUESTIONS,
  assignedNames,
  withSettings,
} from './settings-file.js';

const run = promisify(execFile);
const SETTINGS_FILE = path.join(os.homedir(), '.tech-lead-stack', '.env');

interface InitOptions {
  yes: boolean;
  dryRun: boolean;
  editors: string[] | 'auto';
  gateway: string;
}

function parseArgs(args: string[]): InitOptions {
  const value = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const ide = value('--ide');
  return {
    yes: args.includes('--yes') || args.includes('-y'),
    dryRun: args.includes('--dry-run'),
    editors:
      ide && ide !== 'auto' ? ide.split(',').map((s) => s.trim()) : 'auto',
    gateway: value('--gateway') ?? 'auto',
  };
}

function readEditors(): EditorState[] {
  return globalTargets
    .filter((t) => t.editor)
    .map((t) => ({
      id: t.id,
      editor: t.editor as string,
      label: t.label.replace(' MCP registration', ''),
      path: t.path,
      kind: t.kind,
      installed:
        fs.existsSync(t.installedIf as string) || fs.existsSync(t.path),
      config: readEditorConfig(t),
    }));
}

/** Terminal questions. Secret answers are not shown while typed. */
function createPrompt() {
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, done) {
      if (!muted) process.stdout.write(chunk, encoding);
      done();
    },
  });
  const rl = readline.createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });
  return {
    async ask(question: string, { secret = false } = {}) {
      process.stdout.write(`${question}: `);
      muted = secret;
      const answer = await rl.question('');
      muted = false;
      if (secret) process.stdout.write('\n');
      return answer.trim();
    },
    close: () => rl.close(),
  };
}

async function hasClaudeCli(): Promise<boolean> {
  try {
    await run('claude', ['--version'], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Claude Code rewrites ~/.claude.json while it runs, so its own CLI makes the
 * change when it is installed (as install.sh does); otherwise the file is
 * edited directly.
 */
async function setClaudeCodeServer({
  name,
  server,
  replace,
}: {
  name: string;
  server: object;
  replace: boolean;
}) {
  if (await hasClaudeCli()) {
    if (replace)
      await run('claude', ['mcp', 'remove', name, '--scope', 'user']);
    await run('claude', [
      'mcp',
      'add-json',
      name,
      JSON.stringify(server),
      '--scope',
      'user',
    ]);
    return;
  }
  const file = globalTargets.find((t) => t.editor === 'claude-code')
    ?.path as string;
  updateJsonFile(file, (config: object) => withServer(config, name, server));
}

function serverIn(target: EditorState, name: string): Record<string, unknown> {
  const config = target.config.state === 'read' ? target.config.config : {};
  const servers = (
    config as { mcpServers?: Record<string, Record<string, unknown>> }
  ).mcpServers;
  return { ...(servers?.[name] ?? {}) };
}

async function applyChange(change: EditorChange): Promise<void> {
  const { target } = change;
  if (change.action === 'keep') return;

  let name: string;
  let server: Record<string, unknown>;
  if (change.action === 'add') {
    name = change.name;
    server = { ...change.server };
  } else {
    name = change.gateway;
    const gateway = serverIn(target, name);
    server = { ...gateway, env: { ...(gateway.env as object), ...change.env } };
  }

  if (target.kind === 'yaml-entry') {
    writeContinueServer({ file: target.path, server: { name, ...server } });
  } else if (target.editor === 'claude-code') {
    await setClaudeCodeServer({
      name,
      server,
      replace: change.action === 'behind-gateway',
    });
  } else {
    updateJsonFile(target.path, (config: object) =>
      withServer(config, name, server)
    );
  }
}

async function askSettings(prompt: ReturnType<typeof createPrompt>) {
  const text = fs.readFileSync(SETTINGS_FILE, 'utf8');
  const already = assignedNames(text);
  const answers: Record<string, string> = {};
  for (const q of SETTING_QUESTIONS) {
    if (already.has(q.name) || process.env[q.name]) continue;
    for (;;) {
      const answer = await prompt.ask(q.question, { secret: q.secret });
      if (!answer) break;
      const parsed = q.schema.safeParse(answer);
      if (parsed.success) {
        answers[q.name] = answer;
        break;
      }
      console.log(
        `  ${parsed.error.issues[0].message} Try again, or press Enter to skip.`
      );
    }
  }
  if (Object.keys(answers).length > 0) {
    fs.writeFileSync(SETTINGS_FILE, withSettings(text, answers), {
      mode: 0o600,
    });
    console.log(
      `  Saved to ${SETTINGS_FILE}: ${Object.keys(answers).join(', ')}`
    );
  }
}

function createSettingsFile() {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true, mode: 0o700 });
  fs.writeFileSync(SETTINGS_FILE, SETTINGS_TEMPLATE, { mode: 0o600 });
}

export async function runInit({
  args,
  version,
}: {
  args: string[];
  version: string;
}): Promise<number> {
  const options = parseArgs(args);
  if (process.platform === 'win32') {
    console.error(
      'On Windows, run this inside WSL: https://learn.microsoft.com/windows/wsl/install'
    );
    return 1;
  }

  const editors = readEditors();
  if (options.editors !== 'auto') {
    const unknown = options.editors.filter(
      (e) => !editorNames(editors).includes(e)
    );
    if (unknown.length > 0) {
      console.error(
        `Unknown editor "${unknown.join('", "')}". Choose from: ${editorNames(editors).join(', ')}`
      );
      return 2;
    }
  }

  const major = version.split('.')[0];
  const server: ServerSpec = {
    command: 'npx',
    args: ['-y', `tech-lead-stack@${major}`],
  };
  const changes = planEditors(editors, { ...options, server });
  const needsSettingsFile = !fs.existsSync(SETTINGS_FILE);
  const toApply = changes.filter((c) => c.action !== 'keep');

  console.log(`Tech-Lead Stack setup (v${version})\n`);
  if (changes.length === 0) {
    console.log(
      'No supported editor found. Install one (Claude Code, Cursor, Continue, Gemini, Cline or Claude Desktop), then run this again.'
    );
  }
  for (const change of changes) console.log(`  • ${describeChange(change)}`);
  if (needsSettingsFile)
    console.log(
      `  • Create your settings file: ${SETTINGS_FILE} (private to you)`
    );

  if (options.dryRun) {
    console.log('\nDry run: nothing was changed.');
    return 0;
  }

  const interactive = process.stdin.isTTY && !options.yes;
  if (!options.yes && !process.stdin.isTTY) {
    console.error(
      '\nThis needs answers from you. Run it in a terminal, or add --yes to accept the recommended choices.'
    );
    return 2;
  }
  const prompt = interactive ? createPrompt() : null;
  try {
    if (prompt && (toApply.length > 0 || needsSettingsFile)) {
      const answer = await prompt.ask('\nMake these changes? [Y/n]');
      if (/^n/i.test(answer)) {
        console.log('Nothing was changed.');
        return 0;
      }
    }

    let failed = 0;
    for (const change of toApply) {
      try {
        await applyChange(change);
        console.log(`  ✓ ${change.target.label}`);
      } catch (err) {
        failed += 1;
        console.log(`  ✗ ${change.target.label}: ${(err as Error).message}`);
      }
    }
    if (needsSettingsFile) {
      createSettingsFile();
      console.log(`  ✓ Settings file: ${SETTINGS_FILE}`);
    }
    if (prompt) {
      console.log(
        '\nOptional extras. Press Enter to skip any of them; you can add them to the settings file later.'
      );
      await askSettings(prompt);
    }

    if (toApply.length > 0)
      console.log(
        '\nRestart your editors (or reconnect MCP servers) to pick up the change.'
      );
    console.log('\nYour setup now:\n');
    const { collectChecks } = await import('./doctor.js');
    const { formatReport } = await import('./doctor-checks.js');
    console.log(formatReport(version, await collectChecks()));
    return failed > 0 ? 1 : 0;
  } finally {
    prompt?.close();
  }
}
