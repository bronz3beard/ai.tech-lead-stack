/**
 * `tech-lead-stack init`: connects the toolbox to every editor on this
 * computer and creates the settings file. It shows the full plan and asks
 * once before changing anything; `--yes` accepts the recommended choices
 * (for AI assistants and scripts), `--dry-run` only shows the plan.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { Writable } from 'node:stream';

import { readManifest, writeManifest } from '../install/copies.mjs';
import { waitForLock } from '../install/lock.mjs';
import { repoRoot } from '../mcp-server/config.js';
import { readEditors } from './editor-config.js';
import { serverIn, setServer } from './editor-write.js';
import { planSurfaces, projectDirOf } from './init-surfaces.js';
import {
  type EditorChange,
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

const SETTINGS_FILE = path.join(os.homedir(), '.tech-lead-stack', '.env');

interface InitOptions {
  yes: boolean;
  dryRun: boolean;
  editors: string[] | 'auto';
  gateway: string;
  rtk: boolean;
  project: boolean;
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
    rtk: !args.includes('--no-rtk'),
    project: !args.includes('--no-project'),
  };
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

async function applyChange(change: EditorChange): Promise<void> {
  const { target } = change;
  if (change.action === 'keep') return;
  if (change.action === 'add') {
    await setServer({
      target,
      name: change.name,
      server: { ...change.server },
    });
    return;
  }
  const gateway = serverIn(target, change.gateway);
  await setServer({
    target,
    name: change.gateway,
    server: { ...gateway, env: { ...(gateway.env as object), ...change.env } },
  });
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
  const manifest = readManifest();
  const { steps, notes } = planSurfaces({
    changes,
    root: repoRoot,
    projectDir: options.project ? projectDirOf(process.cwd()) : null,
    manifest,
    rtk: options.rtk,
  });

  console.log(`Tech-Lead Stack setup (v${version})\n`);
  if (changes.length === 0) {
    console.log(
      'No supported editor found. Install one (Claude Code, Cursor, Continue, Gemini, Cline or Claude Desktop), then run this again.'
    );
  }
  for (const change of changes) console.log(`  • ${describeChange(change)}`);
  for (const step of steps) console.log(`  • ${step.describe}`);
  if (needsSettingsFile)
    console.log(
      `  • Create your settings file: ${SETTINGS_FILE} (private to you)`
    );
  for (const note of notes) console.log(`  · ${note}`);

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
    if (
      prompt &&
      (toApply.length > 0 || steps.length > 0 || needsSettingsFile)
    ) {
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
    // The same lock as the refresh the MCP server runs at start, so this run
    // and a session starting meanwhile never write the same files at once.
    const lock =
      steps.length > 0
        ? await waitForLock({
            onWait: () =>
              console.log(
                '  … waiting for another tech-lead-stack process to finish updating editor files'
              ),
          })
        : null;
    try {
      // A session may have refreshed the record while you were answering.
      if (lock) Object.assign(manifest, readManifest());
      for (const step of steps) {
        try {
          console.log(`  ✓ ${step.label}: ${await step.apply()}`);
        } catch (err) {
          failed += 1;
          console.log(`  ✗ ${step.describe}: ${(err as Error).message}`);
        }
      }
      if (lock && (await lock.verify()))
        writeManifest({ ...manifest, version });
      else if (lock) {
        failed += 1;
        console.log('  ✗ Install record: lost the lock; run init again');
      }
    } finally {
      await lock?.release();
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

    if (toApply.length > 0 || steps.length > 0)
      console.log(
        '\nRestart your editors (or reconnect MCP servers) to pick up the change.'
      );
    console.log('\nYour setup now:\n');
    const { collectChecks } = await import('./doctor.js');
    const { formatReport } = await import('./doctor-checks.js');
    console.log(formatReport(version, await collectChecks(version)));
    return failed > 0 ? 1 : 0;
  } finally {
    prompt?.close();
  }
}
