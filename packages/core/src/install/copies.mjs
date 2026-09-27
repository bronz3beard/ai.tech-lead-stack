/**
 * Files `tech-lead-stack init` copies onto the machine (slash commands, Cursor
 * skills, Continue prompts, project workflows), and the record of them in
 * ~/.tech-lead-stack/installed.json.
 *
 * npx runs the package from a cache folder npm may clear at any time, so these
 * are copies rather than links into it. The record holds each file's hash so
 * that a later `init` refreshes only files it wrote and nobody changed, and
 * `uninstall` removes only those. A symlink (a clone install's link) or a file
 * someone edited is always left alone.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const MANIFEST_FILE = path.join(
  os.homedir(),
  '.tech-lead-stack',
  'installed.json'
);

export const hashOf = (content) =>
  crypto.createHash('sha256').update(content).digest('hex');

export function readManifest() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
    return { version: parsed.version ?? null, files: parsed.files ?? {} };
  } catch {
    return { version: null, files: {} };
  }
}

export function writeManifest(manifest) {
  fs.mkdirSync(path.dirname(MANIFEST_FILE), { recursive: true, mode: 0o700 });
  fs.writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Who a destination file belongs to:
 *   'free'   — nothing there yet;
 *   'ours'   — written by init and unchanged since;
 *   'theirs' — a symlink, or a file init did not write or someone edited.
 */
export function ownership(file, manifest) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch {
    return 'free';
  }
  if (stat.isSymbolicLink() || !stat.isFile()) return 'theirs';
  return manifest.files[file] === hashOf(fs.readFileSync(file))
    ? 'ours'
    : 'theirs';
}

/**
 * Copies `from` to `to` unless `to` is someone else's. A file that already
 * holds exactly the new content is adopted into the record. Returns
 * 'written', 'same' or 'kept'.
 */
export function copyOwned({ from, to, manifest }) {
  const content = fs.readFileSync(from);
  const owner = ownership(to, manifest);
  if (owner === 'theirs') {
    const identical =
      fs.lstatSync(to).isFile() &&
      hashOf(fs.readFileSync(to)) === hashOf(content);
    if (!identical) return 'kept';
    manifest.files[to] = hashOf(content);
    return 'same';
  }
  if (owner === 'ours' && manifest.files[to] === hashOf(content)) return 'same';
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, content);
  manifest.files[to] = hashOf(content);
  return 'written';
}

/** Records files that were written by other means (the command generator). */
export function recordFiles(manifest, files) {
  for (const file of files)
    manifest.files[file] = hashOf(fs.readFileSync(file));
}

/** Removes empty folders left behind, up to two levels, never the home folder. */
function pruneEmptyParents(file) {
  let dir = path.dirname(file);
  for (let level = 0; level < 2 && dir !== os.homedir(); level += 1) {
    try {
      if (fs.readdirSync(dir).length > 0) return;
      fs.rmdirSync(dir);
    } catch {
      return;
    }
    dir = path.dirname(dir);
  }
}

/**
 * Removes every recorded file that is still exactly as init wrote it.
 * Previews when `apply` is false. Returns what was (or would be) removed and
 * what was kept because it changed.
 */
export function removeOwned({ manifest, apply }) {
  const removed = [];
  const kept = [];
  for (const file of Object.keys(manifest.files)) {
    const owner = ownership(file, manifest);
    if (owner === 'free') continue;
    if (owner === 'theirs') {
      kept.push(file);
      continue;
    }
    removed.push(file);
    if (apply) {
      fs.rmSync(file);
      pruneEmptyParents(file);
    }
  }
  return { removed, kept };
}
