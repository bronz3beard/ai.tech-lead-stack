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

/**
 * The record with every key present. `source` and `surfaces` stay null for a
 * record written before they existed (init <= 2.1.0): the refresh tells that
 * legacy shape apart from "nothing selected" (an empty array).
 */
export function parseManifest(text) {
  try {
    const parsed = JSON.parse(text);
    return {
      version: parsed.version ?? null,
      files: parsed.files ?? {},
      source: parsed.source ?? null,
      surfaces: Array.isArray(parsed.surfaces) ? parsed.surfaces : null,
      lastRefresh: parsed.lastRefresh ?? null,
    };
  } catch {
    return {
      version: null,
      files: {},
      source: null,
      surfaces: null,
      lastRefresh: null,
    };
  }
}

const serialize = (manifest) => `${JSON.stringify(manifest, null, 2)}\n`;
const tempFor = (file) => `${file}.${process.pid}.tmp`;

export function readManifest(file = MANIFEST_FILE) {
  try {
    return parseManifest(fs.readFileSync(file, 'utf8'));
  } catch {
    return parseManifest('{}');
  }
}

/** Written to a temp file and renamed, so a reader never sees half a record. */
export function writeManifest(manifest, file = MANIFEST_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(tempFor(file), serialize(manifest));
  fs.renameSync(tempFor(file), file);
}

/**
 * Where install outputs are rendered from: a clone (its root has `.git`; the
 * path is canonical so a symlinked checkout still matches) or the npm package
 * (any npx cache folder; it changes between versions).
 */
export async function sourceOf(root) {
  try {
    await fs.promises.access(path.join(root, '.git'));
    return { kind: 'clone', root: await fs.promises.realpath(root) };
  } catch {
    return { kind: 'npm' };
  }
}

/** Async twins for the refresh, which must not block the MCP server. */
export async function loadManifest(file = MANIFEST_FILE) {
  try {
    return parseManifest(await fs.promises.readFile(file, 'utf8'));
  } catch {
    return parseManifest('{}');
  }
}

export async function saveManifest(manifest, file = MANIFEST_FILE) {
  await fs.promises.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await fs.promises.writeFile(tempFor(file), serialize(manifest));
  await fs.promises.rename(tempFor(file), file);
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
