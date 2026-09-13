#!/usr/bin/env node
/**
 * Remove the machine-wide state install.sh wrote: MCP registrations, generated
 * slash commands, symlinked skills and prompts, and the shell alias.
 *
 * This is deliberately NOT part of the default clean. One global install serves
 * every linked project, so unlinking a single project must never unregister the
 * machine. cleanup.sh only calls this when the user passes --global.
 *
 * Targets come from scripts/lib/install-targets.mjs so the installer and the
 * cleaner can never drift apart.
 *
 * Usage:
 *   node scripts/uninstall-global.mjs --source <repo root> [--apply] [--json]
 *
 * Defaults to a dry run. --apply is required to delete anything.
 */

import fs from 'node:fs';
import path from 'node:path';
import { globalTargets, aliasLine } from './lib/install-targets.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    args[key] = next && !next.startsWith('--') ? ((i += 1), next) : true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const apply = args.apply === true;
const sourceDir =
  typeof args.source === 'string' ? path.resolve(args.source) : null;

if (!sourceDir) {
  console.error('Error: --source <repo root> is required.');
  process.exit(1);
}

const actions = [];
const record = (label, detail) => actions.push({ label, detail });

/** Back up a file once per run before the first destructive edit. */
function backup(file) {
  if (!apply) return;
  const dest = `${file}.bak`;
  try {
    if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
  } catch {
    /* a missing backup must never block the removal */
  }
}

/** Remove any mcpServers entry whose config points at this checkout. */
function cleanMcpEntry(target) {
  if (!fs.existsSync(target.path)) return;

  let config;
  try {
    config = JSON.parse(fs.readFileSync(target.path, 'utf8') || '{}');
  } catch {
    record(target.label, `SKIPPED (unparseable JSON): ${target.path}`);
    return;
  }

  const servers = config.mcpServers;
  if (!servers || typeof servers !== 'object') return;

  const ours = Object.keys(servers).filter((name) =>
    JSON.stringify(servers[name]).includes(sourceDir)
  );
  if (ours.length === 0) return;

  record(target.label, `${ours.join(', ')} in ${target.path}`);
  if (!apply) return;

  backup(target.path);
  for (const name of ours) delete servers[name];
  // Only our keys are touched; account and session state in the same file survive.
  const tmp = `${target.path}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`);
  fs.renameSync(tmp, target.path);
}

/** Remove a directory of generated output we own outright. */
function cleanDirectory(target) {
  if (!fs.existsSync(target.path)) return;
  const count = fs.readdirSync(target.path).length;
  record(target.label, `${count} file(s) in ${target.path}`);
  if (apply) fs.rmSync(target.path, { recursive: true, force: true });
}

/** Remove only the symlinks inside a shared directory that point at this repo. */
function cleanGlobDir(target) {
  if (!fs.existsSync(target.path)) return;

  const owned = [];
  for (const name of fs.readdirSync(target.path)) {
    const entry = path.join(target.path, name);
    try {
      const stat = fs.lstatSync(entry);
      if (!stat.isSymbolicLink()) {
        // Cursor nests one directory deep: <skill>/SKILL.md
        if (stat.isDirectory()) {
          const inner = path.join(entry, 'SKILL.md');
          if (
            fs.existsSync(inner) &&
            fs.lstatSync(inner).isSymbolicLink() &&
            fs.readlinkSync(inner).startsWith(sourceDir)
          ) {
            owned.push(entry);
          }
        }
        continue;
      }
      if (fs.readlinkSync(entry).startsWith(sourceDir)) owned.push(entry);
    } catch {
      /* unreadable entry: leave it alone */
    }
  }

  if (owned.length === 0) return;
  record(target.label, `${owned.length} link(s) in ${target.path}`);
  if (apply)
    for (const entry of owned)
      fs.rmSync(entry, { recursive: true, force: true });
}

/** Strip the alias line (and the comment above it) from a shell rc file. */
function cleanRcAlias(target) {
  if (!fs.existsSync(target.path)) return;

  const wanted = aliasLine(sourceDir);
  const lines = fs.readFileSync(target.path, 'utf8').split('\n');
  const index = lines.findIndex((line) => line.trim() === wanted);
  if (index === -1) return;

  record(target.label, target.path);
  if (!apply) return;

  backup(target.path);
  let from = index;
  // install.sh writes a "# Tech-Lead Stack..." comment immediately above it.
  if (from > 0 && lines[from - 1].trim().startsWith('# Tech-Lead Stack'))
    from -= 1;
  if (from > 0 && lines[from - 1].trim() === '') from -= 1;
  lines.splice(from, index - from + 1);
  fs.writeFileSync(target.path, lines.join('\n'));
}

for (const target of globalTargets) {
  switch (target.kind) {
    case 'mcp-entry':
      cleanMcpEntry(target);
      break;
    case 'directory':
      cleanDirectory(target);
      break;
    case 'glob-dir':
      cleanGlobDir(target);
      break;
    case 'rc-alias':
      cleanRcAlias(target);
      break;
    default:
      break;
  }
}

if (args.json) {
  console.log(JSON.stringify(actions));
} else if (actions.length === 0) {
  console.log('   - No global tech-lead-stack state found.');
} else {
  const verb = apply ? 'Removed' : 'Would remove';
  for (const a of actions)
    console.log(`   ${apply ? '🗑️ ' : '•'} ${verb}: ${a.label} — ${a.detail}`);
}

process.exit(0);
