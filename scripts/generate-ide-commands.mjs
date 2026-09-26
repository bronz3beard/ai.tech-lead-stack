#!/usr/bin/env node
/**
 * Generate IDE slash commands from the agent-agnostic surface index.
 *
 * Replaces the jq + perl pipeline that used to live inside install.sh. Node 22
 * is already a hard requirement of this repo (see package.json engines, and
 * install.sh shelling out to node and pnpm), so this removes two dependencies
 * the installer previously had to probe for, along with the perl -0pe escaping
 * that was the most fragile code in the script.
 *
 * Writes into a staging directory and swaps on success, so a failure part-way
 * through never leaves the user with an empty command set.
 *
 * Usage:
 *   node scripts/generate-ide-commands.mjs --out <dir> --server <name> \
 *        [--domains eng,pm,hr] [--source <repo root>] [--agent claude-code]
 *
 * --server is the name the CLIENT knows the MCP server by, not the name this
 * stack registers itself under. The two differ whenever a proxy fronts the
 * stack: the gateway is what the client has registered, and the stack's tools
 * are re-exported under the gateway's name, so the correct value is the
 * gateway's (e.g. `slm-gate`, giving `mcp__slm-gate__get_skills`). Any proxy
 * behaves this way — nothing here is specific to one. install.sh resolves this
 * automatically via resolve_command_server_name(); when calling this script by
 * hand, pass the name your client actually lists under /mcp.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const outDir = args.out;
const server = args.server || 'tech-lead-stack';
// `server` is a CLI argument; escape it before it goes into a RegExp.
const serverPattern = server.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const agent = args.agent || 'claude-code';
const sourceDir = args.source || repoRoot;
const domains = (args.domains || 'eng,pm,hr')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean);

if (!outDir) {
  console.error('Error: --out <dir> is required.');
  process.exit(1);
}

const surfacesFile = path.join(sourceDir, '.ai/agent-surfaces.json');
if (!fs.existsSync(surfacesFile)) {
  console.error(`Error: surface index not found at ${surfacesFile}`);
  process.exit(1);
}

let entries;
try {
  entries = JSON.parse(fs.readFileSync(surfacesFile, 'utf8')).entries;
} catch (e) {
  console.error(`Error: could not parse ${surfacesFile}: ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(entries)) {
  console.error(`Error: ${surfacesFile} has no entries array.`);
  process.exit(1);
}

/** MCP tools a workflow may reference by bare name. */
const MCP_TOOLS = [
  'get_skills',
  'get_skill',
  'list_skills',
  'verify_mission_alignment',
  'plan_pipeline',
  'approve_knowledge_item',
  'create_knowledge_item',
  'read_knowledge_item',
  'list_knowledge_items',
  'code_search',
  'repo_map',
  'read_region',
  'apply_patch',
];

/**
 * Workflows hedge about tool naming because they must serve every client
 * ("which may be prefixed as mcp_tech-lead-stack_get_skill or ..."). Resolve
 * that to the concrete name this install registers. Done here, at install time,
 * so the source workflow stays agent-agnostic and keeps working elsewhere.
 */
function resolveToolNames(text) {
  const tools = MCP_TOOLS.join('|');
  return text
    .replace(/\s*\((?:which may be (?:named|prefixed as))[^)]*\)/gs, '')
    .replace(
      new RegExp('`(' + tools + ')`', 'g'),
      (_m, t) => `\`mcp__${server}__${t}\``
    )
    .replace(
      new RegExp(
        `\\b(?:mcp_${serverPattern}_|${serverPattern}_)(${tools})\\b`,
        'g'
      ),
      (_m, t) => `mcp__${server}__${t}`
    );
}

/** Strip a leading YAML frontmatter block; ours replaces it. */
function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n\s*/, '');
}

/** Quote for a YAML double-quoted scalar: real descriptions start with "[". */
function yamlQuote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const eligible = entries.filter(
  (e) => e.ideEligible && domains.includes(e.domainKey)
);

if (eligible.length === 0) {
  console.error(`Error: no eligible entries for domains: ${domains.join(',')}`);
  process.exit(1);
}

const staging = `${outDir}.staging.${process.pid}`;
fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });

const ARGUMENTS_BLOCK = [
  '',
  '---',
  '',
  'Additional context supplied by the user (may be empty):',
  '',
  '$ARGUMENTS',
  '',
].join('\n');

let written = 0;
const skipped = [];

try {
  for (const entry of eligible) {
    const description = entry.description?.trim()
      ? entry.description.trim()
      : `Run the tech-lead-stack ${entry.skill} skill`;

    let body;
    const workflowFile = entry.workflowPath
      ? path.join(sourceDir, entry.workflowPath)
      : null;

    if (workflowFile && fs.existsSync(workflowFile)) {
      // Use the workflow's own instructions verbatim. They carry the real
      // process (phases, gates, artifact paths) that a stub would lose.
      body = resolveToolNames(
        stripFrontmatter(fs.readFileSync(workflowFile, 'utf8'))
      );
    } else if (entry.workflowPath) {
      skipped.push(`${entry.name} (missing ${entry.workflowPath})`);
      continue;
    } else {
      body = [
        `Call the \`mcp__${server}__get_skill\` tool with:`,
        `- skillName: "${entry.skill}"`,
        "- projectName: the current repository's folder name",
        '- model: the model in use for this session',
        `- agent: "${agent}"`,
        '',
        'Then execute the returned skill instructions against the current codebase.',
      ].join('\n');
    }

    const file = [
      '---',
      `description: ${yamlQuote(description)}`,
      'argument-hint: "[optional context, story, or slice]"',
      '---',
      '',
      body.trimEnd(),
      ARGUMENTS_BLOCK,
    ].join('\n');

    fs.writeFileSync(path.join(staging, `${entry.name}.md`), file);
    written += 1;
  }

  if (written === 0) {
    throw new Error('no commands were written');
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(outDir), { recursive: true });
  fs.renameSync(staging, outDir);
} catch (e) {
  fs.rmSync(staging, { recursive: true, force: true });
  console.error(`Error: ${e.message} — ${outDir} left untouched.`);
  process.exit(1);
}

console.log(`${written}`);
if (skipped.length > 0) {
  console.error(`   ⚠️  Skipped ${skipped.length}: ${skipped.join(', ')}`);
}
