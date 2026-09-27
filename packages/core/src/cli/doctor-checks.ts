/**
 * The decisions behind `tech-lead-stack doctor`, kept free of file, network
 * and process access so they can be tested with plain values. doctor.ts
 * gathers the facts and passes them in.
 */

export type CheckStatus = 'ok' | 'info' | 'warn' | 'fail';

export interface Check {
  id: string;
  status: CheckStatus;
  title: string;
  fix?: string;
}

/** Settings whose presence doctor reports. Values are never read out. */
export const KNOWN_SETTINGS = [
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OPENAI_API_KEY',
  'LOCAL_MODEL_ENDPOINT',
  'LOCAL_MODEL_NAME',
  'DATABASE_URL',
] as const;

const MIN_NODE = [22, 5] as const;
const INIT = 'npx -y tech-lead-stack@1 init';

type Env = Record<string, string | undefined>;
const isSet = (env: Env, name: string) => Boolean(env[name]?.trim());

export function checkNode(version: string): Check {
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number);
  const ok =
    major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]);
  return ok
    ? { id: 'node', status: 'ok', title: `Node.js ${version}` }
    : {
        id: 'node',
        status: 'fail',
        title: `Node.js ${version} is too old; version 22.5 or later is needed`,
        fix: 'Install the current LTS from https://nodejs.org, then run this again.',
      };
}

export function checkPlatform(platform: string): Check | null {
  if (platform !== 'win32') return null;
  return {
    id: 'platform',
    status: 'warn',
    title: 'Windows: the setup commands support macOS, Linux and WSL',
    fix: 'Run this inside WSL: https://learn.microsoft.com/windows/wsl/install',
  };
}

/** Which features the settings in view turn on. */
export function checkFeatures(env: Env): Check[] {
  const gemini =
    isSet(env, 'GEMINI_API_KEY') || isSet(env, 'GOOGLE_GENERATIVE_AI_API_KEY');
  const byo = isSet(env, 'ANTHROPIC_API_KEY') && gemini;
  const local =
    isSet(env, 'LOCAL_MODEL_ENDPOINT') && isSet(env, 'LOCAL_MODEL_NAME');
  return [
    {
      id: 'tier-subscription',
      status: 'ok',
      title:
        'Subscription tiers (sub-pro, sub-max): use the Claude, Gemini or ChatGPT plan your editor is signed in with; nothing to set here',
    },
    byo
      ? {
          id: 'tier-byo',
          status: 'ok',
          title: 'Two-model reflexion loop (byo): ready',
        }
      : {
          id: 'tier-byo',
          status: 'info',
          title: 'Two-model reflexion loop (byo): off, optional',
          fix: 'Add ANTHROPIC_API_KEY and GEMINI_API_KEY to ~/.tech-lead-stack/.env to turn it on.',
        },
    local
      ? { id: 'tier-local', status: 'ok', title: 'Offline tier (local): ready' }
      : {
          id: 'tier-local',
          status: 'info',
          title: 'Offline tier (local): off, optional',
          fix: 'Set LOCAL_MODEL_ENDPOINT and LOCAL_MODEL_NAME to use a model on your computer (for example Ollama).',
        },
  ];
}

export interface ToolboxEntry {
  /** The server name the editor lists. */
  name: string;
  via: 'direct' | 'gateway';
  /** Known setting names in the entry's env block (values are not kept). */
  settings: string[];
  /** Started from the npm package, or from a downloaded folder (a clone). */
  from: 'npm' | 'folder';
}

/** A server spec that starts the published package through npx. */
export function startsNpxPackage(spec: unknown): boolean {
  const { command, args } = (spec ?? {}) as {
    command?: unknown;
    args?: unknown;
  };
  return (
    command === 'npx' &&
    Array.isArray(args) &&
    args.some((a) => typeof a === 'string' && /^tech-lead-stack(@|$)/.test(a))
  );
}

const parsedOrNull = (json: string): unknown => {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const reachesToolbox = (text: string) =>
  /tech-lead-stack|mcp-server\.mjs/.test(text);

const knownIn = (env: unknown): string[] =>
  env && typeof env === 'object'
    ? KNOWN_SETTINGS.filter((k) => isSet(env as Env, k))
    : [];

function downstreamSettings(downstream: string): string[] {
  try {
    return knownIn((JSON.parse(downstream) as { env?: unknown }).env);
  } catch {
    return [];
  }
}

/** Finds the servers in an editor's MCP config that reach this toolbox. */
export function findToolboxEntries(config: unknown): ToolboxEntry[] {
  const servers = (config as { mcpServers?: unknown } | null)?.mcpServers;
  if (!servers || typeof servers !== 'object') return [];

  const entries: ToolboxEntry[] = [];
  for (const [name, raw] of Object.entries(servers)) {
    const server = (raw ?? {}) as {
      command?: unknown;
      args?: unknown;
      env?: Env;
    };
    const downstream = server.env?.DOWNSTREAM_MCP;
    if (typeof downstream === 'string' && reachesToolbox(downstream)) {
      entries.push({
        name,
        via: 'gateway',
        settings: [...knownIn(server.env), ...downstreamSettings(downstream)],
        from: startsNpxPackage(parsedOrNull(downstream)) ? 'npm' : 'folder',
      });
    } else if (
      name === 'tech-lead-stack' ||
      reachesToolbox(JSON.stringify([server.command, server.args]))
    ) {
      entries.push({
        name,
        via: 'direct',
        settings: knownIn(server.env),
        from: startsNpxPackage(server) ? 'npm' : 'folder',
      });
    }
  }
  return entries;
}

export type EditorConfig =
  | { state: 'missing' }
  | { state: 'unreadable' }
  | { state: 'read'; config: unknown };

export function checkEditor(
  { id, label, path }: { id: string; label: string; path: string },
  file: EditorConfig
): Check | null {
  if (file.state === 'missing') return null;
  if (file.state === 'unreadable') {
    return {
      id,
      status: 'warn',
      title: `${label}: can't read ${path}`,
      fix: 'The file has a formatting error. Fix or restore it (a .bak copy may sit next to it).',
    };
  }

  const entries = findToolboxEntries(file.config);
  if (entries.length === 0) {
    return {
      id,
      status: 'info',
      title: `${label}: installed, toolbox not added`,
      fix: `Run: ${INIT}`,
    };
  }
  const describe = (e: ToolboxEntry) =>
    (e.via === 'gateway'
      ? `through gateway "${e.name}"`
      : `directly as "${e.name}"`) +
    (e.from === 'folder' ? ' from a downloaded folder' : '');
  const settings = [...new Set(entries.flatMap((e) => e.settings))];
  const suffix = settings.length ? ` (sets ${settings.join(', ')})` : '';

  if (entries.length > 1) {
    return {
      id,
      status: 'warn',
      title: `${label}: toolbox connected more than once: ${entries.map(describe).join(', ')}`,
      fix: `Keep one. Every tool appears once per entry, so the assistant sees duplicates. Remove the extra entry from ${path}.`,
    };
  }
  return {
    id,
    status: 'ok',
    title: `${label}: connected ${describe(entries[0])}${suffix}`,
  };
}

export function checkAnyEditor(editorChecks: (Check | null)[]): Check | null {
  if (editorChecks.some(Boolean)) return null;
  return {
    id: 'editors',
    status: 'warn',
    title: 'No supported editor found on this computer',
    fix: `Install Claude Code, Claude Desktop, Cursor, Continue, Gemini or Cline, then run: ${INIT}`,
  };
}

/** Copied commands, skills and prompts, against the version now running. */
export function checkCopies({
  installed,
  running,
}: {
  installed: string | null;
  running: string;
}): Check | null {
  if (!installed) return null;
  return installed === running
    ? {
        id: 'copies',
        status: 'ok',
        title: `Commands, skills and workflows: current (v${installed})`,
      }
    : {
        id: 'copies',
        status: 'warn',
        title: `Commands, skills and workflows were installed by v${installed}; v${running} is running`,
        fix: `Refresh them with: ${INIT}`,
      };
}

export type DatabaseState =
  | { state: 'no-url' }
  | { state: 'unreachable'; message: string }
  | { state: 'no-tables' }
  | { state: 'ready' };

export function checkDatabase(db: DatabaseState): Check {
  switch (db.state) {
    case 'no-url':
      return {
        id: 'metrics',
        status: 'info',
        title: 'Usage metrics: off (no DATABASE_URL)',
        fix: 'Add DATABASE_URL to ~/.tech-lead-stack/.env, using the same database as your web app.',
      };
    case 'unreachable':
      return {
        id: 'metrics',
        status: 'fail',
        title: `Usage metrics: can't reach the database (${db.message})`,
        fix: 'Check DATABASE_URL and that the database is running (for a local one: docker compose up -d db).',
      };
    case 'no-tables':
      return {
        id: 'metrics',
        status: 'warn',
        title:
          "Usage metrics: database reached, but its tables don't exist yet",
        fix: 'In your web app folder, run: pnpm db:migrate (see docs/web-app.md).',
      };
    case 'ready':
      return { id: 'metrics', status: 'ok', title: 'Usage metrics: on' };
  }
}

export function checkSettingsFile(file: {
  path: string;
  exists: boolean;
  othersCanRead: boolean;
}): Check {
  if (!file.exists) {
    return {
      id: 'settings-file',
      status: 'info',
      title: `Settings file: ${file.path} not created yet`,
      fix: `Run: ${INIT}. It creates the file and asks for anything optional.`,
    };
  }
  if (file.othersCanRead) {
    return {
      id: 'settings-file',
      status: 'warn',
      title: `Settings file: ${file.path} can be read by other users on this computer`,
      fix: `It may hold API keys. Run: chmod 600 ${file.path}`,
    };
  }
  return {
    id: 'settings-file',
    status: 'ok',
    title: `Settings file: ${file.path}`,
  };
}

const versionParts = (v: string) =>
  v
    .replace(/^v/, '')
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0);

/** True when version a is the same as or newer than b ("v0.50.0", "0.43.1"). */
export function versionAtLeast(a: string, b: string): boolean {
  const [x, y] = [versionParts(a), versionParts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return true;
}

export function checkRtk({
  installed,
  pinned,
}: {
  installed: string | null;
  pinned: string;
}): Check {
  if (!installed) {
    return {
      id: 'rtk',
      status: 'info',
      title: 'RTK: not installed, optional',
      fix: `It cuts the tokens your assistant spends reading command output. Install it with: ${INIT}`,
    };
  }
  if (!versionAtLeast(installed, pinned)) {
    return {
      id: 'rtk',
      status: 'warn',
      title: `RTK ${installed} is older than the version this toolbox is tested with (${pinned.replace(/^v/, '')})`,
      fix: `Update it with: ${INIT}`,
    };
  }
  return {
    id: 'rtk',
    status: 'ok',
    title: `RTK ${installed} (saves tokens on command output)`,
  };
}

const MARK: Record<CheckStatus, string> = {
  ok: '✓',
  info: '·',
  warn: '!',
  fail: '✗',
};

/** Plain-text report for people. */
export function formatReport(version: string, checks: Check[]): string {
  const lines = [`Tech-Lead Stack doctor (v${version})`, ''];
  for (const c of checks) {
    lines.push(`${MARK[c.status]} ${c.title}`);
    if (c.fix && c.status !== 'ok') lines.push(`    → ${c.fix}`);
  }
  const problems = checks.filter(
    (c) => c.status === 'fail' || c.status === 'warn'
  );
  lines.push(
    '',
    problems.length === 0
      ? 'Everything needed is in place. Lines marked · are optional extras.'
      : `${problems.length} thing(s) to fix: the lines marked ! or ✗ above.`
  );
  return lines.join('\n');
}

export const hasFailure = (checks: Check[]) =>
  checks.some((c) => c.status === 'fail');
