/**
 * `tech-lead-stack doctor`: a read-only health check. It reads settings files
 * and editor configs, asks the database whether its tables exist, and changes
 * nothing. `--json` prints the same checks for an AI assistant to read.
 */
import '../mcp-server/config.js';

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { globalTargets } from '../install/targets.mjs';
import { getPool } from '../lib/prisma.js';
import {
  type Check,
  type DatabaseState,
  type EditorConfig,
  checkAnyEditor,
  checkDatabase,
  checkEditor,
  checkFeatures,
  checkNode,
  checkPlatform,
  checkRtk,
  checkSettingsFile,
  formatReport,
  hasFailure,
} from './doctor-checks.js';

const run = promisify(execFile);

function readEditorConfig(file: string): EditorConfig {
  if (!fs.existsSync(file)) return { state: 'missing' };
  try {
    return {
      state: 'read',
      config: JSON.parse(fs.readFileSync(file, 'utf8') || '{}'),
    };
  } catch {
    return { state: 'unreadable' };
  }
}

// A refused connection arrives as an AggregateError with an empty message and
// the useful code (ECONNREFUSED) on its inner errors.
function describeError(err: unknown): string {
  const e = err as Error & { code?: string; errors?: { code?: string }[] };
  return e.message || e.code || e.errors?.[0]?.code || 'no response';
}

async function probeDatabase(): Promise<DatabaseState> {
  if (!process.env.DATABASE_URL?.trim()) return { state: 'no-url' };
  const pool = getPool();
  try {
    const { rows } = await pool.query<{ t: string | null }>(
      `select to_regclass('public."AnalyticsEvent"')::text as t`
    );
    return rows[0]?.t ? { state: 'ready' } : { state: 'no-tables' };
  } catch (err) {
    return { state: 'unreachable', message: describeError(err) };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function rtkVersion(): Promise<string | null> {
  try {
    const { stdout } = await run('rtk', ['--version'], { timeout: 5000 });
    return stdout.trim().split(/\s+/).pop() ?? null;
  } catch {
    return null;
  }
}

function settingsFile() {
  const file = path.join(os.homedir(), '.tech-lead-stack', '.env');
  if (!fs.existsSync(file))
    return { path: file, exists: false, othersCanRead: false };
  // Windows has no Unix permission bits to check.
  const othersCanRead =
    process.platform !== 'win32' && (fs.statSync(file).mode & 0o077) !== 0;
  return { path: file, exists: true, othersCanRead };
}

export async function collectChecks(): Promise<Check[]> {
  const editors = globalTargets
    .filter((t) => t.kind === 'mcp-entry')
    .map((t) =>
      checkEditor(
        { ...t, label: t.label.replace(' MCP registration', '') },
        readEditorConfig(t.path)
      )
    );

  return [
    checkNode(process.version),
    checkPlatform(process.platform),
    checkSettingsFile(settingsFile()),
    ...checkFeatures(process.env),
    checkDatabase(await probeDatabase()),
    ...editors,
    checkAnyEditor(editors),
    checkRtk(await rtkVersion()),
  ].filter((c): c is Check => c !== null);
}

/** Prints the report and returns the process exit code. */
export async function runDoctor({
  args,
  version,
}: {
  args: string[];
  version: string;
}): Promise<number> {
  const checks = await collectChecks();
  if (args.includes('--json')) {
    console.log(
      JSON.stringify({ version, ok: !hasFailure(checks), checks }, null, 2)
    );
  } else {
    console.log(formatReport(version, checks));
  }
  return hasFailure(checks) ? 1 : 0;
}
