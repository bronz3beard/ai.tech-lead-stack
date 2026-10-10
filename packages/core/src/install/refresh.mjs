/**
 * Keeps install outputs current by themselves. The MCP server calls this once
 * after it connects: npx resolves a new release at every session start, and a
 * clone's server runs from the checkout, so the server that will answer the
 * commands is the right one to render them.
 *
 * Client-neutral: it replays what the install recorded (surfaces.mjs knows the
 * clients). It only ever touches files the record says are ours (reconcile.mjs
 * 'refresh' mode), logs to stderr only (stdout is the MCP protocol stream),
 * never throws, and never blocks: all I/O is async and a time budget bounds it.
 *
 * Runs only when every guard passes:
 *   1. TLS_AUTO_REFRESH is not "0" (opt-out; gateways pass the env through);
 *   2. this machine has a record with surfaces (a remote server has none);
 *   3. the record's source is this server (npm vs the same clone), so two
 *      installs never fight over the same files;
 *   4. an npm server is not older than the record (no rolling back);
 *   5. there is something to do.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  loadManifest,
  MANIFEST_FILE,
  saveManifest,
  sourceOf,
} from './copies.mjs';
import { LOCK_FILE, tryAcquireLock } from './lock.mjs';
import { applyReconcile, planHasWork, planReconcile } from './reconcile.mjs';
import { targetDir } from './surfaces.mjs';
import { versionAtLeast } from './version.mjs';

export const REFRESH_BUDGET_MS = 5_000;

const sameSource = (a, b) =>
  a.kind === b?.kind && (a.kind === 'npm' || a.root === b.root);

const SERVER_IN_COMMAND = /mcp__([A-Za-z0-9_-]+)__get_skill/;

/**
 * Works out what an install made by `init` 1.1.0–2.1.0 chose, from its record
 * alone (those records have files but no surfaces). Every release in that
 * range wrote all three command domains through one server and never passed
 * `domains` (release tags v1.1.0–v2.1.0), so the evidence must show exactly
 * that: one server named in the recorded commands, and pm-* and hr-* files.
 * Returns { surfaces } or { reason } when it cannot be sure (then nothing is
 * touched and doctor says to run init once).
 */
export async function adoptLegacy({ record, home = os.homedir() }) {
  const recorded = Object.keys(record.files);
  const under = (id) =>
    recorded.filter((f) => f.startsWith(targetDir(id, home) + path.sep));
  const surfaces = [];

  const commands = under('claude-code-commands');
  if (commands.length > 0) {
    const servers = new Set();
    for (const file of commands) {
      const text = await fs.readFile(file, 'utf8').catch(() => '');
      const match = text.match(SERVER_IN_COMMAND);
      if (match) servers.add(match[1]);
    }
    if (servers.size !== 1) {
      return {
        reason: servers.size
          ? `the commands name ${servers.size} different servers`
          : 'no server name found in the commands',
      };
    }
    const names = commands.map((f) => path.basename(f));
    if (
      !names.some((n) => n.startsWith('pm-')) ||
      !names.some((n) => n.startsWith('hr-'))
    ) {
      return { reason: 'the recorded commands do not cover every domain' };
    }
    surfaces.push({
      id: 'claude-code-commands',
      server: [...servers][0],
      domains: ['eng', 'pm', 'hr'],
      files: commands,
    });
  }
  for (const id of ['cursor-skills', 'continue-prompts']) {
    const files = under(id);
    if (files.length > 0) surfaces.push({ id, files });
  }
  if (surfaces.length === 0) return { reason: 'no editor files are recorded' };
  return { surfaces };
}

/** Which guard stops a refresh for `record`, or null when it may run. */
async function blockedBy({ record, root, version }) {
  if (!record.surfaces) {
    // A record from init <= 2.1.0 (npm only) is adopted under the lock.
    const legacy = Object.keys(record.files).length > 0;
    return legacy && (await sourceOf(root)).kind === 'npm' ? null : 'no-record';
  }
  const source = await sourceOf(root);
  if (!sameSource(source, record.source)) return 'source-mismatch';
  if (
    source.kind === 'npm' &&
    record.version &&
    !versionAtLeast(version, record.version)
  ) {
    return 'older-version';
  }
  return null;
}

/**
 * Returns { status, ... } and never throws. Status is one of: disabled,
 * no-record, source-mismatch, older-version, busy, up-to-date, refreshed,
 * failed. `signal` (optional) stops it early, alongside the time budget.
 */
export async function refreshInstalledSurfaces({
  root,
  version,
  env = process.env,
  home = os.homedir(),
  recordFile = MANIFEST_FILE,
  lockFile = LOCK_FILE,
  budgetMs = REFRESH_BUDGET_MS,
  signal: stop = undefined,
  log = (line) => process.stderr.write(`${line}\n`),
}) {
  if (env.TLS_AUTO_REFRESH === '0') return { status: 'disabled' };
  // Logging must never turn into a thrown error: this runs inside the server.
  const say = (line) => {
    try {
      log(line);
    } catch {
      // stderr closed or a broken log callback: nothing useful left to do.
    }
  };
  let lock = null;
  try {
    const blocked = await blockedBy({
      record: await loadManifest(recordFile),
      root,
      version,
    });
    if (blocked) return { status: blocked };

    lock = await tryAcquireLock(lockFile);
    if (!lock) return { status: 'busy' }; // another session is doing it

    // Re-read under the lock: an install may have changed it meanwhile.
    let record = await loadManifest(recordFile);
    const stillBlocked = await blockedBy({ record, root, version });
    if (stillBlocked) return { status: stillBlocked };

    let adopted = null;
    if (!record.surfaces) {
      const adoption = await adoptLegacy({ record, home });
      if (!adoption.surfaces) {
        return { status: 'not-adoptable', reason: adoption.reason };
      }
      adopted = record.version ?? 'an earlier version';
      record = {
        ...record,
        source: { kind: 'npm' },
        surfaces: adoption.surfaces,
      };
    }

    const budget = AbortSignal.timeout(budgetMs);
    const signal = stop ? AbortSignal.any([budget, stop]) : budget;
    let plan;
    try {
      plan = await planReconcile({
        record,
        surfaces: record.surfaces,
        root,
        home,
        signal,
      });
    } catch (e) {
      await saveIfOurs(lock, recordFile, {
        ...record,
        lastRefresh: lastRefresh({
          version,
          error: `planning: ${messageOf(e)}`,
        }),
      });
      throw e;
    }
    if (!planHasWork({ plan, record, mode: 'refresh' })) {
      // Nothing to write, but keep an adoption so it is not redone each start.
      if (adopted) await saveIfOurs(lock, recordFile, record);
      return { status: 'up-to-date' };
    }

    const result = await applyReconcile({
      plan,
      mode: 'refresh',
      record,
      home,
      signal,
    });
    const { summary, error } = result;
    // Saved even after an error: every file that landed is recorded, so the
    // next start finishes the job instead of taking them for user edits.
    const saved = await saveIfOurs(lock, recordFile, {
      ...result.record,
      version: error ? record.version : version,
      lastRefresh: lastRefresh({ version, summary, error }),
    });
    const failure = error ?? (saved ? null : 'lost the lock; record not saved');
    say(
      `[tls] ${failure ? 'partly refreshed' : 'refreshed'} editor files to ${version}: ` +
        `${summary.written.length} written, ${summary.removed.length} removed, ` +
        `${summary.kept.length} left alone` +
        (failure ? ` (${failure})` : '') +
        (adopted ? ` · took over the install made by ${adopted}` : '') +
        ' · TLS_AUTO_REFRESH=0 turns this off'
    );
    return {
      status: failure ? 'failed' : 'refreshed',
      summary,
      error: failure,
    };
  } catch (e) {
    say(`[tls] editor file refresh failed: ${messageOf(e)}`);
    return { status: 'failed', error: messageOf(e) };
  } finally {
    await lock?.release().catch(() => {});
  }
}

const messageOf = (e) => (e instanceof Error ? e.message : String(e));

function lastRefresh({ version, summary, error = null }) {
  return {
    at: new Date().toISOString(),
    by: version,
    written: summary?.written.length ?? 0,
    removed: summary?.removed.length ?? 0,
    kept: summary?.kept.map((k) => k.to) ?? [],
    error,
  };
}

async function saveIfOurs(lock, recordFile, record) {
  if (!(await lock.verify())) return false;
  await saveManifest(record, recordFile);
  return true;
}
