/**
 * The parts of `tech-lead-stack init` beyond the MCP connection: Claude Code's
 * /tls:* commands, Cursor skills, Continue prompts, the project's workflow
 * files, and RTK. Each is a step with a one-line description for the plan and
 * an `apply` that reports what it did.
 *
 * Files are copied, not linked: npx runs the package from a cache folder npm
 * may clear. copies.mjs records each copy, so re-running init refreshes them
 * and `uninstall` removes only what init wrote and nobody changed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { copyOwned, recordFiles } from '../install/copies.mjs';
import { generateCommands } from '../install/ide-commands.mjs';
import {
  enableForClaudeCode,
  findRtk,
  installRtk,
  managedByPackageManager,
  rtkVersionAt,
  RTK_DEFAULT_DIR,
} from '../install/rtk-install.mjs';
import { RTK_VERSION } from '../install/rtk-pin.mjs';
import { globalTargets } from '../install/targets.mjs';
import {
  type EditorChange,
  commandServer,
  describeRtk,
  planRtk,
} from './init-plan.js';
import { versionAtLeast } from './doctor-checks.js';

type Manifest = { version: string | null; files: Record<string, string> };

export interface Step {
  /** Short name shown next to the result, e.g. "Cursor skills". */
  label: string;
  describe: string;
  apply: () => Promise<string>;
}

const targetPath = (id: string) =>
  globalTargets.find((t) => t.id === id)?.path as string;

/** Editors being connected (or already connected) in this run. */
const setUp = (changes: EditorChange[], editor: string) =>
  changes.some(
    (c) =>
      c.target.editor === editor && !(c.action === 'keep' && !c.connectedAs)
  );

function summarize(results: string[]): string {
  const count = (r: string) => results.filter((x) => x === r).length;
  const parts = [
    `${count('written')} copied`,
    `${count('same')} already current`,
  ];
  if (count('kept') > 0)
    parts.push(`${count('kept')} left alone (yours or a clone's link)`);
  return parts.join(', ');
}

function copyAll(
  pairs: { from: string; to: string }[],
  manifest: Manifest
): string {
  return summarize(pairs.map((p) => copyOwned({ ...p, manifest })));
}

const markdownIn = (dir: string) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
    : [];

function cursorSkillPairs(root: string) {
  const manifestFile = path.join(root, '.ai', 'cursor-skills.manifest');
  const skillsDir = targetPath('cursor-skills');
  return fs
    .readFileSync(manifestFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter(([dir, rel]) => dir && rel && fs.existsSync(path.join(root, rel)))
    .map(([dir, rel]) => ({
      from: path.join(root, rel),
      to: path.join(skillsDir, dir, 'SKILL.md'),
    }));
}

function continuePromptPairs(root: string) {
  const workflows = path.join(root, '.agents', 'workflows');
  return markdownIn(workflows).map((file) => ({
    from: path.join(workflows, file),
    to: path.join(
      targetPath('continue-prompts'),
      file.replace(/\.md$/, '.prompt')
    ),
  }));
}

const WORKFLOW_DIRS = ['workflows', 'pm-workflows', 'hr-workflows'];

function projectWorkflowPairs(root: string, projectDir: string) {
  return WORKFLOW_DIRS.flatMap((dir) =>
    markdownIn(path.join(root, '.agents', dir)).map((file) => ({
      from: path.join(root, '.agents', dir, file),
      to: path.join(projectDir, '.agents', dir, file),
    }))
  );
}

/** The current folder, when it is a project (a git repository, not home). */
export function projectDirOf(cwd: string): string | null {
  if (cwd === os.homedir() || !fs.existsSync(path.join(cwd, '.git')))
    return null;
  return cwd;
}

function claudeCodeHasRtkHook(): boolean {
  try {
    const settings = JSON.parse(
      fs.readFileSync(
        path.join(os.homedir(), '.claude', 'settings.json'),
        'utf8'
      )
    );
    return JSON.stringify(settings.hooks ?? {}).includes('rtk');
  } catch {
    return false;
  }
}

function rtkSteps(changes: EditorChange[]): { steps: Step[]; notes: string[] } {
  const binary = findRtk();
  const version = binary ? rtkVersionAt(binary) : null;
  const plan = planRtk({
    binary,
    version,
    pinned: RTK_VERSION,
    managed: binary ? managedByPackageManager(binary) : false,
    defaultDir: RTK_DEFAULT_DIR,
  });
  const line = describeRtk(plan, RTK_VERSION);
  const steps: Step[] = [];
  const notes: string[] = [];

  if (plan.action === 'managed' && line) notes.push(line);
  if (plan.action === 'install' && line) {
    steps.push({
      label: 'RTK',
      describe: line,
      apply: async () => {
        const installed = await installRtk(plan.dir);
        const running = findRtk();
        const runningVersion = running ? rtkVersionAt(running) : null;
        if (!runningVersion || !versionAtLeast(runningVersion, RTK_VERSION)) {
          return `installed ${installed}, but another copy runs first; add ${plan.dir} to the front of your PATH`;
        }
        return `RTK ${runningVersion} is ready`;
      },
    });
  }
  if (
    setUp(changes, 'claude-code') &&
    plan.action !== 'managed' &&
    !claudeCodeHasRtkHook()
  ) {
    steps.push({
      label: 'RTK in Claude Code',
      describe:
        'RTK: turn it on for Claude Code (adds its hook to ~/.claude/settings.json)',
      apply: async () => {
        const rtk = findRtk();
        if (!rtk) throw new Error('RTK is not installed');
        enableForClaudeCode(rtk);
        return 'Claude Code now runs commands through RTK';
      },
    });
  }
  return { steps, notes };
}

/** Everything beyond the MCP connections, as plan steps plus notes to show. */
export function planSurfaces({
  changes,
  root,
  projectDir,
  manifest,
  rtk,
}: {
  changes: EditorChange[];
  root: string;
  projectDir: string | null;
  manifest: Manifest;
  rtk: boolean;
}): { steps: Step[]; notes: string[] } {
  const steps: Step[] = [];
  const notes: string[] = [];

  const server = commandServer(changes);
  if (server) {
    steps.push({
      label: 'Claude Code commands',
      describe: `Claude Code: install the /tls:* commands, calling the toolbox through "${server}"`,
      apply: async () => {
        const outDir = targetPath('claude-code-commands');
        const { written } = generateCommands({
          sourceDir: root,
          outDir,
          server,
        });
        recordFiles(
          manifest,
          written.map((file: string) => path.join(outDir, file))
        );
        return `${written.length} commands; type /tls: to see them`;
      },
    });
  }
  if (setUp(changes, 'cursor')) {
    steps.push({
      label: 'Cursor skills',
      describe: 'Cursor: copy the skills into ~/.cursor/skills',
      apply: async () => copyAll(cursorSkillPairs(root), manifest),
    });
  }
  if (setUp(changes, 'continue')) {
    steps.push({
      label: 'Continue prompts',
      describe: 'Continue: copy the workflows into ~/.continue/prompts',
      apply: async () => copyAll(continuePromptPairs(root), manifest),
    });
  }
  if (projectDir) {
    const agentsDir = path.join(projectDir, '.agents');
    if (fs.existsSync(agentsDir) && fs.lstatSync(agentsDir).isSymbolicLink()) {
      notes.push(
        'This project: workflows are already linked from a clone (.agents); left as is.'
      );
    } else {
      steps.push({
        label: 'Project workflows',
        describe: `This project: copy the workflows into ${agentsDir} (Antigravity and Gemini read them there)`,
        apply: async () =>
          copyAll(projectWorkflowPairs(root, projectDir), manifest),
      });
    }
  }
  if (rtk) {
    const found = rtkSteps(changes);
    steps.push(...found.steps);
    notes.push(...found.notes);
  }
  return { steps, notes };
}
