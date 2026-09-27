/**
 * Generates IDE slash commands (Claude Code's /tls:*) from the agent-agnostic
 * surface index. Used by install.sh (through scripts/generate-ide-commands.mjs)
 * and by `tech-lead-stack init`.
 *
 * Writes into a staging directory and swaps on success, so a failure part-way
 * through never leaves the user with an empty command set.
 *
 * `server` is the name the CLIENT knows the MCP server by, not the name this
 * stack registers itself under. The two differ whenever a proxy fronts the
 * stack: the gateway is what the client has registered, and the stack's tools
 * are re-exported under the gateway's name, so the correct value is the
 * gateway's (e.g. `slm-gate`, giving `mcp__slm-gate__get_skills`). Any proxy
 * behaves this way; nothing here is specific to one.
 */
import fs from 'node:fs';
import path from 'node:path';

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
function resolveToolNames(text, server) {
  const tools = MCP_TOOLS.join('|');
  // `server` comes from the command line; escape it before it goes into a RegExp.
  const serverPattern = server.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

const ARGUMENTS_BLOCK = [
  '',
  '---',
  '',
  'Additional context supplied by the user (may be empty):',
  '',
  '$ARGUMENTS',
  '',
].join('\n');

function readEntries(sourceDir) {
  const surfacesFile = path.join(sourceDir, '.ai/agent-surfaces.json');
  if (!fs.existsSync(surfacesFile)) {
    throw new Error(`surface index not found at ${surfacesFile}`);
  }
  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(surfacesFile, 'utf8')).entries;
  } catch (e) {
    throw new Error(`could not parse ${surfacesFile}: ${e.message}`);
  }
  if (!Array.isArray(entries)) {
    throw new Error(`${surfacesFile} has no entries array.`);
  }
  return entries;
}

function commandBody({ entry, sourceDir, server, agent }) {
  const workflowFile = entry.workflowPath
    ? path.join(sourceDir, entry.workflowPath)
    : null;
  if (workflowFile && fs.existsSync(workflowFile)) {
    // Use the workflow's own instructions verbatim. They carry the real
    // process (phases, gates, artifact paths) that a stub would lose.
    return resolveToolNames(
      stripFrontmatter(fs.readFileSync(workflowFile, 'utf8')),
      server
    );
  }
  if (entry.workflowPath) return null;
  return [
    `Call the \`mcp__${server}__get_skill\` tool with:`,
    `- skillName: "${entry.skill}"`,
    "- projectName: the current repository's folder name",
    '- model: the model in use for this session',
    `- agent: "${agent}"`,
    '',
    'Then execute the returned skill instructions against the current codebase.',
  ].join('\n');
}

/**
 * Writes one command file per eligible skill into `outDir`, replacing what was
 * there. Returns the file names written and the entries skipped. Throws, and
 * leaves `outDir` untouched, if nothing could be written.
 */
export function generateCommands({
  sourceDir,
  outDir,
  server = 'tech-lead-stack',
  domains = ['eng', 'pm', 'hr'],
  agent = 'claude-code',
}) {
  const eligible = readEntries(sourceDir).filter(
    (e) => e.ideEligible && domains.includes(e.domainKey)
  );
  if (eligible.length === 0) {
    throw new Error(`no eligible entries for domains: ${domains.join(',')}`);
  }

  const staging = `${outDir}.staging.${process.pid}`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  const written = [];
  const skipped = [];
  try {
    for (const entry of eligible) {
      const body = commandBody({ entry, sourceDir, server, agent });
      if (body === null) {
        skipped.push(`${entry.name} (missing ${entry.workflowPath})`);
        continue;
      }
      const description = entry.description?.trim()
        ? entry.description.trim()
        : `Run the tech-lead-stack ${entry.skill} skill`;
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
      written.push(`${entry.name}.md`);
    }
    if (written.length === 0) throw new Error('no commands were written');

    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(outDir), { recursive: true });
    fs.renameSync(staging, outDir);
  } catch (e) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw new Error(`${e.message}; ${outDir} left untouched.`);
  }
  return { written, skipped };
}
