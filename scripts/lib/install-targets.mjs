/**
 * Single source of truth for everything install.sh writes.
 *
 * Both the installer and the cleaner read this. Before it existed each script
 * hardcoded its own list, so cleanup drifted four adapters behind the installer
 * and left slash commands and MCP registrations behind after an uninstall.
 *
 * Adding a new IDE adapter means adding one entry here, not editing two scripts.
 */

import os from 'node:os';
import path from 'node:path';

const home = os.homedir();
const isMac = process.platform === 'darwin';

/** VS Code-family roots that may host a Cline install. */
const vscodeVariants = ['Code', 'Code - Insiders', 'VSCodium', 'Cursor'];
const vscodeBase = isMac
  ? path.join(home, 'Library', 'Application Support')
  : path.join(home, '.config');

/**
 * Global targets: written once, serve every linked project. Cleaning these is
 * opt-in (`--global`) precisely because one install serves many projects, so
 * removing a single project must never unregister the machine.
 *
 * kind:
 *   'mcp-entry' — a JSON file with an mcpServers map; remove our key only.
 *   'directory' — generated output we own entirely; safe to delete.
 *   'glob-dir'  — a directory whose matching files we own.
 *   'rc-alias'  — a line appended to a shell rc file.
 */
export const globalTargets = [
  {
    id: 'claude-code-commands',
    label: 'Claude Code slash commands',
    kind: 'directory',
    path: path.join(home, '.claude', 'commands', 'tls'),
  },
  {
    id: 'claude-code-mcp',
    label: 'Claude Code MCP registration',
    kind: 'mcp-entry',
    path: path.join(home, '.claude.json'),
  },
  {
    id: 'claude-desktop-mcp',
    label: 'Claude Desktop MCP registration',
    kind: 'mcp-entry',
    path: isMac
      ? path.join(
          home,
          'Library',
          'Application Support',
          'Claude',
          'claude_desktop_config.json'
        )
      : path.join(home, '.config', 'Claude', 'claude_desktop_config.json'),
  },
  {
    id: 'cursor-mcp',
    label: 'Cursor MCP registration',
    kind: 'mcp-entry',
    path: path.join(home, '.cursor', 'mcp.json'),
  },
  {
    id: 'cursor-skills',
    label: 'Cursor skill symlinks',
    kind: 'glob-dir',
    path: path.join(home, '.cursor', 'skills'),
    ownedIf: 'symlink',
  },
  {
    id: 'continue-prompts',
    label: 'Continue prompt symlinks',
    kind: 'glob-dir',
    path: path.join(home, '.continue', 'prompts'),
    ownedIf: 'symlink',
  },
  {
    id: 'gemini-mcp',
    label: 'Gemini (CLI/Desktop) MCP registration',
    kind: 'mcp-entry',
    path: path.join(home, '.gemini', 'settings.json'),
  },
  ...vscodeVariants.map((variant) => ({
    id: `cline-mcp-${variant.toLowerCase().replace(/\W+/g, '-')}`,
    label: `Cline MCP registration (${variant})`,
    kind: 'mcp-entry',
    path: path.join(
      vscodeBase,
      variant,
      'User',
      'globalStorage',
      'saoudrizwan.claude-dev',
      'settings',
      'cline_mcp_settings.json'
    ),
  })),
  {
    id: 'zshrc-alias',
    label: 'rtk alias in ~/.zshrc',
    kind: 'rc-alias',
    path: path.join(home, '.zshrc'),
  },
  {
    id: 'bashrc-alias',
    label: 'rtk alias in ~/.bashrc',
    kind: 'rc-alias',
    path: path.join(home, '.bashrc'),
  },
];

/**
 * Project targets: written inside the linked repository. These are what the
 * default (project-only) clean removes.
 *
 * kind:
 *   'symlink'  — only removed when it is actually a symlink.
 *   'copy'     — a file copied from the stack; removed when it still matches
 *                the shipped original, so local edits are never destroyed.
 *   'rtk'      — created by `rtk init`.
 */
export const projectTargets = [
  { id: 'ai', label: '.ai', kind: 'symlink', path: '.ai' },
  { id: 'agents', label: '.agents', kind: 'symlink', path: '.agents' },
  { id: 'agents-md', label: 'AGENTS.md', kind: 'symlink', path: 'AGENTS.md' },
  { id: 'rtk-dir', label: '.rtk', kind: 'symlink', path: '.rtk' },
  { id: 'rtk-json', label: 'rtk.json', kind: 'rtk', path: 'rtk.json' },
  {
    id: 'pr-template',
    label: '.github/PULL_REQUEST_TEMPLATE.md',
    kind: 'copy',
    path: '.github/PULL_REQUEST_TEMPLATE.md',
    source: 'templates/PULL_REQUEST_TEMPLATE.md',
  },
  {
    id: 'design-review-workflow',
    label: '.github/workflows/design-review-trigger.yml',
    kind: 'copy',
    path: '.github/workflows/design-review-trigger.yml',
    source: 'docs/github-action-example.yml',
  },
];

/** Directories that should be removed only once they are empty. */
export const pruneIfEmpty = ['.github/workflows', '.github'];

/** The alias line install.sh appends to shell rc files. */
export function aliasLine(sourceDir) {
  return `alias rtk='${sourceDir}/scripts/rtk-run.sh'`;
}
