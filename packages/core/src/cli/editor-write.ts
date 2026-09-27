/**
 * Adds, replaces and removes one MCP server in an editor's config, for init
 * and uninstall. JSON configs change only the named server; Continue's YAML
 * keeps the user's comments; Claude Code is changed through its own CLI when
 * installed, because it rewrites ~/.claude.json while it runs (install.sh does
 * the same).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  removeContinueServerFromFile,
  writeContinueServer,
} from '../install/continue-config.mjs';
import { updateJsonFile, withServer } from '../install/mcp-json.mjs';
import type { EditorState } from './init-plan.js';

const run = promisify(execFile);

async function hasClaudeCli(): Promise<boolean> {
  try {
    await run('claude', ['--version'], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

/** A copy of the named server's current settings ({} when absent). */
export function serverIn(
  target: EditorState,
  name: string
): Record<string, unknown> {
  const config = target.config.state === 'read' ? target.config.config : {};
  const servers = (
    config as { mcpServers?: Record<string, Record<string, unknown>> }
  ).mcpServers;
  return { ...(servers?.[name] ?? {}) };
}

export async function setServer({
  target,
  name,
  server,
}: {
  target: EditorState;
  name: string;
  server: Record<string, unknown>;
}): Promise<void> {
  if (target.kind === 'yaml-entry') {
    writeContinueServer({ file: target.path, server: { name, ...server } });
    return;
  }
  if (target.editor === 'claude-code' && (await hasClaudeCli())) {
    // add-json refuses an existing name, so an update is remove then add.
    if (Object.keys(serverIn(target, name)).length > 0) {
      await run('claude', ['mcp', 'remove', name, '--scope', 'user']);
    }
    await run('claude', [
      'mcp',
      'add-json',
      name,
      JSON.stringify(server),
      '--scope',
      'user',
    ]);
    return;
  }
  updateJsonFile(target.path, (config: object) =>
    withServer(config, name, server)
  );
}

export async function removeServer({
  target,
  name,
}: {
  target: EditorState;
  name: string;
}): Promise<void> {
  if (target.kind === 'yaml-entry') {
    removeContinueServerFromFile({ file: target.path, name });
    return;
  }
  if (target.editor === 'claude-code' && (await hasClaudeCli())) {
    await run('claude', ['mcp', 'remove', name, '--scope', 'user']);
    return;
  }
  updateJsonFile(
    target.path,
    (config: { mcpServers?: Record<string, unknown> }) => {
      const { [name]: _removed, ...rest } = config.mcpServers ?? {};
      return { ...config, mcpServers: rest };
    }
  );
}
