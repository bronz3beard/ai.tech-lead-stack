/**
 * Installs or updates RTK for `tech-lead-stack init`, with the same safety as
 * install.sh: the installer script is pinned to a commit and hash-checked
 * before it runs, and RTK_VERSION pins the release it downloads (which the
 * installer checksum-verifies itself). See rtk-pin.mjs.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { hashOf } from './copies.mjs';
import {
  RTK_INSTALLER_SHA256,
  RTK_INSTALLER_URL,
  RTK_VERSION,
} from './rtk-pin.mjs';

const DEFAULT_DIR = path.join(os.homedir(), '.local', 'bin');

/** The rtk that runs when someone types `rtk`, or null. */
export function findRtk() {
  const probe = spawnSync('sh', ['-c', 'command -v rtk'], { encoding: 'utf8' });
  const found = probe.status === 0 ? probe.stdout.trim() : '';
  return found ? fs.realpathSync(found) : null;
}

export function rtkVersionAt(binary) {
  try {
    const out = execFileSync(binary, ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    return out.trim().split(/\s+/).pop() ?? null;
  } catch {
    return null;
  }
}

/** A package manager owns this copy; installing a second one would hide behind it. */
export const managedByPackageManager = (binary) =>
  /\/(Cellar|homebrew|linuxbrew)\//.test(binary);

/**
 * Downloads, verifies and runs the pinned installer into `dir`. Throws, running
 * nothing, if the download fails or the hash does not match. Returns the
 * installed binary's path.
 */
export async function installRtk(dir = DEFAULT_DIR) {
  const response = await fetch(RTK_INSTALLER_URL);
  if (!response.ok) {
    throw new Error(
      `could not download the RTK installer (${response.status})`
    );
  }
  const script = Buffer.from(await response.arrayBuffer());
  if (hashOf(script) !== RTK_INSTALLER_SHA256) {
    throw new Error(
      'the RTK installer did not match its expected hash; it was not run'
    );
  }

  const tmp = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-')),
    'install.sh'
  );
  fs.writeFileSync(tmp, script);
  try {
    const result = spawnSync('sh', [tmp], {
      stdio: 'inherit',
      env: { ...process.env, RTK_VERSION, RTK_INSTALL_DIR: dir },
    });
    if (result.status !== 0) throw new Error('the RTK installer failed');
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  }
  return path.join(dir, 'rtk');
}

/** Turns on RTK's hook for Claude Code, machine-wide (as `rtk init` does per project). */
export function enableForClaudeCode(binary) {
  const result = spawnSync(binary, ['init', '--global', '--auto-patch'], {
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('`rtk init --global` failed');
}

export { DEFAULT_DIR as RTK_DEFAULT_DIR };
