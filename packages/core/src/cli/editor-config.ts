/**
 * Reads an editor's MCP config into one shape, `{ mcpServers: { name: server } }`,
 * whether it is JSON (most editors) or Continue's YAML list. doctor and init
 * both read editors through this, so they always agree on what is configured.
 */
import fs from 'node:fs';

import { listContinueServers } from '../install/continue-config.mjs';
import { globalTargets } from '../install/targets.mjs';
import type { EditorConfig } from './doctor-checks.js';
import type { EditorState } from './init-plan.js';

/** Every editor this toolbox supports, with whether it is installed and its config. */
export function readEditors(): EditorState[] {
  return globalTargets
    .filter((t) => t.editor)
    .map((t) => ({
      id: t.id,
      editor: t.editor as string,
      label: t.label.replace(' MCP registration', ''),
      path: t.path,
      kind: t.kind,
      installed:
        fs.existsSync(t.installedIf as string) || fs.existsSync(t.path),
      config: readEditorConfig(t),
    }));
}

export function readEditorConfig({
  path: file,
  kind,
}: {
  path: string;
  kind: string;
}): EditorConfig {
  if (!fs.existsSync(file)) return { state: 'missing' };
  try {
    const text = fs.readFileSync(file, 'utf8');
    if (kind === 'yaml-entry') {
      const servers = listContinueServers(text) as { name: string }[];
      return {
        state: 'read',
        config: {
          mcpServers: Object.fromEntries(servers.map((s) => [s.name, s])),
        },
      };
    }
    return { state: 'read', config: JSON.parse(text || '{}') };
  } catch {
    return { state: 'unreadable' };
  }
}
