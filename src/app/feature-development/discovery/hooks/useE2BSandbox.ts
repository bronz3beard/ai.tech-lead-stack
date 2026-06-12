import { useState, useRef, useCallback, useEffect } from 'react';
import { Sandbox } from 'e2b';
import { ISandboxService } from '../types/sandbox';
import { flattenTree } from '../utils/tree-helpers';

export function useE2BSandbox() {
  const [status, setStatus] = useState<ISandboxService['status']>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [hydrationStatus, setHydrationStatus] = useState('');
  const [isHydrating, setIsHydrating] = useState(false);
  
  // UI State matching previous WebContainer logic
  const [writtenFiles, setWrittenFiles] = useState<{ path: string; status: 'writing' | 'done' | 'error' }[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

  const sandboxRef = useRef<Sandbox | null>(null);

  const writeToTerminal = useCallback((data: string) => {
    setTerminalOutput(prev => [...prev, data]);
  }, []);

  const isSandboxReady = status === 'running';

  // Sync state for loading file content
  useEffect(() => {
    async function readFileContent() {
      if (selectedFile && sandboxRef.current) {
        try {
          const content = await sandboxRef.current.files.read(selectedFile);
          setFileContent(content);
        } catch (err) {
          console.error('Failed to read file:', selectedFile, err);
          setFileContent('// Failed to load file content.');
        }
      }
    }
    readFileContent();
  }, [selectedFile]);

  const boot = async (files: Record<string, string>) => {
    if (sandboxRef.current) return;
    setStatus('booting');
    setIsHydrating(true);
    setSandboxError(null);
    setTerminalOutput([]);

    try {
      setHydrationStatus('Provisioning E2B Sandbox...');
      
      const apiKey = process.env.NEXT_PUBLIC_E2B_API_KEY || process.env.E2B_API_KEY;
      
      const sandbox = await Sandbox.create('ubuntu', { apiKey });
      sandboxRef.current = sandbox;
      
      setHydrationStatus('Writing project files...');
      for (const [filePath, content] of Object.entries(files)) {
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
          onStderr: writeToTerminal
        });
      }

      setHydrationStatus(`Installing dependencies with ${pkgManager}...`);
      writeToTerminal(`\n$ ${pkgManager} install`);
      const installCmd = await sandbox.commands.run(`${pkgManager} install`, {
        onStdout: writeToTerminal,
        onStderr: writeToTerminal
      });

      if (installCmd.exitCode !== 0) {
        throw new Error(`${pkgManager} install failed. Check terminal logs.`);
      }

      setHydrationStatus('Starting development server...');
      
      let startCmdStr = hasDevScript ? `${pkgManager} run dev` : 'npm start';
      if (isVite && !startCmdStr.includes('--host')) {
        startCmdStr += ' -- --host 0.0.0.0';
      }
      
      writeToTerminal(`\n$ ${startCmdStr}`);
      
      sandbox.commands.run(startCmdStr, {
        background: true,
        onStdout: writeToTerminal,
        onStderr: writeToTerminal
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const port = isVite ? 5173 : 3000;
      const host = sandbox.getHost(port);
      setPreviewUrl(`https://${host}`);
      
      setStatus('running');
      setHydrationStatus('Environment ready');
    } catch (e: any) {
      console.error('[E2B Sandbox Error]', e);
      setSandboxError(e.message || 'Failed to boot E2B sandbox');
      setStatus('error');
    } finally {
      setIsHydrating(false);
    }
  };

  const kill = async () => {
    if (sandboxRef.current) {
      await sandboxRef.current.kill();
      sandboxRef.current = null;
      setStatus('idle');
      setPreviewUrl(null);
      setTerminalOutput([]);
    }
  };

  const handleWriteFile = async (path: string, content: string) => {
    if (!sandboxRef.current) return;

    setWrittenFiles((prev) => {
      const exists = prev.find((f) => f.path === path);
      if (exists) return prev.map((f) => f.path === path ? { ...f, status: 'writing' } : f);
      return [...prev, { path, status: 'writing' }];
    });

    try {
      const parts = path.split('/');
      if (parts.length > 1) {
        const dir = path.substring(0, path.lastIndexOf('/'));
        await sandboxRef.current.commands.run(`mkdir -p "${dir}"`);
      }
      
      await sandboxRef.current.files.write(path, content);

      setWrittenFiles((prev) =>
        prev.map((f) => (f.path === path ? { ...f, status: 'done' } : f))
      );
    } catch (err) {
      console.error('Failed to write file:', path, err);
      setWrittenFiles((prev) =>
        prev.map((f) => (f.path === path ? { ...f, status: 'error' } : f))
      );
      setSandboxError(`Failed to write file: ${path}`);
    }
  };

  const hydrateProject = async (projectId: string) => {
    if (!projectId) return;

    setIsHydrating(true);
    setHydrationStatus('Fetching project bundle...');
    try {
      const res = await fetch(`/api/orchestrator/discovery/project-bundle?projectId=${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch bundle');
      const { bundle } = await res.json();

      const flatFiles = flattenTree(bundle);
      setWrittenFiles(flatFiles);

      // Convert WebContainer bundle format to flat Record<string, string>
      const filesRecord: Record<string, string> = {};
      
      // Helper to recursively parse the bundle
      const parseBundle = (node: any, currentPath: string = '') => {
        for (const [name, entry] of Object.entries(node)) {
          const itemPath = currentPath ? `${currentPath}/${name}` : name;
          const anyEntry = entry as any;
          if (anyEntry.file && anyEntry.file.contents) {
            // Some WebContainer files are Uint8Arrays, E2B write takes string, Uint8Array
            let contents = anyEntry.file.contents;
            if (typeof contents !== 'string') {
               // naive string conversion for code files
               contents = new TextDecoder().decode(contents);
            }
            filesRecord[itemPath] = contents;
          } else if (anyEntry.directory) {
            parseBundle(anyEntry.directory, itemPath);
          }
        }
      };
      
      parseBundle(bundle);

      await boot(filesRecord);
    } catch (err: any) {
      console.error('Hydration failed:', err);
      setSandboxError('Hydration failed, falling back.');
    } finally {
      setIsHydrating(false);
      setHydrationStatus('');
    }
  };

  const syncFilesystem = async () => {
    // E2B sandbox doesn't need to sync the entire filesystem because the files
    // are already tracked in `writtenFiles` via `hydrateProject` and `handleWriteFile`.
    // We could implement a deep scan if necessary, but this satisfies the API.
  };

  return {
    isSandboxReady,
    sandboxRef,
    writtenFiles,
    previewUrl,
    terminalOutput,
    sandboxError,
    isHydrating,
    hydrationStatus,
    selectedFile,
    fileContent,
    viewMode,
    setSandboxError,
    setSelectedFile,
    setViewMode,
    setTerminalOutput,
    syncFilesystem,
    handleWriteFile,
    hydrateProject,
    setFileContent,
    setWrittenFiles,
    kill,
  };
}
