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

import { copyOwned } from '../install/copies.mjs';
import { installSurfaces } from '../install/reconcile.mjs';
import {
  enableForClaudeCode,
  findRtk,
  installRtk,
  managedByPackageManager,
  rtkVersionAt,
  RTK_DEFAULT_DIR,
} from '../install/rtk-install.mjs';
import { RTK_VERSION } from '../install/rtk-pin.mjs';
import { selectSurfaces } from '../install/surfaces.mjs';
import {
  type EditorChange,
  commandServer,
  describeRtk,
  planRtk,
} from './init-plan.js';
import { versionAtLeast } from './doctor-checks.js';

/** A recorded install output (see install/surfaces.mjs). */
type Surface = {
  id: string;
  server?: string;
  domains?: string[];
  files?: string[];
};

type Manifest = {
  version: string | null;
  files: Record<string, string>;
  source?: unknown;
  surfaces?: Surface[] | null;
  lastRefresh?: unknown;
};

export interface Step {
  /** Short name shown next to the result, e.g. "Cursor skills". */
  label: string;
  describe: string;
  apply: () => Promise<string>;
}

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

type InstallSummary = {
  written: string[];
  adopted: string[];
  removed: string[];
  kept: { to: string; reason: string }[];
};

function describeInstall(summary: InstallSummary, backupDir: string | null) {
  const parts = [
    `${summary.written.length} written`,
    `${summary.adopted.length} already current`,
  ];
  if (summary.removed.length > 0)
    parts.push(`${summary.removed.length} removed`);
  if (summary.kept.length > 0)
    parts.push(`${summary.kept.length} left alone (yours or a clone's link)`);
  if (backupDir) parts.push(`your edited copies saved in ${backupDir}`);
  return parts.join(', ');
}

const markdownIn = (dir: string) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
    : [];

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

  // Editor files (Claude Code commands, Cursor skills, Continue prompts) are
  // rendered, reconciled and recorded together, so the record says exactly
  // what this install chose.
  const chosen: Surface[] = [];
  const wanted: string[] = [];
  const server = commandServer(changes);
  if (server) {
    chosen.push({
      id: 'claude-code-commands',
      server,
      domains: ['eng', 'pm', 'hr'],
    });
    wanted.push(
      `Claude Code: the /tls:* commands, calling the toolbox through "${server}"`
    );
  }
  if (setUp(changes, 'cursor')) {
    chosen.push({ id: 'cursor-skills' });
    wanted.push('Cursor: the skills in ~/.cursor/skills');
  }
  if (setUp(changes, 'continue')) {
    chosen.push({ id: 'continue-prompts' });
    wanted.push('Continue: the workflows in ~/.continue/prompts');
  }
  const evaluatedEditors = changes.map((c) => c.target.editor);
  if (chosen.length > 0 || (manifest.surfaces?.length ?? 0) > 0) {
    steps.push({
      label: 'Editor files',
      describe: wanted.length > 0 ? wanted.join('; ') : 'Editor files: tidy up',
      apply: async () => {
        // Selected here, not when planning: init re-reads the record under the
        // lock just before this runs, and another install may have recorded a
        // surface meanwhile that must not be treated as dropped.
        const surfaces: Surface[] = selectSurfaces({
          chosen,
          recorded: manifest.surfaces,
          evaluatedEditors,
        });
        const result = await installSurfaces({
          record: manifest,
          surfaces,
          root,
        });
        Object.assign(manifest, result.record);
        if (result.error) throw new Error(result.error);
        return describeInstall(result.summary, result.backupDir);
      },
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
