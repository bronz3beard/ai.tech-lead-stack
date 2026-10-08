import { execFileSync } from 'child_process';

export interface GitContext {
  gitBranch?: string;
  prNumber?: number;
}

/** PR number from CI only (GitHub Actions `refs/pull/<n>/merge`, or an explicit PR_NUMBER); no network calls. */
export function prNumberFromEnv(env: NodeJS.ProcessEnv): number | undefined {
  const fromRef = env.GITHUB_REF?.match(/^refs\/pull\/(\d+)\//)?.[1];
  const raw = fromRef ?? env.PR_NUMBER;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * Branch and PR of the caller's checkout. The MCP server runs with the user's
 * project as its working directory, so a read-only `git rev-parse` there names
 * their branch. Any failure yields an empty context; telemetry never blocks on it.
 */
export function resolveGitContext(input: {
  env: NodeJS.ProcessEnv;
  cwd: string;
  exec?: (cmd: string, args: string[], cwd: string) => string;
}): GitContext {
  const exec =
    input.exec ??
    ((cmd, args, cwd) =>
      execFileSync(cmd, args, { cwd, stdio: 'pipe', timeout: 2000 }).toString());

  let gitBranch: string | undefined;
  try {
    const branch = exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], input.cwd).trim();
    gitBranch = branch && branch !== 'HEAD' ? branch : undefined; // 'HEAD' = detached
  } catch {
    gitBranch = undefined;
  }

  return { gitBranch, prNumber: prNumberFromEnv(input.env) };
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: { at: number; value: GitContext } | undefined;

/** Cached per process for five minutes; empty under Jest so tests never shell out. */
export function getGitContext(): GitContext {
  if (process.env.NODE_ENV === 'test') return {};
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;
  const value = resolveGitContext({ env: process.env, cwd: process.cwd() });
  cached = { at: now, value };
  return value;
}
