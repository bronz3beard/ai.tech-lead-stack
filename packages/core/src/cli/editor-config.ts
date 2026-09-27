/**
 * Reads an editor's MCP config into one shape, `{ mcpServers: { name: server } }`,
 * whether it is JSON (most editors) or Continue's YAML list. doctor and init
 * both read editors through this, so they always agree on what is configured.
 */
import fs from 'node:fs';

import { listContinueServers } from '../install/continue-config.mjs';
import type { EditorConfig } from './doctor-checks.js';

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
