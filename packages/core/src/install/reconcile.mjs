/**
 * Brings install outputs in line with what their surfaces render, without
 * touching files the user owns. Client-neutral: it knows files, hashes and the
 * install record, nothing about editors (surfaces.mjs does).
 *
 *   planReconcile  — read-only: render each surface, compare with disk and the
 *                    record, decide one action per file.
 *   applyReconcile — carry the plan out, one file at a time.
 *
 * Ownership comes from the record: a file whose hash matches the recorded one
 * is ours; anything else (edited, unrecorded, a symlink, a folder) is theirs.
 * Modes:
 *   'refresh' (automatic, at MCP server start): never touches theirs.
 *   'install' (an explicit init / install.sh run): overwrites theirs, after
 *             copying it to ~/.tech-lead-stack/backup/<ISO>-xxxx/.
 *
 * Every replace and remove re-checks the file right before acting
 * (compare-and-swap), so a file the user changes after planning is kept. The
 * record is updated as each file lands, so an interrupted apply is finished by
 * the next one instead of being mistaken for user edits.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { hashOf, sourceOf } from './copies.mjs';
import { renderSurface } from './surfaces.mjs';

/** What is at `file`: missing, a regular file (with its hash), or other. */
async function inspect(file) {
  let stat;
  try {
    stat = await fs.lstat(file);
  } catch (e) {
    if (e.code === 'ENOENT') return { kind: 'missing' };
    throw e;
  }
  if (!stat.isFile()) return { kind: 'other' };
  return { kind: 'file', hash: hashOf(await fs.readFile(file)) };
}

const sameState = (state, expect) =>
  expect === null
    ? state.kind === 'missing'
    : state.kind === 'file' && state.hash === expect;

const recordedFiles = (record, surfaceId) =>
  (record.surfaces ?? []).find((s) => s.id === surfaceId)?.files ?? [];

async function planRemoval({ record, surfaceId, to, actions }) {
  const state = await inspect(to);
  if (state.kind === 'file' && state.hash === record.files[to]) {
    actions.push({ op: 'remove', surfaceId, to, expect: state.hash });
  } else if (state.kind === 'missing') {
    actions.push({ op: 'forget', surfaceId, to });
  } else {
    // Edited or replaced by the user: leave it, stop managing it.
    actions.push({ op: 'release', surfaceId, to, reason: 'changed by you' });
  }
}

/**
 * Decides what to do with every file of `surfaces` (the desired selection:
 * [{ id, ...options }]) and of surfaces the record has that are no longer
 * selected. Reads only.
 */
export async function planReconcile({ record, surfaces, root, home, signal }) {
  const actions = [];
  const selected = new Set(surfaces.map((s) => s.id));
  for (const surface of surfaces) {
    const wanted = new Set();
    for (const { to, content } of await renderSurface({
      surface,
      root,
      home,
      signal,
    })) {
      signal?.throwIfAborted();
      wanted.add(to);
      const want = hashOf(content);
      const state = await inspect(to);
      const base = { surfaceId: surface.id, to };
      if (state.kind === 'other') {
        actions.push({ ...base, op: 'keep', reason: 'not a regular file' });
      } else if (state.kind === 'missing') {
        actions.push({ ...base, op: 'write', content, expect: null });
      } else if (state.hash === want) {
        actions.push({ ...base, op: 'adopt', hash: want });
      } else if (record.files[to] === state.hash) {
        actions.push({ ...base, op: 'write', content, expect: state.hash });
      } else {
        actions.push({ ...base, op: 'conflict', content, expect: state.hash });
      }
    }
    for (const to of recordedFiles(record, surface.id)) {
      if (!wanted.has(to)) {
        await planRemoval({ record, surfaceId: surface.id, to, actions });
      }
    }
  }
  for (const dropped of record.surfaces ?? []) {
    if (selected.has(dropped.id)) continue;
    for (const to of dropped.files ?? []) {
      await planRemoval({ record, surfaceId: dropped.id, to, actions });
    }
  }
  return { surfaces, actions };
}

/** True when applying the plan in `mode` would change disk or the record. */
export function planHasWork({ plan, record, mode }) {
  return plan.actions.some(
    (a) =>
      a.op === 'write' ||
      a.op === 'remove' ||
      a.op === 'forget' ||
      a.op === 'release' ||
      (a.op === 'conflict' && mode === 'install') ||
      (a.op === 'adopt' && record.files[a.to] !== a.hash)
  );
}

const sidePath = (file, tag) =>
  path.join(
    path.dirname(file),
    `.${path.basename(file)}.${tag}.${process.pid}.${crypto.randomUUID()}`
  );

/** Writes `content` at `to` only if `to` is still in state `expect`. */
async function replaceIf({ to, content, expect }) {
  await fs.mkdir(path.dirname(to), { recursive: true });
  const temp = sidePath(to, 'tmp');
  await fs.writeFile(temp, content);
  if (!sameState(await inspect(to), expect)) {
    await fs.rm(temp, { force: true });
    return false;
  }
  await fs.rename(temp, to);
  return true;
}

/**
 * Removes `to` only if it is still the regular file with hash `expect`.
 * Checked first, so anything the user changed (edited, or replaced with a
 * folder or link) is left exactly where it is, untouched. The file is then
 * moved aside atomically and checked again before deleting, which covers a
 * change landing in between.
 */
async function removeIf({ to, expect }) {
  if (!sameState(await inspect(to), expect)) return false;
  const aside = sidePath(to, 'rm');
  try {
    await fs.rename(to, aside);
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
  if (sameState(await inspect(aside), expect)) {
    await fs.rm(aside, { force: true });
    return true;
  }
  // Changed in the instant between the check and the move: put it back.
  // rename() restores files and folders alike while the path is free; if
  // something new already took the path, keep the user's version beside it
  // rather than overwrite either.
  try {
    await fs.access(to);
    await fs.rename(aside, sidePath(to, 'kept'));
  } catch {
    await fs.rename(aside, to);
  }
  return false;
}

/**
 * Copies the user's file into this run's backup folder. Returns false, never
 * throws, when the copy cannot be made or does not match: the caller then
 * leaves that one file alone and carries on with the rest.
 */
async function backUp({ to, expect, home, backup }) {
  try {
    if (!backup.dir) {
      const parent = path.join(home, '.tech-lead-stack', 'backup');
      await fs.mkdir(parent, { recursive: true, mode: 0o700 });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      backup.dir = await fs.mkdtemp(path.join(parent, `${stamp}-`));
    }
    const copy = path.join(backup.dir, path.relative(home, to));
    await fs.mkdir(path.dirname(copy), { recursive: true });
    await fs.copyFile(to, copy);
    return hashOf(await fs.readFile(copy)) === expect;
  } catch {
    return false;
  }
}

/**
 * Carries out `plan` in `mode`. Returns the updated record (files and
 * surfaces; the caller sets version and lastRefresh), a summary, the backup
 * folder if one was made, and `error` when it stopped early. Never throws for
 * a single file; stops at the first unexpected error or when `signal` aborts.
 * `onFile` is called after each action (tests use it to interrupt).
 */
export async function applyReconcile({
  plan,
  mode,
  record,
  home = os.homedir(),
  signal,
  onFile,
}) {
  const files = { ...record.files };
  const owned = new Map(
    (record.surfaces ?? []).map((s) => [s.id, new Set(s.files ?? [])])
  );
  const own = (surfaceId, to, hash) => {
    files[to] = hash;
    if (!owned.has(surfaceId)) owned.set(surfaceId, new Set());
    owned.get(surfaceId).add(to);
  };
  const disown = (surfaceId, to) => {
    delete files[to];
    owned.get(surfaceId)?.delete(to);
  };
  const summary = {
    written: [],
    removed: [],
    kept: [],
    adopted: [],
    backedUp: [],
  };
  const backup = { dir: null };
  let error = null;

  for (const action of plan.actions) {
    try {
      signal?.throwIfAborted();
      const { op, surfaceId, to } = action;
      if (op === 'adopt') {
        own(surfaceId, to, action.hash);
        summary.adopted.push(to);
      } else if (op === 'write' || (op === 'conflict' && mode === 'install')) {
        if (op === 'conflict') {
          if (!(await backUp({ to, expect: action.expect, home, backup }))) {
            summary.kept.push({ to, reason: 'could not back it up' });
            continue;
          }
          summary.backedUp.push(to);
        }
        if (await replaceIf(action)) {
          own(surfaceId, to, hashOf(action.content));
          summary.written.push(to);
        } else {
          summary.kept.push({ to, reason: 'changed while updating' });
        }
      } else if (op === 'conflict' || op === 'keep') {
        summary.kept.push({ to, reason: action.reason ?? 'changed by you' });
      } else if (op === 'remove') {
        if (await removeIf(action)) summary.removed.push(to);
        else summary.kept.push({ to, reason: 'changed while removing' });
        disown(surfaceId, to);
      } else if (op === 'forget' || op === 'release') {
        if (op === 'release') summary.kept.push({ to, reason: action.reason });
        disown(surfaceId, to);
      }
      onFile?.(action);
    } catch (e) {
      error =
        e.name === 'AbortError' ? 'stopped: time budget or abort' : e.message;
      break;
    }
  }

  const surfaces = plan.surfaces.map((s) => ({
    ...s,
    files: [...(owned.get(s.id) ?? [])].sort(),
  }));
  return {
    record: { ...record, files, surfaces },
    summary,
    backupDir: backup.dir,
    error,
  };
}

/**
 * An explicit install (init, install.sh): renders and applies `surfaces` in
 * install mode and records where they came from. The caller holds the lock
 * and saves the returned record (adding its own version).
 */
export async function installSurfaces({
  record,
  surfaces,
  root,
  home = os.homedir(),
}) {
  const plan = await planReconcile({ record, surfaces, root, home });
  const result = await applyReconcile({ plan, mode: 'install', record, home });
  return {
    ...result,
    record: { ...result.record, source: await sourceOf(root) },
  };
}
