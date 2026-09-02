import * as fs from 'fs';
import * as path from 'path';

/**
 * @desc Determines a safe default starting directory.
 * In Jest / CommonJS environments, __dirname is always defined.
 * In ESM environments where __dirname is undefined, falls back to process.cwd().
 * @returns An absolute directory path.
 */
function getDefaultDir(): string {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  return process.cwd();
}

/**
 * @desc Resolves the absolute path to the tech-lead-stack repository root.
 *
 * Searches upward from `startDir` until a directory containing both
 * `.ai/skills` and `.agents/workflows` (or root `package.json` with
 * `tech-lead-stack-workspace`) is encountered.
 *
 * Supports explicit override via `TECH_LEAD_STACK_ROOT` or `REPO_ROOT` env vars.
 *
 * @param startDir - The starting directory to resolve from (defaults to caller directory or process.cwd()).
 * @returns The resolved absolute path to the repository root.
 * @example
 * ```ts
 * const root = findRepoRoot();
 * ```
 */
export function findRepoRoot(startDir?: string): string {
  if (process.env.TECH_LEAD_STACK_ROOT && fs.existsSync(process.env.TECH_LEAD_STACK_ROOT)) {
    return path.resolve(process.env.TECH_LEAD_STACK_ROOT);
  }
  if (process.env.REPO_ROOT && fs.existsSync(process.env.REPO_ROOT)) {
    return path.resolve(process.env.REPO_ROOT);
  }

  const baseDir = startDir ? path.resolve(startDir) : getDefaultDir();
  let curr = baseDir;

  while (curr !== path.parse(curr).root) {
    const hasSkills = fs.existsSync(path.join(curr, '.ai', 'skills'));
    const hasWorkflows = fs.existsSync(path.join(curr, '.agents', 'workflows'));
    if (hasSkills && hasWorkflows) {
      return curr;
    }

    const pkgPath = path.join(curr, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === 'tech-lead-stack-workspace') {
          return curr;
        }
      } catch {
        // Continue searching up
      }
    }

    curr = path.dirname(curr);
  }

  // Fallback: check process.cwd()
  const cwd = process.cwd();
  if (
    fs.existsSync(path.join(cwd, '.ai', 'skills')) &&
    fs.existsSync(path.join(cwd, '.agents', 'workflows'))
  ) {
    return cwd;
  }

  // Fallback relative traversal if not matched
  return path.resolve(baseDir, '../../..');
}
