export const PACKAGE_JSON_STUB = JSON.stringify({
  name: 'webcontainer-stubs',
  version: '1.0.0',
  main: 'index.js',
  bin: {
    nx: './bin/nx.js'
  }
}, null, 2);

export const INDEX_JS_STUB = `
const noop = () => new Proxy(noop, { 
  get: (t, p) => {
    if (p === 'then') return undefined;
    return noop;
  } 
});
const stub = new Proxy(noop, { get: () => noop });
module.exports = stub;
module.exports.default = stub;
module.exports.createGlobPatternsForDependencies = () => [];
`;

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

  // Recursively search for project.json representing this project
  const findProjectJson = (dir) => {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const p = path.join(dir, file.name);
      if (file.name === 'project.json') {
        try {
          const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (parsed.name === project) {
            return { dir, parsed };
          }
        } catch {}
      } else if (file.isDirectory() && !['node_modules', '.git', '.next', '.nx', '.cache', 'dist', 'build', 'storybook-static', 'webcontainer-stubs', 'public', 'generated'].includes(file.name)) {
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
      
      if (targetConfig.executor === '@nx/vite:build') {
        console.log('[Mock NX CLI] Running Vite compiler in ' + dir + '...');
        const proc = spawn('npx', ['vite', 'build'], {
          cwd: dir,
          stdio: 'inherit',
          shell: true
        });
        
        proc.on('close', (code) => {
          process.exit(code);
        });
        return;
      }
    }
  }
}

console.log('[Mock NX CLI] Command completed successfully.');
process.exit(0);
`;

export const TAILWIND_JS_STUB = `
module.exports = {
  createGlobPatternsForDependencies: () => []
};
`;

export const DEVKIT_EXPORTS_JS_STUB = `
const fs = require('fs');
const path = require('path');
let root = process.cwd();
while (root && root !== '/') {
  if (fs.existsSync(path.join(root, 'pnpm-workspace.yaml')) || fs.existsSync(path.join(root, 'nx.json'))) {
    break;
  }
  const parent = path.dirname(root);
  if (parent === root) break;
  root = parent;
}
module.exports = {
  workspaceRoot: root
};
`;

export const DEV_SERVER_ENV = {
  NEXT_TELEMETRY_DISABLED: '1',
  CHOKIDAR_USEPOLLING: '1',
  WATCHPACK_POLLING: '1',
  NODE_OPTIONS: '--max-old-space-size=4096 --stack-size=8000',
  NEXT_OTEL_FETCH_DISABLED: '1',
  NEXT_PRIVATE_LOCAL_SKIP_V8_OPTIMIZE: '1',
  SENTRY_SKIP_AUTO_INSTRUMENTATION: '1',
  NEXT_SENTRY_SKIP_INIT: '1',
  SENTRY_IGNORE_API_ERRORS: '1',
  PORT: '3000',
  WATCHPACK_WATCHER_LIMIT: '20',
  CHOKIDAR_INTERVAL: '500',
  NX_CACHE_DIRECTORY: '/tmp/nx-cache',
  NX_DAEMON: 'false',
};

export const INCOMPATIBLE_PACKAGES = [
  '@swc/core', '@swc-node/core', '@swc-node/register', '@swc/cli', '@swc/helpers',
  '@next/swc-linux-x64-gnu', '@next/swc-linux-x64-musl', '@next/swc-win32-x64-msvc', 
  '@next/swc-darwin-x64', '@next/swc-darwin-arm64',
  '@sentry/nextjs', '@sentry/node', '@sentry/browser', '@sentry/react', '@sentry/profiling-node',
  '@nx/next', '@nx/react', '@nx/js', '@nx/node', '@nx/web', '@nx/vite', 'nx',
  '@serwist/next', 'serwist', 'next-video', 'prisma', '@prisma/client', 'sharp'
];
