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

const realFs = {
  writeFile: fs.writeFile.bind(fs),
  writeFileSync: fs.writeFileSync.bind(fs),
  appendFile: fs.appendFile.bind(fs),
  appendFileSync: fs.appendFileSync.bind(fs),
  mkdir: fs.mkdir.bind(fs),
  mkdirSync: fs.mkdirSync.bind(fs),
  rm: fs.rm.bind(fs),
  rmSync: fs.rmSync.bind(fs),
  rename: fs.rename.bind(fs),
  renameSync: fs.renameSync.bind(fs),
  unlink: fs.unlink.bind(fs),
  unlinkSync: fs.unlinkSync.bind(fs),
  copyFile: fs.copyFile.bind(fs),
  copyFileSync: fs.copyFileSync.bind(fs),
  promises: {
    writeFile: fs.promises.writeFile.bind(fs.promises),
    appendFile: fs.promises.appendFile.bind(fs.promises),
    mkdir: fs.promises.mkdir.bind(fs.promises),
    rm: fs.promises.rm.bind(fs.promises),
    rename: fs.promises.rename.bind(fs.promises),
    unlink: fs.promises.unlink.bind(fs.promises),
    copyFile: fs.promises.copyFile.bind(fs.promises),
  },
};

function cleanRemoveSync(target: string): void {
  try {
    if (!fs.existsSync(target)) return;
    const stat = fs.lstatSync(target);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(target);
      for (const entry of entries) {
        cleanRemoveSync(path.join(target, entry));
      }
      fs.rmdirSync(target);
    } else {
      fs.unlinkSync(target);
    }
  } catch {}
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

  for (const method of fsMethods) {
    const realFn = (realFs as any)[method];
    if (typeof realFn === 'function') {
      const spy = jest.spyOn(fs, method as any).mockImplementation(function (
        this: unknown,
        ...args: unknown[]
      ) {
        writes.push({
          method: String(method),
          path: extractPath(args[0]),
          args,
        });
        if (method === 'rm' || method === 'rmSync') {
          cleanRemoveSync(String(args[0] ?? ''));
          return method === 'rm' ? (cb: any) => cb && cb(null) : undefined;
        }
        return realFn(...args);
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
    const spy = jest
      .spyOn(fs.promises, method as any)
      .mockImplementation(async function (this: unknown, ...args: unknown[]) {
        writes.push({
          method: `fs.promises.${String(method)}`,
          path: extractPath(args[0]),
          args,
        });
        if (method === 'rm') {
          cleanRemoveSync(String(args[0] ?? ''));
          return Promise.resolve();
        }
        if (method === 'writeFile') {
          const target = String(args[0] ?? '');
          const data = args[1] as string | Buffer;
          const opts = args[2] as fs.WriteFileOptions;
          try {
            realFs.mkdirSync(path.dirname(target), { recursive: true });
            realFs.writeFileSync(target, data, opts);
          } catch {}
          return Promise.resolve();
        }
        if (method === 'mkdir') {
          const target = String(args[0] ?? '');
          const opts = args[1] as fs.MakeDirectoryOptions;
          try {
            realFs.mkdirSync(target, { recursive: true, ...opts });
          } catch {}
          return Promise.resolve();
        }
        if (method === 'unlink') {
          try {
            realFs.unlinkSync(String(args[0] ?? ''));
          } catch {}
          return Promise.resolve();
        }
        if (method === 'appendFile') {
          try {
            realFs.appendFileSync(
              String(args[0] ?? ''),
              args[1] as any,
              args[2] as any
            );
          } catch {}
          return Promise.resolve();
        }
        if (method === 'copyFile') {
          try {
            realFs.copyFileSync(String(args[0] ?? ''), String(args[1] ?? ''));
          } catch {}
          return Promise.resolve();
        }
        if (method === 'rename') {
          try {
            realFs.renameSync(String(args[0] ?? ''), String(args[1] ?? ''));
          } catch {}
          return Promise.resolve();
        }
        return Promise.resolve();
      });
    spies.push(spy);
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

        if (method === 'execSync' || method === 'execFileSync') {
          return 'Mock Output';
        }

        return { stdout: 'Mock Output', stderr: '', status: 0 } as any;
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
      if (method === 'execFile') {
        const customSymbol = Symbol.for('nodejs.util.promisify.custom');
        (spy as any)[customSymbol] = mockImpl[customSymbol];
      }
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
