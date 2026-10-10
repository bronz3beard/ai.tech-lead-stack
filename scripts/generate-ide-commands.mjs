#!/usr/bin/env node
/**
 * Generate IDE slash commands from the agent-agnostic surface index.
 *
 * Command-line wrapper for install.sh. The generator itself lives in
 * packages/core/src/install/ide-commands.mjs, shared with
 * `tech-lead-stack init`, so both install paths write identical commands.
 *
 * Usage:
 *   node scripts/generate-ide-commands.mjs --out <dir> --server <name> \
 *        [--domains eng,pm,hr] [--source <repo root>] [--agent claude-code]
 *
 * --server is the name the CLIENT knows the MCP server by (a gateway's name
 * when one fronts the stack). install.sh resolves this automatically via
 * resolve_command_server_name(); when calling this script by hand, pass the
 * name your client actually lists under /mcp.
 *
 * --record (what install.sh passes): write through the install engine instead,
 * and record this clone in ~/.tech-lead-stack/installed.json, so the MCP
 * server running from this clone keeps the commands current by itself. Files
 * you edited are copied to ~/.tech-lead-stack/backup/ before being replaced.
 * --out must then be the standard folder (~/.claude/commands/tls).
 *
 * Prints the number of commands written. Exits 1, leaving --out untouched, on
 * any failure.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadManifest,
  saveManifest,
} from '../packages/core/src/install/copies.mjs';
import { generateCommands } from '../packages/core/src/install/ide-commands.mjs';
import { waitForLock } from '../packages/core/src/install/lock.mjs';
import { installSurfaces } from '../packages/core/src/install/reconcile.mjs';
import { targetDir } from '../packages/core/src/install/surfaces.mjs';
import { packageVersion } from '../packages/core/src/install/version.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    args[key] = next && !next.startsWith('--') ? ((i += 1), next) : 'true';
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.out) {
  console.error('Error: --out <dir> is required.');
  process.exit(1);
}

/** --record: write through the install engine and record this clone. */
async function installRecorded({ sourceDir, outDir, server, domains }) {
  const standard = targetDir('claude-code-commands');
  if (path.resolve(outDir) !== standard) {
    throw new Error(`--record writes ${standard}; got --out ${outDir}`);
  }
  const lock = await waitForLock({
    onWait: () =>
      console.error(
        '   - waiting for another tech-lead-stack process to finish updating editor files...'
      ),
  });
  try {
    const result = await installSurfaces({
      record: await loadManifest(),
      surfaces: [{ id: 'claude-code-commands', server, domains }],
      root: sourceDir,
    });
    if (!(await lock.verify())) {
      throw new Error('lost the install lock; nothing recorded');
    }
    await saveManifest({ ...result.record, version: await packageVersion() });
    if (result.error) throw new Error(result.error);
    if (result.backupDir) {
      console.error(
        `   - your edited commands were saved in ${result.backupDir}`
      );
    }
    return result.record.surfaces[0].files.length;
  } finally {
    await lock.release();
  }
}

const options = {
  sourceDir: args.source || repoRoot,
  outDir: args.out,
  server: args.server || 'tech-lead-stack',
  domains: (args.domains || 'eng,pm,hr')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean),
};

try {
  if (args.record === 'true') {
    console.log(`${await installRecorded(options)}`);
  } else {
    const { written, skipped } = await generateCommands({
      ...options,
      agent: args.agent || 'claude-code',
    });
    console.log(`${written.length}`);
    if (skipped.length > 0) {
      console.error(`   ⚠️  Skipped ${skipped.length}: ${skipped.join(', ')}`);
    }
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
