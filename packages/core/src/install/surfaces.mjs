/**
 * The install outputs ("surfaces") a user can choose, and how to render each
 * one from a source root (the npm package or a clone). This is the only place
 * that knows client paths and formats; `init`, `install.sh` and the refresh
 * the MCP server runs at start all render through it.
 *
 * A render is read-only and async: it returns the files the surface should
 * contain, as [{ to, content }], and writes nothing. Adding a client means
 * adding one entry to SURFACES (and its target to targets.mjs).
 *
 * Surface ids are the target ids in targets.mjs. Target paths there are
 * computed for the real home folder; `targetDir` re-roots them at `home` so
 * tests can render into a scratch home.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { renderCommands } from './ide-commands.mjs';
import { globalTargets } from './targets.mjs';

const exists = (file) =>
  fs.access(file).then(
    () => true,
    () => false
  );

/** The folder of install target `id` under `home`. */
export function targetDir(id, home = os.homedir()) {
  const target = globalTargets.find((t) => t.id === id);
  if (!target) throw new Error(`unknown install target: ${id}`);
  return path.join(home, path.relative(os.homedir(), target.path));
}

/** Cursor skills: one SKILL.md per line of .ai/cursor-skills.manifest. */
export async function cursorSkillPairs({ root, home = os.homedir() }) {
  const manifest = await fs.readFile(
    path.join(root, '.ai', 'cursor-skills.manifest'),
    'utf8'
  );
  const dir = targetDir('cursor-skills', home);
  const pairs = [];
  for (const line of manifest.split('\n').map((l) => l.trim())) {
    if (!line || line.startsWith('#')) continue;
    const [skill, rel] = line.split('|').map((part) => part.trim());
    if (skill && rel && (await exists(path.join(root, rel)))) {
      pairs.push({
        from: path.join(root, rel),
        to: path.join(dir, skill, 'SKILL.md'),
      });
    }
  }
  return pairs;
}

/** Continue prompts: each engineering workflow as a .prompt file. */
export async function continuePromptPairs({ root, home = os.homedir() }) {
  const workflows = path.join(root, '.agents', 'workflows');
  let files = [];
  try {
    files = (await fs.readdir(workflows)).filter((f) => f.endsWith('.md'));
  } catch {
    files = [];
  }
  const dir = targetDir('continue-prompts', home);
  return files.map((file) => ({
    from: path.join(workflows, file),
    to: path.join(dir, file.replace(/\.md$/, '.prompt')),
  }));
}

async function readPairs(pairs, signal) {
  const files = [];
  for (const { from, to } of pairs) {
    signal?.throwIfAborted();
    files.push({ to, content: await fs.readFile(from) });
  }
  return files;
}

/** Each surface: the editor (as `init --ide` names it) it serves, and its render. */
export const SURFACES = {
  'claude-code-commands': {
    editor: 'claude-code',
    async render({ root, home, options, signal }) {
      const { files } = await renderCommands({
        sourceDir: root,
        server: options.server,
        domains: options.domains,
        signal,
      });
      const dir = targetDir('claude-code-commands', home);
      return files.map((f) => ({
        to: path.join(dir, f.name),
        content: f.content,
      }));
    },
  },
  'cursor-skills': {
    editor: 'cursor',
    render: async ({ root, home, signal }) =>
      readPairs(await cursorSkillPairs({ root, home }), signal),
  },
  'continue-prompts': {
    editor: 'continue',
    render: async ({ root, home, signal }) =>
      readPairs(await continuePromptPairs({ root, home }), signal),
  },
};

/**
 * The surfaces an explicit install should leave in place: the ones `chosen`
 * this run, plus recorded ones whose editor this run did not look at, so
 * `init --ide cursor` never drops the Claude Code commands. A recorded
 * surface is dropped only when its editor was evaluated and not chosen.
 * Recorded file lists are not carried over (reconcile rebuilds them).
 */
export function selectSurfaces({ chosen, recorded, evaluatedEditors }) {
  const chosenIds = new Set(chosen.map((s) => s.id));
  const kept = (recorded ?? [])
    .filter(
      (s) =>
        SURFACES[s.id] &&
        !chosenIds.has(s.id) &&
        !evaluatedEditors.includes(SURFACES[s.id].editor)
    )
    .map(({ files, ...options }) => options);
  return [...chosen, ...kept];
}

/**
 * The files recorded surface `surface` ({ id, ...options }) should contain
 * when rendered from `root`.
 */
export async function renderSurface({ surface, root, home, signal }) {
  const entry = SURFACES[surface.id];
  if (!entry) throw new Error(`unknown surface: ${surface.id}`);
  return entry.render({
    root,
    home: home ?? os.homedir(),
    options: surface,
    signal,
  });
}
