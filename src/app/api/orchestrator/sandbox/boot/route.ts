import { NextRequest } from 'next/server';
import { Sandbox } from 'e2b';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import AdmZip from 'adm-zip';

export const maxDuration = 300; // Allow long-running setups
export const dynamic = 'force-dynamic';

/** @desc 15 minutes — gives npm install plenty of time on a cold sandbox */
const SANDBOX_TIMEOUT_MS = 15 * 60 * 1000;

/** @desc 10 minutes — upper bound for dependency installation */
const INSTALL_TIMEOUT_MS = 10 * 60 * 1000;

/** @desc Default polling config for the dev server port */
const PORT_POLL_MAX_ATTEMPTS_DEFAULT = 20;
const PORT_POLL_INTERVAL_MS_DEFAULT = 2000;

/** @desc Extended polling for monorepo tooling (NX/Turbo) — 150s total */
const PORT_POLL_MAX_ATTEMPTS_MONOREPO = 40;
const PORT_POLL_INTERVAL_MS_MONOREPO = 3000;

/** @desc Warm-up delay before polling to let heavy tooling (NX graph) initialize */
const MONOREPO_WARMUP_MS = 15_000;

const PATCH_CONFIGS_SCRIPT = `
const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if (file === 'node_modules' || file === '.next' || file === '.git' || file === 'dist' || file === '.nx') {
      return;
    }
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else {
      results.push(fullPath);
    }
  });
  return results;
}

try {
  const files = walk('.');
  console.log('[patch-configs] Scanning ' + files.length + ' files...');
  
  files.forEach(file => {
    const name = path.basename(file);
    if (name.startsWith('next.config.')) {
      console.log('[patch-configs] Found Next.js config:', file);
      let content = fs.readFileSync(file, 'utf8');
      if (content.includes('allowedDevOrigins')) {
        console.log('[patch-configs]   allowedDevOrigins already present, skipping.');
        return;
      }
      
      let patched = false;
      if (/experimental\\s*:\\s*\\{/.test(content)) {
        content = content.replace(/(experimental\\s*:\\s*\\{)/, "$1\\n    allowedDevOrigins: ['.e2b.dev', '.e2b.co', 'localhost', '127.0.0.1'],");
        patched = true;
      } else {
        const nextPatterns = [
          {
            regex: /((const|let|var)\\s+nextConfig\\s*(?::\\s*\\w+)?\\s*=\\s*\\{)/,
            replace: "$1\\n  experimental: { allowedDevOrigins: ['.e2b.dev', '.e2b.co', 'localhost', '127.0.0.1'] },"
          },
          {
            regex: /(module\\.exports\\s*=\\s*\\{)/,
            replace: "$1\\n  experimental: { allowedDevOrigins: ['.e2b.dev', '.e2b.co', 'localhost', '127.0.0.1'] },"
          },
          {
            regex: /(export\\s+default\\s*\\{)/,
            replace: "$1\\n  experimental: { allowedDevOrigins: ['.e2b.dev', '.e2b.co', 'localhost', '127.0.0.1'] },"
          }
        ];

        for (const pattern of nextPatterns) {
          if (pattern.regex.test(content)) {
            content = content.replace(pattern.regex, pattern.replace);
            patched = true;
            break;
          }
        }
      }

      if (patched) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('[patch-configs]   Successfully patched Next.js config.');
      } else {
        console.log('[patch-configs]   Could not find standard config object to patch.');
      }
    } else if (name.startsWith('vite.config.')) {
      console.log('[patch-configs] Found Vite config:', file);
      let content = fs.readFileSync(file, 'utf8');
      if (content.includes('allowedHosts')) {
        console.log('[patch-configs]   allowedHosts already present, skipping.');
        return;
      }

      let patched = false;
      if (/server\\s*:\\s*\\{/.test(content)) {
        content = content.replace(/(server\\s*:\\s*\\{)/, "$1\\n    allowedHosts: true,");
        patched = true;
      } else {
        const vitePatterns = [
          {
            regex: /(defineConfig\\(\\s*\\{)/,
            replace: "$1\\n  server: { allowedHosts: true },"
          },
          {
            regex: /(export\\s+default\\s*\\{)/,
            replace: "$1\\n  server: { allowedHosts: true },"
          }
        ];
        for (const pattern of vitePatterns) {
          if (pattern.regex.test(content)) {
            content = content.replace(pattern.regex, pattern.replace);
            patched = true;
            break;
          }
        }
      }

      if (patched) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('[patch-configs]   Successfully patched Vite config.');
      } else {
        console.log('[patch-configs]   Could not find standard config object to patch.');
      }
    }
  });
} catch (e) {
  console.error('[patch-configs] Error patching configs:', e);
}
`;

async function getApiKey(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('Unauthorized: Could not fetch user session.');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { e2bApiKey: true },
  });

  if (!user?.e2bApiKey) {
    throw new Error('Sandbox Environment API Key is not configured. Please add it in Settings > API Keys.');
  }

  return decrypt(user.e2bApiKey);
}

/**
 * @desc Polls the sandbox until the given port is accepting connections.
 * Falls back gracefully after max attempts so the UI still gets the URL.
 */
async function printDiagnostics(sandbox: Sandbox, sendLog: (msg: string) => void) {
  try {
    sendLog('\n  [diagnostics] --- Sandbox System Diagnostics ---');
    
    // Check memory status
    try {
      const freeMem = await sandbox.commands.run('free -h', { timeoutMs: 5000 });
      sendLog(`  [diagnostics] Memory Status:\n${freeMem.stdout.trim()}`);
    } catch (e) {
      sendLog(`  [diagnostics] Failed to run free -h: ${e}`);
    }

    // Check dmesg for OOM killer or other errors
    try {
      const oomLog = await sandbox.commands.run('dmesg | grep -i -E "oom|kill" | tail -20', { timeoutMs: 5000 });
      if (oomLog.stdout.trim()) {
        sendLog(`  [diagnostics] Kernel OOM/Kill Events:\n${oomLog.stdout.trim()}`);
      } else {
        const dmesgLog = await sandbox.commands.run('dmesg | tail -20', { timeoutMs: 5000 });
        sendLog(`  [diagnostics] Recent Kernel Logs:\n${dmesgLog.stdout.trim()}`);
      }
    } catch (e) {
      sendLog(`  [diagnostics] Failed to run dmesg: ${e}`);
    }
    
    sendLog('  [diagnostics] -----------------------------------\n');
  } catch (err) {
    sendLog(`  [diagnostics] Diagnostics execution failed: ${err}`);
  }
}

/**
 * @desc Polls the sandbox until the given port is accepting connections.
 * Falls back gracefully after max attempts so the UI still gets the URL.
 * Also monitors the serve process and terminates early if it exits/crashes.
 */
async function pollForPort(
  sandbox: Sandbox,
  port: number,
  sendLog: (msg: string) => void,
  opts: { maxAttempts: number; intervalMs: number; warmupMs?: number } = {
    maxAttempts: PORT_POLL_MAX_ATTEMPTS_DEFAULT,
    intervalMs: PORT_POLL_INTERVAL_MS_DEFAULT,
  },
  serveCmd?: any
): Promise<boolean> {
  const { maxAttempts, intervalMs, warmupMs } = opts;

  // Optional warm-up: give heavy tooling (NX project graph, Turbo pipelines)
  // time to initialise before we start curling
  if (warmupMs && warmupMs > 0) {
    sendLog(`  [port-check] waiting ${warmupMs / 1000}s for tooling warm-up...`);
    
    // Check if the process died during the warm-up period
    const checkInterval = 3000;
    const checks = Math.ceil(warmupMs / checkInterval);
    for (let c = 0; c < checks; c++) {
      if (serveCmd && typeof serveCmd.pid === 'number') {
        try {
          const checkProc = await sandbox.commands.run(`test -d /proc/${serveCmd.pid}`, { timeoutMs: 2000 });
          if (checkProc.exitCode !== 0) {
            sendLog(`  [port-check] Dev server process (PID ${serveCmd.pid}) exited during warm-up!`);
            await printDiagnostics(sandbox, sendLog);
            return false;
          }
        } catch {
          // Ignore transient command errors
        }
      }
      await new Promise((r) => setTimeout(r, Math.min(checkInterval, warmupMs - c * checkInterval)));
    }
  }

  for (let i = 0; i < maxAttempts; i++) {
    // Check if the process died before attempting port connection
    if (serveCmd && typeof serveCmd.pid === 'number') {
      try {
        const checkProc = await sandbox.commands.run(`test -d /proc/${serveCmd.pid}`, { timeoutMs: 2000 });
        if (checkProc.exitCode !== 0) {
          sendLog(`  [port-check] Dev server process (PID ${serveCmd.pid}) has exited!`);
          await printDiagnostics(sandbox, sendLog);
          return false;
        }
      } catch {
        // Ignore transient command errors
      }
    }

    try {
      // Step 1: Lightweight TCP socket check — is the port open at all?
      const tcpCheck = await sandbox.commands.run(
        `node -e "const client = require('net').connect(${port}, '127.0.0.1', () => { client.end(); process.exit(0); }); client.on('error', () => process.exit(1));"`,
        { timeoutMs: 3000 }
      );

      if (tcpCheck.exitCode === 0) {
        sendLog(`  [port-check] attempt ${i + 1}/${maxAttempts} → TCP socket open!`);
        return true;
      } else {
        sendLog(`  [port-check] attempt ${i + 1}/${maxAttempts} → port closed`);
      }
    } catch (e) {
      sendLog(`  [port-check] attempt ${i + 1}/${maxAttempts} → port closed: ${e}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

interface NxResolveResult {
  command: string;
  isNext: boolean;
  isVite: boolean;
  port: number | null;
}

/**
 * @desc Introspects the workspace directly via filesystem to find actual serveable projects.
 *       Bypasses NX CLI entirely to avoid massive graph calculation overhead in the sandbox.
 *       Finds framework config files (Next.js, Vite) and returns a direct execution command.
 * @param sandbox - E2B Sandbox instance
 * @param nxDefaultProject - Value from nx.json defaultProject (may be empty)
 * @param hostnameFlag - Hostname binding flag for the detected framework
 * @param sendLog - Terminal log callback
 * @param envs - Environment variables to pass to introspection commands
 */
async function resolveNxServeCommand(
  sandbox: Sandbox,
  nxDefaultProject: string,
  hostnameFlag: string,
  sendLog: (msg: string) => void,
  envs: Record<string, string>
): Promise<NxResolveResult> {
  const NX_CMD_OPTS = { timeoutMs: 30000, envs };
  
  sendLog('  [fs-scan] Bypassing NX CLI — scanning filesystem for framework apps...');

  // Strategy 1a: Find Next.js config (highest priority — single result)
  try {
    const nextFind = await sandbox.commands.run(
      `find . -type d -name "node_modules" -prune -o -type d -name ".next" -prune -o -name "next.config.*" -print -quit`,
      NX_CMD_OPTS
    );
    const nextFile = nextFind.stdout.trim();

    if (nextFile && nextFile.includes('next.config')) {
      const appDir = nextFile.substring(0, nextFile.lastIndexOf('/')) || '.';
      sendLog(`  [fs-scan] Discovered Next.js app at: ${appDir}`);
      return {
        command: `ROOT_DIR=$(pwd) && cd "${appDir}" && (cp "$ROOT_DIR/.env" . 2>/dev/null || true) && (cp "$ROOT_DIR/.env.local" . 2>/dev/null || true) && exec npx next dev --hostname 0.0.0.0 --port 3000`,
        isNext: true,
        isVite: false,
        port: 3000,
      };
    }
  } catch (err) {
    sendLog(`  [fs-scan] Next.js config scan failed: ${err}`);
  }

  // Strategy 1b: Find Vite config (fallback — single result)
  try {
    const viteFind = await sandbox.commands.run(
      `find . -type d -name "node_modules" -prune -o -name "vite.config.*" ! -path "*/storybook/*" ! -path "*-lib/*" -print -quit`,
      NX_CMD_OPTS
    );
    const viteFile = viteFind.stdout.trim();

    if (viteFile && viteFile.includes('vite.config')) {
      const appDir = viteFile.substring(0, viteFile.lastIndexOf('/')) || '.';
      sendLog(`  [fs-scan] Discovered Vite app at: ${appDir}`);
      return {
        command: `ROOT_DIR=$(pwd) && cd "${appDir}" && (cp "$ROOT_DIR/.env" . 2>/dev/null || true) && (cp "$ROOT_DIR/.env.local" . 2>/dev/null || true) && exec npx vite dev --host 0.0.0.0 --port 5173`,
        isNext: false,
        isVite: true,
        port: 5173,
      };
    }
  } catch (err) {
    sendLog(`  [fs-scan] Vite config scan failed: ${err}`);
  }

  // Strategy 2: Find project.json files and parse them for framework executors
  try {
    sendLog('  [fs-scan] Falling back to project.json scanning...');
    const findCmd = `find . -type d -name "node_modules" -prune -o -name "project.json" -print | head -n 10`;
    const findResult = await sandbox.commands.run(findCmd, NX_CMD_OPTS);
    const files = findResult.stdout.trim().split('\n').filter(Boolean);
    
    for (const file of files) {
      if (file.includes('e2e')) continue;
      try {
        const content = await sandbox.files.read(file);
        const appDir = file.substring(0, file.lastIndexOf('/'));
        
        if (content.includes('@nx/next') || content.includes('@nrwl/next')) {
          sendLog(`  [fs-scan] Discovered Next.js app via project.json at: ${appDir}`);
          return {
            command: `ROOT_DIR=$(pwd) && cd "${appDir}" && (cp "$ROOT_DIR/.env" . 2>/dev/null || true) && (cp "$ROOT_DIR/.env.local" . 2>/dev/null || true) && exec npx next dev --hostname 0.0.0.0 --port 3000`,
            isNext: true,
            isVite: false,
            port: 3000,
          };
        } else if (content.includes('@nx/vite') || content.includes('@nrwl/vite')) {
          sendLog(`  [fs-scan] Discovered Vite app via project.json at: ${appDir}`);
          return {
            command: `ROOT_DIR=$(pwd) && cd "${appDir}" && (cp "$ROOT_DIR/.env" . 2>/dev/null || true) && (cp "$ROOT_DIR/.env.local" . 2>/dev/null || true) && exec npx vite dev --host 0.0.0.0 --port 5173`,
            isNext: false,
            isVite: true,
            port: 5173,
          };
        }
      } catch {
        // Ignore read/parse errors for individual files
      }
    }
  } catch (err) {
    sendLog(`  [fs-scan] project.json scan failed: ${err}`);
  }

  // Strategy 3: Fallback to original NX behavior if FS scan finds nothing
  sendLog('  [fs-scan] Direct introspection found nothing — falling back to run-many');
  return {
    command: 'npx nx run-many -t serve --parallel=1 || npx nx run-many -t dev --parallel=1',
    isNext: false,
    isVite: false,
    port: null,
  };
}

function parseEnvContent(content: string): Record<string, string> {
  const envs: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const key = trimmed.substring(0, idx).trim();
      let val = trimmed.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      envs[key] = val;
    }
  }
  return envs;
}

export async function POST(req: NextRequest) {
  try {
    const { filesRecord } = await req.json();

    if (!filesRecord || typeof filesRecord !== 'object') {
      return new Response('Invalid filesRecord', { status: 400 });
    }

    const projectEnvs: Record<string, string> = {};
    for (const [filePath, content] of Object.entries(filesRecord)) {
      if (
        typeof content === 'string' &&
        (filePath === '.env' ||
          filePath === '.env.local' ||
          filePath.endsWith('/.env') ||
          filePath.endsWith('/.env.local'))
      ) {
        Object.assign(projectEnvs, parseEnvContent(content));
      }
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (type: 'status' | 'log' | 'ready' | 'error', payload: unknown) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify({ type, payload }) + '\n'));
          } catch {
            // Controller may already be closed if client disconnected
          }
        };

        const writeToTerminal = (data: string) => sendEvent('log', data);

        try {
          // ── 1. Provision Sandbox ──────────────────────────────────────
          sendEvent('status', 'Provisioning E2B Sandbox...');
          console.log('[E2B Boot] Creating sandbox with timeoutMs:', SANDBOX_TIMEOUT_MS);

          const apiKey = await getApiKey();
          const sandbox = await Sandbox.create({
            apiKey,
            timeoutMs: SANDBOX_TIMEOUT_MS,
            network: {
              maskRequestHost: 'localhost:${PORT}',
            },
          });

          console.log('[E2B Boot] Sandbox created:', sandbox.sandboxId);

          // Configure sandbox timeout early so it is not deleted during long installations/compilations
          try {
            if (typeof sandbox.setTimeout === 'function') {
              await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
            }
          } catch (e) {
            console.warn('[E2B] Early setTimeout failed or not supported', e);
          }

          sendEvent('status', 'Sandbox provisioned. Writing project files...');

          // ── 2. Write Project Files ────────────────────────────────────
          const entries = Object.entries(filesRecord);
          sendEvent('log', `\nWriting ${entries.length} files to sandbox...`);

          const zip = new AdmZip();
          for (const [filePath, content] of entries) {
            zip.addFile(filePath, Buffer.from(content as string, 'utf-8'));
          }
          const zipBuffer = zip.toBuffer();

          sendEvent('log', `  [zip] Packaged ${entries.length} files into ZIP bundle`);

          // Write the ZIP file to the sandbox
          const arrayBuffer = zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength);
          await sandbox.files.write('project.zip', arrayBuffer);
          sendEvent('log', '  [zip] ZIP bundle uploaded to sandbox');

          // Unzip the files
          let unzipResult = await sandbox.commands.run('unzip -o project.zip && rm project.zip', {
            timeoutMs: 30000,
          });

          if (unzipResult.exitCode === 127) {
            sendEvent('log', '  [unzip] unzip command not found in sandbox, installing...');
            await sandbox.commands.run('sudo apt-get update && sudo apt-get install -y unzip', {
              timeoutMs: 45000,
            });
            sendEvent('log', '  [unzip] Retrying extraction...');
            unzipResult = await sandbox.commands.run('unzip -o project.zip && rm project.zip', {
              timeoutMs: 30000,
            });
          }

          if (unzipResult.exitCode !== 0) {
            throw new Error(`Failed to extract project bundle: ${unzipResult.stderr}`);
          }

          sendEvent('log', `✓ ${entries.length} files written and extracted successfully`);

          // Run config patching script to allow dev origins/hosts
          try {
            sendEvent('log', '  [patch] Writing config patching script...');
            await sandbox.files.write('patch-configs.js', PATCH_CONFIGS_SCRIPT);
            sendEvent('log', '  [patch] Executing config patching script...');
            const patchResult = await sandbox.commands.run('node patch-configs.js && rm patch-configs.js', {
              timeoutMs: 15000,
            });
            if (patchResult.stdout) {
              sendEvent('log', patchResult.stdout.split('\n').map(line => `  [patch] ${line}`).join('\n'));
            }
            if (patchResult.stderr) {
              sendEvent('log', `  [patch] [ERROR] ${patchResult.stderr}`);
            }
          } catch (patchErr: any) {
            sendEvent('log', `  [patch] Failed to run config patching script: ${patchErr.message || patchErr}`);
          }

          // ── 3. Analyze Configuration ──────────────────────────────────
          sendEvent('status', 'Analyzing configuration...');
          let isPnpm = false;
          let hasDevScript = false;
          let isVite = false;
          let isNext = false;
          let isNx = false;
          let isTurbo = false;
          let nxDefaultProject = '';

          try {
            const pkgStr = await sandbox.files.read('package.json');
            try {
              const pkg = JSON.parse(pkgStr);
              hasDevScript = Boolean(pkg.scripts?.dev);
              isVite = Boolean(pkg.dependencies?.vite || pkg.devDependencies?.vite);
              isNext = Boolean(pkg.dependencies?.next || pkg.devDependencies?.next);
            } catch (parseError) {
              console.warn('[E2B Boot] package.json failed to parse as strict JSON:', parseError);
              if (pkgStr.includes('"dev":') || pkgStr.includes("'dev':")) hasDevScript = true;
              if (pkgStr.includes('"vite"')) isVite = true;
              if (pkgStr.includes('"next"')) isNext = true;
            }
          } catch (e) {
            console.warn('[E2B Boot] Failed to read package.json', e);
          }

          try {
            const nxStr = await sandbox.files.read('nx.json');
            isNx = true;
            try {
              const nxJson = JSON.parse(nxStr);
              nxDefaultProject = nxJson.defaultProject || '';
            } catch {
              // Ignore strict JSON parse errors for nx.json
            }
          } catch {
            // Not an NX project
          }

          try {
            await sandbox.files.read('turbo.json');
            isTurbo = true;
          } catch {
            // Not a Turbo project
          }

          try {
            await sandbox.files.read('pnpm-lock.yaml');
            isPnpm = true;
          } catch {
            // Not a pnpm project
          }

          const pkgManager = isPnpm ? 'pnpm' : 'npm';

          // ── 3.5 Update Node.js to v22 ──────────────────────────────────
          sendEvent('status', 'Updating Node.js to v22...');
          writeToTerminal('\n$ sudo npm install -g n && sudo n 22');
          await sandbox.commands.run('sudo npm install -g n && sudo n 22', {
            onStdout: writeToTerminal,
            onStderr: writeToTerminal,
            timeoutMs: 120000,
          });

          // ── 4. Install Package Manager (if needed) ────────────────────
          if (isPnpm) {
            sendEvent('status', 'Installing pnpm...');
            writeToTerminal('\n$ npm install -g pnpm');
            await sandbox.commands.run('npm install -g pnpm', {
              onStdout: writeToTerminal,
              onStderr: writeToTerminal,
              timeoutMs: 60000,
            });
          }

          // ── 4.5 Allocate Swap Memory ────────────────────────────────────
          sendEvent('status', 'Allocating virtual memory...');
          writeToTerminal('\n$ sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile');
          await sandbox.commands.run('sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile || echo "Swap setup failed or skipped"', {
            onStdout: writeToTerminal,
            onStderr: writeToTerminal,
            timeoutMs: 30000,
          });

          // ── 5. Install Dependencies ───────────────────────────────────
          sendEvent('status', `Installing dependencies with ${pkgManager}...`);
          
          const installArgs = isPnpm 
            ? 'install --reporter=append-only' 
            : 'install';
            
          const envString = 'CI=true NX_DAEMON=false NX_CACHE_WORKERS=1 NODE_OPTIONS="--max-old-space-size=768"';
          writeToTerminal(`\n$ ${envString} ${pkgManager} ${installArgs}`);

          const installCmd = await sandbox.commands.run(`${pkgManager} ${installArgs}`, {
            onStdout: writeToTerminal,
            onStderr: writeToTerminal,
            timeoutMs: INSTALL_TIMEOUT_MS,
            envs: {
              CI: 'true',
              NX_DAEMON: 'false',
              NX_CACHE_WORKERS: '1',
              NODE_OPTIONS: '--max-old-space-size=768'
            }
          });

          if (installCmd.exitCode !== 0) {
            throw new Error(`${pkgManager} install failed with exit code ${installCmd.exitCode}. Check terminal logs.`);
          }

          writeToTerminal('\n✓ Dependencies installed successfully');

          // ── 5.5 Generate Prisma Client ─────────────────────────────────
          try {
            const prismaFind = await sandbox.commands.run(
              `find . -type d -name "node_modules" -prune -o -name "schema.prisma" -print`,
              { timeoutMs: 15000 }
            );
            const schemas = prismaFind.stdout.trim().split('\n').filter(Boolean);
            if (schemas.length > 0) {
              sendEvent('status', 'Generating Prisma Client...');
              for (const schema of schemas) {
                writeToTerminal(`\n$ npx prisma generate --schema="${schema}"`);
                await sandbox.commands.run(`npx prisma generate --schema="${schema}"`, {
                  onStdout: writeToTerminal,
                  onStderr: writeToTerminal,
                  timeoutMs: 60000,
                  envs: {
                    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
                    ...projectEnvs,
                  },
                });
              }
            }
          } catch (e) {
            writeToTerminal(`\n  [prisma] Prisma client generation skipped/failed: ${e}`);
          }

          // ── 6. Start Dev Server ───────────────────────────────────────
          sendEvent('status', 'Starting development server...');

          // Shared env vars for the serve process
          const serveEnvs: Record<string, string> = {
            HOST: '0.0.0.0',
            HOSTNAME: '0.0.0.0',
            NEXT_TELEMETRY_DISABLED: '1',
            DISABLE_ESLINT_PLUGIN: 'true',
            TS_NODE_TRANSPILE_ONLY: 'true',
            NODE_OPTIONS: '--max-old-space-size=2048 --no-warnings',
            ...projectEnvs,
          };

          // Build the hostname binding flag for the detected framework
          const hostnameFlag = isNext ? '--hostname 0.0.0.0' : isVite ? '--host 0.0.0.0' : '';

          let startCmdStr: string;
          let detectedPort = isNext ? 3000 : isVite ? 5173 : 3000;

          if (hasDevScript) {
            // Root package.json has a dev script — use it with passthrough flags
            startCmdStr = hostnameFlag
              ? `exec ${pkgManager} run dev -- ${hostnameFlag}`
              : `exec ${pkgManager} run dev`;
          } else if (isNx) {
            // Carry monorepo-critical env vars into the serve process
            serveEnvs.NX_DAEMON = 'false';
            serveEnvs.NX_CACHE_WORKERS = '1';

            /**
             * @desc NX target introspection — discover actual serveable projects
             *       instead of blindly running run-many which can match zero targets.
             *       Tries target names in priority order: serve → dev → start
             */
            const resolvedNx = await resolveNxServeCommand(
              sandbox,
              nxDefaultProject,
              hostnameFlag,
              writeToTerminal,
              serveEnvs
            );
            startCmdStr = resolvedNx.command;
            if (resolvedNx.isNext) isNext = true;
            if (resolvedNx.isVite) isVite = true;
            if (resolvedNx.port) detectedPort = resolvedNx.port;
          } else if (isTurbo) {
            serveEnvs.NX_DAEMON = 'false';
            startCmdStr = 'exec npx turbo run dev';
          } else {
            startCmdStr = isNext
              ? 'exec npx next dev --hostname 0.0.0.0 --port 3000'
              : isVite
                ? 'exec npx vite dev --host 0.0.0.0 --port 5173'
                : `exec ${pkgManager} run dev`;
          }

          writeToTerminal(`\n$ ${startCmdStr}`);

          const serveCmd = await sandbox.commands.run(startCmdStr, {
            background: true,
            onStdout: writeToTerminal,
            onStderr: writeToTerminal,
            envs: serveEnvs,
          });

          // ── 7. Wait for Port ──────────────────────────────────────────
          const port = detectedPort;
          const isMonorepo = isNx || isTurbo;
          sendEvent('status', `Waiting for dev server on port ${port}${isMonorepo ? ' (extended timeout for monorepo)' : ''}...`);

          const pollOpts = isMonorepo
            ? { maxAttempts: PORT_POLL_MAX_ATTEMPTS_MONOREPO, intervalMs: PORT_POLL_INTERVAL_MS_MONOREPO, warmupMs: MONOREPO_WARMUP_MS }
            : { maxAttempts: PORT_POLL_MAX_ATTEMPTS_DEFAULT, intervalMs: PORT_POLL_INTERVAL_MS_DEFAULT };

          const portReady = await pollForPort(sandbox, port, writeToTerminal, pollOpts, serveCmd);

          if (portReady) {
            writeToTerminal(`\n✓ Dev server detected on port ${port}`);
            try {
              writeToTerminal(`\n[diagnostics] Querying localhost:${port} via curl (following redirects)...`);
              const testCurl = await sandbox.commands.run(`curl -i -L -s http://localhost:${port} || curl -i -L -s http://127.0.0.1:${port}`, { timeoutMs: 30000 });
              writeToTerminal(`\n[diagnostics] Response Headers/Content:\n${testCurl.stdout.trim() || testCurl.stderr.trim()}`);
            } catch (curlErr: any) {
              writeToTerminal(`\n[diagnostics] Curl query failed: ${curlErr.message || curlErr}`);
            }
          } else {
            writeToTerminal(`\n⚠ Dev server not detected after polling — returning URL anyway`);
          }

          // ── 8. Return Ready ───────────────────────────────────────────
          const host = sandbox.getHost(port);

          // Crucial: Keep sandbox alive after API route disconnects
          try {
            if (typeof sandbox.setTimeout === 'function') {
              await sandbox.setTimeout(SANDBOX_TIMEOUT_MS);
            }
          } catch (e) {
            console.warn('[E2B] setTimeout failed or not supported', e);
          }

          sendEvent('ready', {
            sandboxId: sandbox.sandboxId,
            url: `https://${host}`,
          });

          controller.close();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to boot sandbox';
          console.error('[E2B Boot Error]', err);
          sendEvent('error', message);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}
