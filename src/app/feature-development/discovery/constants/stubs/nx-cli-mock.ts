/**
 * @fileoverview Mock Nx CLI binary for WebContainer environments.
 *
 * ## Problem
 * Nx relies on a long-lived daemon process, a SQLite cache, and native @swc-node
 * bindings — none of which are available inside a WebContainer WASM sandbox.
 * When the sandboxed app's `package.json` declares scripts like
 * `"build": "nx build my-lib"`, the install step writes `node_modules/.bin/nx`
 * pointing to the real Nx binary, which would immediately crash.
 *
 * ## Solution
 * The `webcontainer-stubs` package declares `"bin": { "nx": "./bin/nx.js" }`.
 * Because `webcontainer-stubs` is linked in place of the real `nx` package,
 * the `nx` binary symlink in `node_modules/.bin/` resolves to this mock
 * instead. The mock:
 *  1. Intercepts `nx build <project>` and `nx run <project>:<target>` commands.
 *  2. Locates the project's `project.json` by walking the VFS recursively.
 *  3. For `@nx/vite:build` targets, delegates to `npx vite build` (the only
 *     executor that can realistically run inside WebContainer).
 *  4. Exits cleanly for any other command so install scripts don't hang.
 */
export const NX_JS_STUB = `#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
console.log('[Mock NX CLI] Intercepted command:', args.join(' '));

if (args[0] === 'build' || args[0] === 'run') {
  let project = '';
  let target = 'build';

  if (args[0] === 'build') {
    project = args[1];
  } else if (args[0] === 'run') {
    const parts = args[1].split(':');
    project = parts[0];
    target = parts[1] || 'build';
  }

  console.log('[Mock NX CLI] Building project "' + project + '" target "' + target + '"...');

  /**
   * Recursively search for a project.json whose \`name\` matches the requested
   * project. Skips common large/irrelevant directories to avoid VFS timeouts.
   */
  const findProjectJson = (dir) => {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const p = path.join(dir, file.name);
      if (file.name === 'project.json') {
        try {
          const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (parsed.name === project) return { dir, parsed };
        } catch {}
      } else if (
        file.isDirectory() &&
        !['node_modules','.git','.next','.nx','.cache','dist',
          'build','storybook-static','webcontainer-stubs','public','generated'
        ].includes(file.name)
      ) {
        const found = findProjectJson(p);
        if (found) return found;
      }
    }
    return null;
  };

  const found = findProjectJson(process.cwd());
  if (found) {
    const { dir, parsed } = found;
    const targetConfig = parsed.targets?.[target];
    if (targetConfig) {
      console.log('[Mock NX CLI] Found project executor: ' + targetConfig.executor);

      // Vite builds are the only executor that can run inside WebContainer
      if (targetConfig.executor === '@nx/vite:build') {
        console.log('[Mock NX CLI] Running Vite compiler in ' + dir + '...');
        const proc = spawn('npx', ['vite', 'build'], {
          cwd: dir,
          stdio: 'inherit',
          shell: true,
        });
        proc.on('close', (code) => process.exit(code));
        return;
      }
    }
  }
}

console.log('[Mock NX CLI] Command completed successfully.');
process.exit(0);
`;
