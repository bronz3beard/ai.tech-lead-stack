import child_process from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import matter from 'gray-matter';
import os from 'os';
import path from 'path';

export interface FsWriteRecord {
  method: string;
  path: string;
  args: unknown[];
}

export interface ChildProcessCall {
  method: string;
  command: string;
  args: string[];
  fullCommand: string;
}

export interface FakeClientRepo {
  root: string;
  cleanup: () => void;
}

/**
 * Creates a throwaway temp directory simulating a consuming project/client repo.
 * Seeds standard project files unless overridden by customFiles.
 */
export function makeFakeClientRepo(
  customFiles?: Record<string, string>
): FakeClientRepo {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'client-repo-'));

  const defaultFiles: Record<string, string> = {
    'package.json': JSON.stringify(
      {
        name: 'fake-client-app',
        version: '1.0.0',
        private: true,
      },
      null,
      2
    ),
    'src/index.ts':
      '// Fake client source code\nexport const run = () => "client";\n',
    'README.md': '# Fake Client App\n',
    '.git/HEAD': 'ref: refs/heads/main\n',
    '.git/config': '[core]\n\trepositoryformatversion = 0\n',
    'scripts/validate-skills.sh':
      '#!/bin/bash\necho "Validation successful"\nexit 0\n',
  };

  const filesToWrite = { ...defaultFiles, ...customFiles };

  for (const [relPath, content] of Object.entries(filesToWrite)) {
    const fullPath = path.join(root, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    if (relPath.endsWith('.sh')) {
      try {
        fs.chmodSync(fullPath, 0o755);
      } catch {
        /* best-effort chmod */
      }
    }
  }

  const cleanup = () => {
    try {
      fs.rmSync(root, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 50,
      });
    } catch {
      // Ignore errors during cleanup
    }
  };

  return { root, cleanup };
}

/**
 * Creates a recursive tree snapshot of the directory, computing sha256 for every file.
 * Includes hidden files and directories (such as .git).
 */
export function snapshotTree(dir: string): Map<string, string> {
  const tree = new Map<string, string>();

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const relPath = path.relative(dir, fullPath).split(path.sep).join('/');
        const content = fs.readFileSync(fullPath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        tree.set(relPath, hash);
      }
    }
  }

  walk(dir);
  return tree;
}

/**
 * Asserts that no repository files were added, modified, or removed between snapshots,
 * except for paths explicitly specified in options.allow.
 */
export function assertNoRepoWrites(
  before: Map<string, string>,
  after: Map<string, string>,
  options: { allow?: string[] } = {}
): void {
  const allowed = new Set(
    (options.allow ?? []).map((p) =>
      p.replace(/^\//, '').split(path.sep).join('/')
    )
  );

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const [relPath, afterHash] of after.entries()) {
    if (allowed.has(relPath)) continue;

    if (!before.has(relPath)) {
      added.push(relPath);
    } else if (before.get(relPath) !== afterHash) {
      modified.push(relPath);
    }
  }

  for (const relPath of before.keys()) {
    if (allowed.has(relPath)) continue;

    if (!after.has(relPath)) {
      removed.push(relPath);
    }
  }

  if (added.length > 0 || removed.length > 0 || modified.length > 0) {
    const details: string[] = [];
    if (added.length > 0) details.push(`Added files: ${added.join(', ')}`);
    if (removed.length > 0)
      details.push(`Removed files: ${removed.join(', ')}`);
    if (modified.length > 0)
      details.push(`Modified files: ${modified.join(', ')}`);
    throw new Error(
      `Unauthorized repository writes detected:\n${details.join('\n')}`
    );
  }
}

function extractPath(arg: unknown): string {
  if (typeof arg === 'string') return path.resolve(arg);
  if (Buffer.isBuffer(arg)) return path.resolve(arg.toString('utf-8'));
  if (arg && typeof arg === 'object' && 'pathname' in arg)
    return path.resolve(String((arg as { pathname: unknown }).pathname));
  if (arg !== undefined && arg !== null) return path.resolve(String(arg));
  return '';
}

/**
 * Spies on fs and fs/promises write methods, recording calls and target absolute paths.
 */
export function spyOnFsWrites(): {
  writes: FsWriteRecord[];
  restore: () => void;
} {
  const writes: FsWriteRecord[] = [];
  const spies: jest.SpyInstance[] = [];

  const fsMethods: Array<keyof typeof fs> = [
    'writeFile',
    'writeFileSync',
    'appendFile',
    'appendFileSync',
    'mkdir',
    'mkdirSync',
    'rm',
    'rmSync',
    'rename',
    'renameSync',
    'unlink',
    'unlinkSync',
    'copyFile',
    'copyFileSync',
  ];

  const realRmSync = fs.rmSync.bind(fs);
  const realUnlinkSync = fs.unlinkSync.bind(fs);
  const realReaddirSync = fs.readdirSync.bind(fs);
  const realStatSync = fs.statSync.bind(fs);
  const realMkdirSync = fs.mkdirSync.bind(fs);
  const realWriteFileSync = fs.writeFileSync.bind(fs);

  for (const method of fsMethods) {
    const orig = fs[method] as Function;
    if (typeof orig === 'function') {
      const spy = jest.spyOn(fs, method as any).mockImplementation(function (
        this: unknown,
        ...args: unknown[]
      ) {
        writes.push({
          method: String(method),
          path: extractPath(args[0]),
          args,
        });
        if (method === 'rmSync') {
          const target = String(args[0] ?? '');
          const opts = (
            args[1] && typeof args[1] === 'object' ? args[1] : {}
          ) as fs.RmOptions;
          try {
            return realRmSync(target, {
              recursive: true,
              force: true,
              maxRetries: 3,
              retryDelay: 50,
              ...opts,
            });
          } catch {
            try {
              if (realStatSync(target).isDirectory()) {
                const files = realReaddirSync(target);
                for (const f of files) {
                  try {
                    realUnlinkSync(path.join(target, f));
                  } catch {}
                }
                return realRmSync(target, {
                  recursive: true,
                  force: true,
                  ...opts,
                });
              } else {
                return realUnlinkSync(target);
              }
            } catch {
              // fallback to default
            }
          }
        }
        return orig.apply(fs, args);
      });
      spies.push(spy);
    }
  }

  const promisesMethods: Array<keyof typeof fs.promises> = [
    'writeFile',
    'appendFile',
    'mkdir',
    'rm',
    'rename',
    'unlink',
    'copyFile',
  ];

  for (const method of promisesMethods) {
    const orig = fs.promises[method] as Function;
    if (typeof orig === 'function') {
      const spy = jest
        .spyOn(fs.promises, method as any)
        .mockImplementation(async function (this: unknown, ...args: unknown[]) {
          writes.push({
            method: `fs.promises.${String(method)}`,
            path: extractPath(args[0]),
            args,
          });
          if (method === 'writeFile') {
            try {
              const targetFile = String(args[0] ?? '');
              realMkdirSync(path.dirname(targetFile), { recursive: true });
              realWriteFileSync(targetFile, String(args[1] ?? ''), 'utf-8');
            } catch {}
          }
          if (method === 'rm') {
            const target = String(args[0] ?? '');
            try {
              realRmSync(target, { recursive: true, force: true });
              realRmSync(path.resolve(target), {
                recursive: true,
                force: true,
              });
            } catch {
              try {
                if (realStatSync(target).isDirectory()) {
                  const files = realReaddirSync(target);
                  for (const f of files) {
                    try {
                      realUnlinkSync(path.join(target, f));
                    } catch {}
                  }
                  realRmSync(target, { recursive: true, force: true });
                } else {
                  realUnlinkSync(target);
                }
              } catch {}
            }
            return Promise.resolve();
          }
          return orig.apply(this, args);
        });
      spies.push(spy);
    }
  }

  const restore = () => {
    for (const spy of spies) {
      spy.mockRestore();
    }
  };

  return { writes, restore };
}

/**
 * Spies on child_process execution methods, recording commands and arguments.
 */
export function spyOnChildProcess(): {
  calls: ChildProcessCall[];
  restore: () => void;
} {
  const calls: ChildProcessCall[] = [];
  const spies: jest.SpyInstance[] = [];

  const cpMethods: Array<keyof typeof child_process> = [
    'exec',
    'execSync',
    'execFile',
    'execFileSync',
    'spawn',
    'spawnSync',
  ];

  for (const method of cpMethods) {
    const orig = child_process[method] as Function;
    if (typeof orig === 'function') {
      const mockImpl: any = function (this: unknown, ...args: unknown[]) {
        let command = '';
        let cmdArgs: string[] = [];
        let fullCommand = '';

        if (method === 'exec' || method === 'execSync') {
          command = String(args[0] ?? '');
          fullCommand = command;
        } else if (
          method === 'execFile' ||
          method === 'execFileSync' ||
          method === 'spawn' ||
          method === 'spawnSync'
        ) {
          command = String(args[0] ?? '');
          if (Array.isArray(args[1])) {
            cmdArgs = args[1].map(String);
            fullCommand = `${command} ${cmdArgs.join(' ')}`;
          } else {
            fullCommand = command;
          }
        }

        calls.push({
          method: String(method),
          command,
          args: cmdArgs,
          fullCommand,
        });

        const cb = args.find((a) => typeof a === 'function') as
          | Function
          | undefined;
        if (cb) {
          process.nextTick(() => cb(null, 'Mock Output', ''));
          return {} as any;
        }

        return orig.apply(this, args);
      };

      if (method === 'execFile') {
        const customSymbol = Symbol.for('nodejs.util.promisify.custom');
        mockImpl[customSymbol] = async (cmd: string, args?: string[]) => {
          const cmdArgs = Array.isArray(args) ? args.map(String) : [];
          const fullCommand =
            cmdArgs.length > 0 ? `${cmd} ${cmdArgs.join(' ')}` : cmd;
          calls.push({
            method: 'execFile',
            command: cmd,
            args: cmdArgs,
            fullCommand,
          });
          return { stdout: 'Mock Output', stderr: '' };
        };
      }

      const spy = jest
        .spyOn(child_process, method as any)
        .mockImplementation(mockImpl);
      spies.push(spy);
    }
  }

  const restore = () => {
    for (const spy of spies) {
      spy.mockRestore();
    }
  };

  return { calls, restore };
}

/**
 * Helper to parse frontmatter of a skill markdown file and return its `modes` array.
 */
export function readSkillModes(skillFile: string): string[] {
  try {
    const content = fs.readFileSync(skillFile, 'utf-8');
    const parsed = matter(content);
    const modes = parsed.data?.modes;
    if (Array.isArray(modes)) {
      return modes.map(String);
    }
    return [];
  } catch {
    return [];
  }
}
