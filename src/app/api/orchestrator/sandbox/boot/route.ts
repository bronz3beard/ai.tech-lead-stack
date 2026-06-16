import { NextRequest } from 'next/server';
import { Sandbox } from 'e2b';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

export const maxDuration = 300; // Allow long-running setups
export const dynamic = 'force-dynamic';

/** @desc 15 minutes — gives npm install plenty of time on a cold sandbox */
const SANDBOX_TIMEOUT_MS = 15 * 60 * 1000;

/** @desc 10 minutes — upper bound for dependency installation */
const INSTALL_TIMEOUT_MS = 10 * 60 * 1000;

/** @desc Max attempts to poll for the dev server port (30s total) */
const PORT_POLL_MAX_ATTEMPTS = 15;
const PORT_POLL_INTERVAL_MS = 2000;

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
async function pollForPort(sandbox: Sandbox, port: number, sendLog: (msg: string) => void): Promise<boolean> {
  for (let i = 0; i < PORT_POLL_MAX_ATTEMPTS; i++) {
    try {
      const check = await sandbox.commands.run(
        `curl -s -o /dev/null -w "%{http_code}" http://localhost:${port} 2>/dev/null`,
        { timeoutMs: 5000 }
      );
      const raw = check.stdout.trim();
      // Extract only the first valid 3-digit HTTP status code (1xx-5xx)
      const match = raw.match(/([1-5]\d{2})/);
      const httpCode = match ? match[1] : '000';
      sendLog(`  [port-check] attempt ${i + 1}/${PORT_POLL_MAX_ATTEMPTS} → HTTP ${httpCode}`);

      if (match) {
        return true;
      }
    } catch {
      sendLog(`  [port-check] attempt ${i + 1}/${PORT_POLL_MAX_ATTEMPTS} → connection refused`);
    }
    await new Promise((r) => setTimeout(r, PORT_POLL_INTERVAL_MS));
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const { filesRecord } = await req.json();

    if (!filesRecord || typeof filesRecord !== 'object') {
      return new Response('Invalid filesRecord', { status: 400 });
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
          });

          console.log('[E2B Boot] Sandbox created:', sandbox.sandboxId);
          sendEvent('status', 'Sandbox provisioned. Writing project files...');

          // ── 2. Write Project Files ────────────────────────────────────
          const entries = Object.entries(filesRecord);
          sendEvent('log', `\nWriting ${entries.length} files to sandbox...`);

          // Collect unique directories first, create them in one shot
          const dirs = new Set<string>();
          for (const [filePath] of entries) {
            const dir = filePath.substring(0, filePath.lastIndexOf('/'));
            if (dir) dirs.add(dir);
          }

          if (dirs.size > 0) {
            const mkdirCmd = Array.from(dirs).map((d) => `"${d}"`).join(' ');
            await sandbox.commands.run(`mkdir -p ${mkdirCmd}`, { timeoutMs: 10000 });
          }

          for (const [filePath, content] of entries) {
            await sandbox.files.write(filePath, content as string);
          }

          sendEvent('log', `✓ ${entries.length} files written`);

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
              // Fallback to string matching if JSON.parse fails (e.g. trailing commas, comments)
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

          // ── 6. Start Dev Server ───────────────────────────────────────
          sendEvent('status', 'Starting development server...');

          // Build the hostname binding flag for the detected framework
          const hostnameFlag = isNext ? '--hostname 0.0.0.0' : isVite ? '--host 0.0.0.0' : '';

          let startCmdStr: string;
          if (hasDevScript) {
            // Root package.json has a dev script — use it with passthrough flags
            startCmdStr = hostnameFlag
              ? `${pkgManager} run dev -- ${hostnameFlag}`
              : `${pkgManager} run dev`;
          } else if (isNx) {
            if (nxDefaultProject) {
              startCmdStr = hostnameFlag
                ? `npx nx serve ${nxDefaultProject} -- ${hostnameFlag}`
                : `npx nx serve ${nxDefaultProject}`;
            } else {
              startCmdStr = 'npx nx run-many -t serve';
            }
          } else if (isTurbo) {
            startCmdStr = 'npx turbo run dev';
          } else {
            startCmdStr = isNext
              ? 'npx next dev --hostname 0.0.0.0'
              : isVite
                ? 'npx vite dev --host 0.0.0.0'
                : `${pkgManager} run dev`;
          }

          writeToTerminal(`\n$ ${startCmdStr}`);

          // Run dev server in the background — fire and forget
          sandbox.commands.run(startCmdStr, {
            background: true,
            onStdout: writeToTerminal,
            onStderr: writeToTerminal,
            envs: {
              HOST: '0.0.0.0',
              HOSTNAME: '0.0.0.0',
            }
          });

          // ── 7. Wait for Port ──────────────────────────────────────────
          const port = isNext ? 3000 : isVite ? 5173 : 3000;
          sendEvent('status', `Waiting for dev server on port ${port}...`);

          const portReady = await pollForPort(sandbox, port, writeToTerminal);

          if (portReady) {
            writeToTerminal(`\n✓ Dev server detected on port ${port}`);
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
