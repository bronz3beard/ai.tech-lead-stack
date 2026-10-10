/**
 * One lock for everything that writes install outputs: `init`, `install.sh`
 * (through scripts/generate-ide-commands.mjs) and the refresh the MCP server
 * runs at start. Two Claude Code sessions can start at the same moment, and an
 * explicit install can overlap a session's refresh; without this they would
 * interleave writes to the same files and the same record.
 *
 * Async only: the refresh runs inside the MCP server and must not block it.
 *
 * Each acquisition writes { pid, token, at }. Release and verify match pid AND
 * token, so a late release never removes a later lock.
 *
 * A lock is taken over only when its owner is provably gone (its pid no longer
 * exists, or it crashed before writing). Age alone is never proof: a slow
 * `init` can hold the lock for minutes. Takeover moves the lock aside with an
 * atomic rename and checks what it actually moved; if that turns out to be a
 * fresh lock someone just took, it is linked back (link never overwrites).
 * Holders call `verify()` before committing work, so the remaining
 * microsecond window cannot produce two holders that both commit.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const LOCK_FILE = path.join(
  os.homedir(),
  '.tech-lead-stack',
  'refresh.lock'
);

/** A writer creates the file and writes its pid in the same instant. */
const EMPTY_LOCK_GRACE_MS = 2_000;

async function readText(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

function parse(content) {
  try {
    const value = JSON.parse(content);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM: the process exists but belongs to someone else.
    return e.code !== 'ESRCH';
  }
}

async function ownerGone(file, content) {
  const pid = parse(content)?.pid;
  if (Number.isInteger(pid)) return !pidAlive(pid);
  // No readable pid: either a crash between create and write, or a writer
  // that is writing right now. Only the first is old.
  try {
    const { mtimeMs } = await fs.stat(file);
    return Date.now() - mtimeMs > EMPTY_LOCK_GRACE_MS;
  } catch {
    return false;
  }
}

async function create(file, token) {
  const handle = await fs.open(file, 'wx');
  try {
    await handle.writeFile(
      JSON.stringify({ pid: process.pid, token, at: new Date().toISOString() })
    );
  } finally {
    await handle.close();
  }
}

const isOurs = (content, token) => {
  const lock = parse(content);
  return lock?.pid === process.pid && lock?.token === token;
};

/**
 * Removes the lock at `file` only if `shouldRemove(content)` holds for the
 * lock actually there. The check runs on the file after it has been moved
 * aside atomically, so there is no gap between checking and removing in which
 * a replacement lock could be deleted. Returns true when it removed the lock.
 */
async function removeIf(file, shouldRemove) {
  const claim = `${file}.claim.${process.pid}.${crypto.randomUUID()}`;
  try {
    await fs.rename(file, claim);
  } catch (e) {
    if (e.code === 'ENOENT') return false; // already moved or released
    throw e;
  }
  if (shouldRemove(await readText(claim))) {
    await fs.rm(claim, { force: true });
    return true;
  }
  // We moved a lock that is not ours to remove: put it back. link() fails if
  // a third process created a lock meanwhile; that process then holds the
  // lock and the displaced owner fails its verify().
  try {
    await fs.link(claim, file);
  } catch {
    // Leave the slot to whoever holds it now.
  }
  await fs.rm(claim, { force: true });
  return false;
}

/**
 * Takes over the lock only if it is still the dead lock we inspected
 * (`stale`). Exported for tests of the race path.
 */
export const reclaim = (file, stale) =>
  removeIf(file, (content) => content === stale);

/**
 * Takes the lock, or returns null when someone else holds it. On success the
 * result has `release()` (call in a `finally`) and `verify()` (true while the
 * lock is still ours; check before committing work).
 */
export async function tryAcquireLock(file = LOCK_FILE) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const token = crypto.randomUUID();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await create(file, token);
      return {
        release: () => releaseLock(file, token),
        verify: async () => isOurs(await readText(file), token),
      };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (attempt > 0) return null;
      const stale = await readText(file);
      if (stale !== null) {
        if (!(await ownerGone(file, stale))) return null;
        await reclaim(file, stale);
      }
    }
  }
  return null;
}

/**
 * For explicit runs (init, install.sh, uninstall): waits for a lock another
 * process holds, telling the user once via `onWait`, and gives up with a clear
 * error after `timeoutMs`. A session's refresh holds it for well under a
 * second, so waiting is the right default for a person at a terminal.
 *
 * @param {{ file?: string, timeoutMs?: number, onWait?: () => void }} [options]
 */
export async function waitForLock({
  file = LOCK_FILE,
  timeoutMs = 30_000,
  onWait,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let told = false;
  for (;;) {
    const held = await tryAcquireLock(file);
    if (held) return held;
    if (Date.now() >= deadline) {
      const holder = await lockHolder(file);
      throw new Error(
        `another tech-lead-stack process (pid ${holder?.pid ?? 'unknown'}) is updating editor files; try again in a moment`
      );
    }
    if (!told) {
      onWait?.();
      told = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** Removes the lock only if it is still this acquisition's (pid + token). */
export async function releaseLock(file, token) {
  await removeIf(file, (content) => isOurs(content, token));
}

/** For doctor: who holds the lock and since when, or null. */
export async function lockHolder(file = LOCK_FILE) {
  const content = await readText(file);
  if (content === null) return null;
  const lock = parse(content);
  const pid = Number.isInteger(lock?.pid) ? lock.pid : null;
  return { pid, at: lock?.at ?? null, alive: pid !== null && pidAlive(pid) };
}
