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
 * Prints the number of commands written. Exits 1, leaving --out untouched, on
 * any failure.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateCommands } from '../packages/core/src/install/ide-commands.mjs';

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

try {
  const { written, skipped } = generateCommands({
    sourceDir: args.source || repoRoot,
    outDir: args.out,
    server: args.server || 'tech-lead-stack',
    agent: args.agent || 'claude-code',
    domains: (args.domains || 'eng,pm,hr')
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean),
  });
  console.log(`${written.length}`);
  if (skipped.length > 0) {
    console.error(`   ⚠️  Skipped ${skipped.length}: ${skipped.join(', ')}`);
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
