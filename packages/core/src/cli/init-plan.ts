/**
 * What `tech-lead-stack init` will change in each editor, decided from plain
 * values so it can be tested without touching a real config. init.ts reads the
 * editors, shows this plan, asks once, then applies it.
 *
 * Rules, in order:
 *   1. An editor whose config can't be read is left alone.
 *   2. An editor that already reaches the toolbox (directly or through a
 *      gateway) is left alone; a clone setup is never replaced with npx.
 *   3. If the editor has a gateway with nothing behind it yet (slm-gate, or
 *      any server with an empty DOWNSTREAM_MCP), the toolbox goes behind it,
 *      so the tools are not listed twice.
 *   4. Otherwise the toolbox is added as its own server.
 */
import { type EditorConfig, findToolboxEntries } from './doctor-checks.js';

export const SERVER_NAME = 'tech-lead-stack';

export interface ServerSpec {
  command: string;
  args: string[];
}

export interface EditorState {
  id: string;
  editor: string;
  label: string;
  path: string;
  kind: string;
  installed: boolean;
  config: EditorConfig;
}

export type EditorChange =
  | { action: 'add'; target: EditorState; name: string; server: ServerSpec }
  | {
      action: 'behind-gateway';
      target: EditorState;
      gateway: string;
      env: Record<string, string>;
    }
  | { action: 'keep'; target: EditorState; reason: string };

export interface PlanOptions {
  /** Editor names from --ide, or 'auto' for every installed editor. */
  editors: string[] | 'auto';
  /** A gateway server name from --gateway, 'auto', or 'none'. */
  gateway: string;
  server: ServerSpec;
}

type Server = {
  command?: unknown;
  args?: unknown;
  env?: Record<string, unknown>;
};

const looksLikeSlmGate = (server: Server) =>
  /slm-gate|mcp-gate/.test(JSON.stringify([server.command, server.args]));

/** Gateways in a config with nothing behind them yet. */
export function freeGateways(config: unknown): string[] {
  const servers = (config as { mcpServers?: Record<string, Server> } | null)
    ?.mcpServers;
  if (!servers || typeof servers !== 'object') return [];
  return Object.entries(servers)
    .filter(([, server]) => {
      const downstream = server?.env?.DOWNSTREAM_MCP;
      return (
        downstream === '' ||
        (downstream === undefined && looksLikeSlmGate(server))
      );
    })
    .map(([name]) => name);
}

function gatewayEnv(config: unknown, gateway: string, server: ServerSpec) {
  const entry = (config as { mcpServers: Record<string, Server> }).mcpServers[
    gateway
  ];
  return {
    DOWNSTREAM_MCP: JSON.stringify(server),
    // slm-gate's switch for this toolbox's payloads.
    ...(looksLikeSlmGate(entry) ? { TLS_ADAPTER: 'on' } : {}),
  };
}

/** With 'auto', only an unambiguous single gateway is used. */
function pickGateway(free: string[], wanted: string): string | undefined {
  if (wanted === 'auto') return free.length === 1 ? free[0] : undefined;
  return free.includes(wanted) ? wanted : undefined;
}

function planOne(target: EditorState, options: PlanOptions): EditorChange {
  if (target.config.state === 'unreadable') {
    return {
      action: 'keep',
      target,
      reason: `can't read ${target.path}; fix it first`,
    };
  }
  const config = target.config.state === 'read' ? target.config.config : {};
  const existing = findToolboxEntries(config);
  if (existing.length > 0) {
    const via =
      existing[0].via === 'gateway'
        ? `through "${existing[0].name}"`
        : `as "${existing[0].name}"`;
    return { action: 'keep', target, reason: `already connected ${via}` };
  }

  if (options.gateway !== 'none') {
    const chosen = pickGateway(freeGateways(config), options.gateway);
    if (chosen) {
      return {
        action: 'behind-gateway',
        target,
        gateway: chosen,
        env: gatewayEnv(config, chosen, options.server),
      };
    }
  }
  return { action: 'add', target, name: SERVER_NAME, server: options.server };
}

export function planEditors(
  states: EditorState[],
  options: PlanOptions
): EditorChange[] {
  const selected = states.filter((s) =>
    options.editors === 'auto'
      ? s.installed
      : options.editors.includes(s.editor)
  );
  return selected.map((s) => planOne(s, options));
}

export function describeChange(change: EditorChange): string {
  const label = change.target.label;
  switch (change.action) {
    case 'add':
      return `${label}: add the toolbox (${change.target.path})`;
    case 'behind-gateway':
      return `${label}: put the toolbox behind your "${change.gateway}" gateway, so its tools are not listed twice`;
    case 'keep':
      return `${label}: no change, ${change.reason}`;
  }
}

/** Editor names --ide accepts, for the error message on a typo. */
export const editorNames = (states: EditorState[]) => [
  ...new Set(states.map((s) => s.editor)),
];
