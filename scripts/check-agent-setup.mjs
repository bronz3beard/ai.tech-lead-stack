#!/usr/bin/env node
/**
 * Keeps the AI setup prompt (docs/agent-setup.md) and the migration guide
 * (docs/switch-to-npm.md) true to the code.
 *
 * The prompt tells assistants to use only what its ALLOWED list names. This
 * fails CI when that list, or a /tls: command or guide link anywhere in the
 * prompt, names something that doesn't exist, and when a tool, init option,
 * app name or tier exists but the list leaves it out. It also fails when it
 * finds nothing to check, so it can't pass by reading the wrong thing.
 *
 * Usage: node scripts/check-agent-setup.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { globalTargets } from '../packages/core/src/install/targets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const REPO_URL = 'https://github.com/bronz3beard/ai.tech-lead-stack/blob/main/';

const LABELS = [
  'Commands',
  'init options',
  'doctor options',
  'uninstall options',
  'cleanup.sh options',
  'App names for --ide',
  'Settings',
  'Toolbox tools',
  'Tiers',
  'Web app pages',
];

/** The text of the ```text block under "## The prompt". */
export function extractPrompt(markdown) {
  const match = markdown.match(/## The prompt[\s\S]*?```text\n([\s\S]*?)\n```/);
  return match ? match[1] : '';
}

/** Backticked items per ALLOWED label. */
export function parseAllowed(prompt) {
  const allowed = prompt.split(/^ALLOWED$/m)[1] ?? '';
  const groups = {};
  for (const label of LABELS) {
    const others = LABELS.filter((l) => l !== label)
      .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const pattern = new RegExp(
      `${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:([\\s\\S]*?)(?=(?:${others}):|Anything not in this list|$)`
    );
    const body = allowed.match(pattern)?.[1] ?? '';
    groups[label] = [...body.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  }
  return groups;
}

/** What actually exists, read from the code. */
export function gatherFacts() {
  const indexSource = read('packages/core/src/mcp-server/index.ts');
  const tierSource = read('packages/core/src/lib/ai/tier-policy.ts');
  const surfaces = JSON.parse(read('.ai/agent-surfaces.json')).entries;
  return {
    tools: [...indexSource.matchAll(/^\s*name: '([a-z_]+)'/gm)].map(
      (m) => m[1]
    ),
    usage:
      read('packages/core/src/cli/main.ts').match(
        /const USAGE = `([\s\S]*?)`;/
      )?.[1] ?? '',
    cleanupUsage: read('scripts/cleanup.sh'),
    editors: [
      ...new Set(globalTargets.filter((t) => t.editor).map((t) => t.editor)),
    ],
    envExample: read('.env.example'),
    tiers: [
      ...(tierSource.match(/export type Tier = ([^;]+);/)?.[1] ?? '').matchAll(
        /'([a-z-]+)'/g
      ),
    ].map((m) => m[1]),
    commands: surfaces.filter((e) => e.ideEligible).map((e) => e.name),
    pageExists: (page) =>
      fs.existsSync(path.join(ROOT, 'apps/dashboard/src/app', page)),
    fileExists: (rel) => fs.existsSync(path.join(ROOT, rel)),
  };
}

const missing = (names, known) => names.filter((n) => !known.includes(n));

/** Every way the prompt disagrees with the code, as plain sentences. */
export function findProblems(prompt, facts) {
  const problems = [];
  const allowed = parseAllowed(prompt);
  for (const label of LABELS) {
    if (allowed[label].length === 0)
      problems.push(`ALLOWED "${label}" lists nothing.`);
  }
  const report = (what, names) => {
    if (names.length > 0) problems.push(`${what}: ${names.join(', ')}`);
  };

  // Two-way: these lists must match the code exactly.
  report(
    'Tools the prompt names that the server does not register',
    missing(allowed['Toolbox tools'], facts.tools)
  );
  report(
    'Tools the server registers that the prompt leaves out',
    missing(facts.tools, allowed['Toolbox tools'])
  );
  report(
    'App names that init does not know',
    missing(allowed['App names for --ide'], facts.editors)
  );
  report(
    'Apps init supports that the prompt leaves out',
    missing(facts.editors, allowed['App names for --ide'])
  );
  report('Tiers that do not exist', missing(allowed.Tiers, facts.tiers));
  report('Tiers the prompt leaves out', missing(facts.tiers, allowed.Tiers));

  const cliOptions = [
    ...allowed['init options'],
    ...allowed['doctor options'],
    ...allowed['uninstall options'],
  ];
  report(
    'Options the tech-lead-stack command does not have',
    cliOptions.filter((o) => !facts.usage.includes(o))
  );
  const usageOptions = [
    ...new Set(facts.usage.match(/--[a-z-]+/g) ?? []),
  ].filter((o) => o !== '--version');
  report(
    'Options the tech-lead-stack command has that the prompt leaves out',
    missing(usageOptions, cliOptions)
  );
  report(
    'cleanup.sh options that do not exist',
    allowed['cleanup.sh options'].filter((o) => !facts.cleanupUsage.includes(o))
  );

  report(
    'Settings that .env.example does not list',
    allowed.Settings.filter(
      (s) => !new RegExp(`\\b${s}\\b`).test(facts.envExample)
    )
  );
  report(
    'Web app pages that do not exist',
    allowed['Web app pages'].filter((p) => !facts.pageExists(p.slice(1)))
  );

  // Anywhere in the prompt.
  const tlsCommands = [
    ...new Set([...prompt.matchAll(/\/tls:([a-z0-9-]+)/g)].map((m) => m[1])),
  ];
  if (tlsCommands.length === 0)
    problems.push('The prompt names no /tls: commands.');
  report(
    '/tls: commands that do not exist',
    missing(tlsCommands, facts.commands)
  );

  const guides = [...prompt.matchAll(new RegExp(`${REPO_URL}(\\S+)`, 'g'))].map(
    (m) => m[1]
  );
  if (guides.length === 0) problems.push('The prompt links no guides.');
  report(
    'Guide links to files that do not exist',
    guides.filter((g) => !facts.fileExists(g))
  );

  return problems;
}

/**
 * The migration guide (docs/switch-to-npm.md): every `tech-lead-stack` command
 * and option, every cleanup.sh option, and every link to this repository must
 * exist. Relative links resolve from docs/.
 */
export function findGuideProblems(guide, facts) {
  const problems = [];
  const report = (what, names) => {
    if (names.length > 0)
      problems.push(`${what}: ${[...new Set(names)].join(', ')}`);
  };

  const commands = [
    ...guide.matchAll(/npx -y tech-lead-stack@1 ([a-z-]+)((?:\s+--[a-z-]+)*)/g),
  ];
  if (commands.length === 0)
    problems.push('The guide runs no tech-lead-stack commands.');
  report(
    'Guide commands the tech-lead-stack command does not have',
    commands
      .map((m) => m[1])
      .filter((c) => !new RegExp(`^\\s+${c}\\b`, 'm').test(facts.usage))
  );
  report(
    'Guide options the tech-lead-stack command does not have',
    commands
      .flatMap((m) => m[2].trim().split(/\s+/).filter(Boolean))
      .filter((o) => !facts.usage.includes(o))
  );

  const cleanupOptions = [
    ...guide.matchAll(/cleanup\.sh"?((?:\s+--[a-z-]+)*)/g),
  ].flatMap((m) => m[1].trim().split(/\s+/).filter(Boolean));
  report(
    'Guide cleanup.sh options that do not exist',
    cleanupOptions.filter((o) => !facts.cleanupUsage.includes(o))
  );

  const links = [
    ...[...guide.matchAll(/\]\((?!https?:|#|mailto:)([^)#\s]+)/g)].map((m) =>
      path.posix.join('docs', m[1])
    ),
    ...[...guide.matchAll(new RegExp(`${REPO_URL}([^)#\\s]+)`, 'g'))].map(
      (m) => m[1]
    ),
  ];
  report(
    'Guide links to files that do not exist',
    links.filter((l) => !facts.fileExists(l))
  );
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const prompt = extractPrompt(read('docs/agent-setup.md'));
  if (!prompt) {
    console.error(
      'docs/agent-setup.md: no ```text block under "## The prompt".'
    );
    process.exit(1);
  }
  const facts = gatherFacts();
  const problems = [
    ...findProblems(prompt, facts).map((p) => `docs/agent-setup.md: ${p}`),
    ...findGuideProblems(read('docs/switch-to-npm.md'), facts).map(
      (p) => `docs/switch-to-npm.md: ${p}`
    ),
  ];
  if (problems.length > 0) {
    console.error('The AI setup prompt or the switch guide is out of date:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  const count = Object.values(parseAllowed(prompt)).flat().length;
  console.log(
    `AI setup prompt: all ${count} allowed names, /tls: commands and guide links exist. Switch guide: commands, options and links exist.`
  );
}
