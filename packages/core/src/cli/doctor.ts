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

import { readManifest, sourceOf } from '../install/copies.mjs';
import { repoRoot } from '../mcp-server/config.js';
import { lockHolder } from '../install/lock.mjs';
import { adoptLegacy } from '../install/refresh.mjs';
import { RTK_VERSION } from '../install/rtk-pin.mjs';
import { globalTargets } from '../install/targets.mjs';
import { getPool } from '../lib/prisma.js';
import {
  type Check,
  type DatabaseState,
  type EditorFilesState,
  checkAnyEditor,
  checkCopies,
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
import { readEditorConfig } from './editor-config.js';

const run = promisify(execFile);

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

export async function collectChecks(version: string): Promise<Check[]> {
  const editors = globalTargets
    .filter((t) => t.kind === 'mcp-entry' || t.kind === 'yaml-entry')
    .map((t) =>
      checkEditor(
        { ...t, label: t.label.replace(' MCP registration', '') },
        readEditorConfig(t)
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
    checkRtk({ installed: await rtkVersion(), pinned: RTK_VERSION }),
    checkCopies(await editorFilesState(version)),
  ].filter((c): c is Check => c !== null);
}

/** A refresh takes well under a second; this long means something is stuck. */
const STUCK_LOCK_MS = 60_000;

/** Facts for checkCopies: the install record, its refresh, and the lock. */
async function editorFilesState(running: string): Promise<EditorFilesState> {
  const record = readManifest();
  const legacy = !record.surfaces && Object.keys(record.files).length > 0;
  let adoption: EditorFilesState['adoption'] = null;
  if (legacy && (await sourceOf(repoRoot)).kind !== 'npm') {
    // Same rule as the refresh: only the npm package takes over these.
    adoption = {
      ok: false,
      reason:
        'this toolbox runs from a clone; only the npm package takes over an install made by init',
    };
  } else if (legacy) {
    const result = await adoptLegacy({ record }); // reads only
    adoption = result.surfaces
      ? { ok: true }
      : { ok: false, reason: result.reason ?? 'unknown' };
  }
  const holder = await lockHolder();
  const heldFor = holder?.at ? Date.now() - Date.parse(holder.at) : 0;
  return {
    installed: record.version,
    running,
    recorded: Array.isArray(record.surfaces),
    adoption,
    autoRefresh: process.env.TLS_AUTO_REFRESH !== '0',
    lastRefresh: record.lastRefresh,
    stuckLock:
      holder?.alive && heldFor > STUCK_LOCK_MS
        ? { pid: holder.pid, at: holder.at }
        : null,
  };
}

/** Prints the report and returns the process exit code. */
export async function runDoctor({
  args,
  version,
}: {
  args: string[];
  version: string;
}): Promise<number> {
  const checks = await collectChecks(version);
  if (args.includes('--json')) {
    console.log(
      JSON.stringify({ version, ok: !hasFailure(checks), checks }, null, 2)
    );
  } else {
    console.log(formatReport(version, checks));
  }
  return hasFailure(checks) ? 1 : 0;
}
