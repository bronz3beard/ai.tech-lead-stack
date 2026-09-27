/**
 * What `tech-lead-stack uninstall` removes from each editor: only what the npx
 * `init` added. A server started with `npx ... tech-lead-stack` is removed; a
 * gateway keeps everything except the DOWNSTREAM_MCP (and TLS_ADAPTER) init
 * set; a clone setup is left for cleanup.sh. Pure, so it can be tested.
 */
import { findToolboxEntries } from './doctor-checks.js';
import type { EditorState } from './init-plan.js';

export type UninstallChange =
  | { action: 'remove-server'; target: EditorState; name: string }
  | { action: 'detach-gateway'; target: EditorState; gateway: string }
  | { action: 'leave-clone'; target: EditorState; name: string };

type Server = {
  command?: unknown;
  args?: unknown;
  env?: Record<string, unknown>;
};

/** A server spec that starts the published package through npx. */
export function startsNpxPackage(spec: unknown): boolean {
  const { command, args } = (spec ?? {}) as Server;
  return (
    command === 'npx' &&
    Array.isArray(args) &&
    args.some((a) => typeof a === 'string' && /^tech-lead-stack(@|$)/.test(a))
  );
}

function downstreamOf(server: Server): unknown {
  const raw = server.env?.DOWNSTREAM_MCP;
  if (typeof raw !== 'string' || raw === '') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Same rule doctor uses, so the two always agree on what is the toolbox. */
const reachesToolbox = (name: string, server: Server) =>
  findToolboxEntries({ mcpServers: { [name]: server } }).length > 0;

export function planUninstall(states: EditorState[]): UninstallChange[] {
  const changes: UninstallChange[] = [];
  for (const target of states) {
    if (target.config.state !== 'read') continue;
    const servers = (
      target.config.config as { mcpServers?: Record<string, Server> }
    ).mcpServers;
    if (!servers || typeof servers !== 'object') continue;

    for (const [name, server] of Object.entries(servers)) {
      if (startsNpxPackage(server)) {
        changes.push({ action: 'remove-server', target, name });
      } else if (startsNpxPackage(downstreamOf(server))) {
        changes.push({ action: 'detach-gateway', target, gateway: name });
      } else if (reachesToolbox(name, server)) {
        changes.push({ action: 'leave-clone', target, name });
      }
    }
  }
  return changes;
}

export function describeUninstall(change: UninstallChange): string {
  const label = change.target.label;
  switch (change.action) {
    case 'remove-server':
      return `${label}: remove the "${change.name}" server`;
    case 'detach-gateway':
      return `${label}: stop your "${change.gateway}" gateway starting the toolbox (the gateway stays)`;
    case 'leave-clone':
      return `${label}: "${change.name}" was set up from a clone; left as is (use scripts/cleanup.sh in the clone)`;
  }
}

/** A gateway's env without the settings init added. */
export function withoutToolbox(
  env: Record<string, unknown> = {}
): Record<string, unknown> {
  const { DOWNSTREAM_MCP: _downstream, TLS_ADAPTER: _adapter, ...rest } = env;
  return rest;
}
