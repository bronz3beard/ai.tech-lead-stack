import { Sandbox } from 'e2b';
import { useCallback, useRef, useState } from 'react';
import { FileNode } from '../types';
import { ISandboxService } from '../types/sandbox';

export function useE2BSandbox(): ISandboxService & {
  terminalOutput: string[];
  hydrationStatus: string;
  isHydrating: boolean;
} {
  const [status, setStatus] = useState<ISandboxService['status']>('idle');
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [hydrationStatus, setHydrationStatus] = useState('');
  const [isHydrating, setIsHydrating] = useState(false);

  const sandboxRef = useRef<Sandbox | null>(null);

  const writeToTerminal = useCallback((data: string) => {
    setTerminalOutput((prev) => [...prev, data]);
  }, []);

  const boot = async (files: Record<string, string>) => {
    if (sandboxRef.current) return;
    setStatus('booting');
    setIsHydrating(true);
    setError(null);
    setTerminalOutput([]);

    try {
      setHydrationStatus('Provisioning E2B Sandbox...');

      // We read the API key from NEXT_PUBLIC_E2B_API_KEY.
      // In a production scenario with sensitive keys, this would be proxied via a backend route.
      const apiKey =
        process.env.NEXT_PUBLIC_E2B_API_KEY || process.env.E2B_API_KEY;

      // Create a default sandbox. The 'ubuntu' template provides a standard Linux environment.
      // The e2b core SDK handles the underlying Firecracker microVM.
      const sandbox = await Sandbox.create('ubuntu', { apiKey });
      sandboxRef.current = sandbox;

      setHydrationStatus('Writing project files...');
      for (const [filePath, content] of Object.entries(files)) {
        // E2B sandbox.files.makeDir doesn't support recursive 'mkdir -p' perfectly out of the box in all older versions
        // but we can execute a shell command to make sure directories exist
        const dir = filePath.substring(0, filePath.lastIndexOf('/'));
        if (dir) {
          await sandbox.commands.run(`mkdir -p "${dir}"`);
        }
        await sandbox.files.write(filePath, content);
      }

      setHydrationStatus('Analyzing configuration...');
      let isPnpm = false;
      let hasDevScript = false;
      let isVite = false;

      try {
        const pkgStr = await sandbox.files.read('package.json');
        const pkg = JSON.parse(pkgStr);
        if (pkg.scripts?.dev) {
          hasDevScript = true;
        }
        if (pkg.dependencies?.vite || pkg.devDependencies?.vite) {
          isVite = true;
        }
      } catch (e) {
        console.warn('Failed to parse package.json', e);
      }

      try {
        await sandbox.files.read('pnpm-lock.yaml');
        isPnpm = true;
      } catch {}

      const pkgManager = isPnpm ? 'pnpm' : 'npm';

      if (isPnpm) {
        setHydrationStatus('Installing pnpm...');
        writeToTerminal('\n$ npm install -g pnpm');
        await sandbox.commands.run('npm install -g pnpm', {
          onStdout: writeToTerminal,
          onStderr: writeToTerminal,
        });
      }

      setHydrationStatus(`Installing dependencies with ${pkgManager}...`);
      writeToTerminal(`\n$ ${pkgManager} install`);
      const installCmd = await sandbox.commands.run(`${pkgManager} install`, {
        onStdout: writeToTerminal,
        onStderr: writeToTerminal,
      });

      if (installCmd.exitCode !== 0) {
        throw new Error(`${pkgManager} install failed. Check terminal logs.`);
      }

      setHydrationStatus('Starting development server...');

      let startCmdStr = hasDevScript ? `${pkgManager} run dev` : 'npm start';
      // Adjust start command to expose host properly if needed
      if (isVite && !startCmdStr.includes('--host')) {
        startCmdStr += ' -- --host 0.0.0.0';
      }

      writeToTerminal(`\n$ ${startCmdStr}`);

      // Start dev server in the background
      sandbox.commands.run(startCmdStr, {
        background: true,
        onStdout: writeToTerminal,
        onStderr: writeToTerminal,
      });

      // Give the server a moment to bind to the port
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const port = isVite ? 5173 : 3000;
      const host = sandbox.getHost(port);
      setServerUrl(`https://${host}`);

      setStatus('running');
      setHydrationStatus('Environment ready');
    } catch (e: any) {
      console.error('[E2B Sandbox Error]', e);
      setError(e.message || 'Failed to boot E2B sandbox');
      setStatus('error');
    } finally {
      setIsHydrating(false);
    }
  };

  const restartDevServer = async () => {
    // For a fully robust implementation, we would track the background process ID and kill it,
    // then restart the command.
    writeToTerminal(
      '\n[System] Restarting dev server is currently not fully implemented.'
    );
  };

  const kill = async () => {
    if (sandboxRef.current) {
      await sandboxRef.current.kill();
      sandboxRef.current = null;
      setStatus('idle');
      setServerUrl(null);
      setTerminalOutput([]);
    }
  };

  const writeFile = async (path: string, content: string) => {
    if (sandboxRef.current) {
      await sandboxRef.current.files.write(path, content);
      // Because the dev server is running on E2B, this triggers HMR automatically
    }
  };

  const readFile = async (path: string) => {
    if (sandboxRef.current) {
      return await sandboxRef.current.files.read(path);
    }
    throw new Error('Sandbox not running');
  };

  const listDir = async (path: string = '.'): Promise<FileNode[]> => {
    if (!sandboxRef.current) return [];
    try {
      const items = await sandboxRef.current.files.list(path);
      return items.map((item) => ({
        name: item.name,
        path: path === '.' ? item.name : `${path}/${item.name}`,
        isDirectory: item.type === 'dir',
        children: [],
      }));
    } catch (e) {
      console.error('[E2B Sandbox fs.list Error]', e);
      return [];
    }
  };

  return {
    status,
    serverUrl,
    error,
    boot,
    restartDevServer,
    kill,
    writeFile,
    readFile,
    listDir,
    terminalOutput,
    hydrationStatus,
    isHydrating,
  };
}
