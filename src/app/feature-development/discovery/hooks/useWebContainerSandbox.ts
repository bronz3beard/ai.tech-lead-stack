import { WebContainer } from '@webcontainer/api';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DEV_SERVER_ENV } from '../constants/stubs';
import { scanFileSystem } from '../utils/fs-helpers';
import { sanitizeSandboxEnvironment } from '../utils/sandbox-sanitizer';
import { flattenTree } from '../utils/tree-helpers';
import { flattenWorkspace } from '../utils/workspace-flattener';

/**
 * Singleton promise to ensure WebContainer.boot() is only called once
 * throughout the application lifecycle.
 */
let webContainerInstancePromise: Promise<WebContainer> | null = null;

async function getWebContainerInstance() {
  if (typeof window === 'undefined') return null;
  if (!webContainerInstancePromise) {
    webContainerInstancePromise = WebContainer.boot();
  }
  return webContainerInstancePromise;
}

export function useWebContainerSandbox() {
  const [isSandboxReady, setIsSandboxReady] = useState(false);
  const [webContainer, setWebContainer] = useState<WebContainer | null>(null);
  const [writtenFiles, setWrittenFiles] = useState<
    { path: string; status: 'writing' | 'done' | 'error' }[]
  >([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDevServerStarted, setIsDevServerStarted] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(false);
  const [hydrationStatus, setHydrationStatus] = useState('');
  const [isRefreshingFiles, setIsRefreshingFiles] = useState(false);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

  const devServerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const webContainerRef = useRef<WebContainer | null>(null);

  useEffect(() => {
    webContainerRef.current = webContainer;
  }, [webContainer]);

  // Sync state for loading file content
  useEffect(() => {
    async function readFile() {
      if (selectedFile && webContainer) {
        try {
          const content = await webContainer.fs.readFile(selectedFile, 'utf-8');
          setFileContent(content);
        } catch (err) {
          console.error('Failed to read file:', selectedFile, err);
          setFileContent('// Failed to load file content.');
        }
      }
    }
    readFile();
  }, [selectedFile, webContainer]);

  // WebContainer Initial Boot Sequence
  useEffect(() => {
    async function boot() {
      try {
        console.log('Booting WebContainer...');
        const instance = await getWebContainerInstance();
        if (instance) {
          setWebContainer(instance);
          setIsSandboxReady(true);
          console.log('WebContainer ready.');

          // Verify Node.js version
          const versionProcess = await instance.spawn('node', ['-v']);
          versionProcess.output.pipeTo(
            new WritableStream({
              write(data) {
                console.log(`[Sandbox] Node version: ${data.trim()}`);
              },
            })
          );
        }
      } catch (err) {
        console.error('WebContainer boot failed:', err);
        setSandboxError('Failed to initialize development environment.');
      }
    }
    if (typeof window !== 'undefined' && !webContainer) {
      boot();
    }
  }, [webContainer]);

  const syncFilesystem = async (instance: WebContainer) => {
    const allFiles = await scanFileSystem(instance);
    setWrittenFiles(allFiles);
  };

  /**
   * Build the full spawn environment with the NODE_OPTIONS --require patch.
   * This ensures every child process (install, pre-builds, setup scripts, dev server)
   * inherits the readFileSync large-file stabilizer that prevents RangeError VFS overflow crashes.
   *
   * @param appDir - The application directory relative to the VFS root.
   */
  const buildPatchedEnv = (appDir = '.') => {
    const absolutePatchPath = '/tmp/async-storage-patch.js';
    return {
      ...DEV_SERVER_ENV,
      NODE_OPTIONS:
        `${DEV_SERVER_ENV.NODE_OPTIONS || ''} --require ${absolutePatchPath}`.trim(),
    };
  };

  const startDevServer = async (instance: WebContainer) => {
    if (isDevServerStarted) return;
    setIsDevServerStarted(true);
    let appDir = '.';

    setHydrationStatus('Detecting application structure...');

    try {
      try {
        const scanForApp = async (
          dir: string,
          depth = 0
        ): Promise<string | null> => {
          if (depth > 3) return null;
          let entries: any[] = [];
          try {
             entries = await instance.fs.readdir(dir, { withFileTypes: true });
          } catch(e) { return null; }

          const fileNames = entries.map((e: any) => e.name);
          const hasConfig = fileNames.some((f: string) => f.includes('config.js') || f.includes('config.ts') || f.includes('config.mjs') || f === 'package.json' || f === 'project.json');
          
          let hasAppOrPages = false;
          if (fileNames.includes('app') || fileNames.includes('pages')) {
            hasAppOrPages = true;
          } else if (fileNames.includes('src')) {
            try {
              const srcFiles = await instance.fs.readdir(dir === '.' ? 'src' : `${dir}/src`);
              if (srcFiles.includes('app') || srcFiles.includes('pages')) {
                hasAppOrPages = true;
              }
            } catch (e) {}
          }

          // Robust match: Must have app/pages routing directory AND either some config file (package/project/next config) OR be in a subdirectory
          if (hasAppOrPages && (hasConfig || depth > 0)) {
            return dir;
          }

          for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === 'src' || entry.name === 'dist' || entry.name === 'build') continue;
            try {
              if (entry.isDirectory()) {
                const path = dir === '.' ? entry.name : `${dir}/${entry.name}`;
                const found = await scanForApp(path, depth + 1);
                if (found) return found;
              }
            } catch {}
          }
          return null;
        };

        const detectedDir = await scanForApp('.');
        if (detectedDir && detectedDir !== '.') {
          appDir = detectedDir;
          console.log(`[Discovery] Automatically detected app in: ${appDir}`);
        }
      } catch (e) {
        console.warn('Strict app detection failed:', e);
      }

      setHydrationStatus('Analyzing configuration...');
      let pkg: any = {};
      let isPnpm = false;

      // Detect package manager
      try {
        const files = await instance.fs.readdir('.');
        if (
          files.includes('pnpm-lock.yaml') ||
          files.includes('pnpm-workspace.yaml')
        ) {
          isPnpm = true;
          console.log('[Discovery] pnpm detected');
        }
      } catch (e) {
        console.warn('Failed to readdir:', e);
      }

      const sanitizePackageJson = async (pkgPath: string) => {
        try {
          const content = await instance.fs.readFile(pkgPath, 'utf-8');
          const p = JSON.parse(content);
          let hasChanges = false;

          const sanitizeDeps = (deps?: Record<string, string>) => {
            if (!deps) return;
            for (const key in deps) {
              const value = deps[key];
              if (
                typeof value === 'string' &&
                (value.startsWith('file:') ||
                  value.includes('.git') ||
                  value.startsWith('workspace:') ||
                  value.startsWith('link:') ||
                  value.startsWith('github:'))
              ) {
                console.log(
                  `[Sanitizer] Removing incompatible dependency from ${pkgPath}: ${key} -> ${value}`
                );
                delete deps[key];
                hasChanges = true;
              }
            }
          };

          sanitizeDeps(p.dependencies);
          sanitizeDeps(p.devDependencies);

          const nextVersion = p.dependencies?.next || p.devDependencies?.next;
          if (nextVersion) {
            let exactVersion = nextVersion.replace(/[~^>=<]/g, '').trim();
            if (exactVersion.startsWith('15.5.')) {
              exactVersion = '15.5.15';
            } else if (exactVersion.startsWith('15.4.')) {
              exactVersion = '15.4.8';
            } else if (exactVersion.startsWith('15.1.')) {
              exactVersion = '15.1.9';
            } else if (exactVersion.startsWith('15.0.')) {
              exactVersion = '15.0.5';
            } else if (exactVersion.startsWith('14.')) {
              exactVersion = '14.2.33';
            } else if (
              exactVersion === 'latest' ||
              exactVersion === 'canary' ||
              !exactVersion
            ) {
              exactVersion = '15.5.15';
            }

            console.log(
              `[SWC Injection] Pre-installing exact local WASM SWC compiler in ${pkgPath}: ${exactVersion}`
            );
            p.devDependencies = p.devDependencies || {};
            p.devDependencies['@next/swc-wasm-nodejs'] = exactVersion;
            p.devDependencies['@next/swc-wasm-web'] = exactVersion;
            hasChanges = true;
          }

          if (p.engines?.pnpm) {
            console.log(
              `[Sanitizer] Removing engines.pnpm requirement from ${pkgPath}: ${p.engines.pnpm}`
            );
            delete p.engines.pnpm;
            if (Object.keys(p.engines).length === 0) {
              delete p.engines;
            }
            hasChanges = true;
          }

          if (p.scripts?.dev) {
            const devScript = p.scripts.dev as string;
            if (
              devScript.includes('next dev') &&
              !devScript.includes('FAST_REFRESH=false')
            ) {
              console.log(
                `[Sanitizer] Injecting FAST_REFRESH=false to Next.js dev script in ${pkgPath} to stabilize hot-reloading loops`
              );
              p.scripts.dev = devScript.replace(
                'next dev',
                'FAST_REFRESH=false next dev'
              );
              hasChanges = true;
            }
          }

          if (hasChanges) {
            await instance.fs.writeFile(pkgPath, JSON.stringify(p, null, 2));
          }
          return p;
        } catch (err: any) {
          if (err?.code !== 'ENOENT' && !err?.message?.includes('ENOENT')) {
            console.warn(`[Sanitizer] Failed to sanitize package.json at ${pkgPath}:`, err.message || err);
          }
          return null;
        }
      };

      try {
        pkg = await sanitizePackageJson('package.json');
      } catch {}

      if (!pkg) {
        console.warn('No package.json found, creating fallback...');
        const fallbackPkg = {
          name: 'prototype',
          type: 'module',
          dependencies: {
            react: '^19.0.0',
            'react-dom': '^19.0.0',
            'lucide-react': 'latest',
            next: 'latest',
          },
          scripts: { dev: 'next dev -p 3000' },
          engines: { node: '>=22.0.0' },
        };
        await instance.fs.writeFile(
          'package.json',
          JSON.stringify(fallbackPkg, null, 2)
        );
        pkg = fallbackPkg;
      }

      let appPkg: any = null;
      if (appDir && appDir !== '.') {
        try {
          appPkg = await sanitizePackageJson(`${appDir}/package.json`);
        } catch {}
      }

      const activePkg = appPkg || pkg;

      const isNext =
        pkg?.dependencies?.next ||
        pkg?.devDependencies?.next ||
        appPkg?.dependencies?.next ||
        appPkg?.devDependencies?.next;
      const isVite =
        pkg?.dependencies?.vite ||
        pkg?.devDependencies?.vite ||
        appPkg?.dependencies?.vite ||
        appPkg?.devDependencies?.vite;
      const isAngular =
        pkg?.dependencies?.['@angular/core'] ||
        pkg?.devDependencies?.['@angular/core'] ||
        appPkg?.dependencies?.['@angular/core'] ||
        appPkg?.devDependencies?.['@angular/core'];
      const isRemix =
        pkg?.dependencies?.['@remix-run/dev'] ||
        pkg?.devDependencies?.['@remix-run/dev'] ||
        pkg?.dependencies?.['@remix-run/react'] ||
        pkg?.devDependencies?.['@remix-run/react'] ||
        appPkg?.dependencies?.['@remix-run/dev'] ||
        appPkg?.devDependencies?.['@remix-run/dev'] ||
        appPkg?.dependencies?.['@remix-run/react'] ||
        appPkg?.devDependencies?.['@remix-run/react'];
      const isNuxt =
        pkg?.dependencies?.nuxt ||
        pkg?.devDependencies?.nuxt ||
        appPkg?.dependencies?.nuxt ||
        appPkg?.devDependencies?.nuxt;
      const isAstro =
        pkg?.dependencies?.astro ||
        pkg?.devDependencies?.astro ||
        appPkg?.dependencies?.astro ||
        appPkg?.devDependencies?.astro;
      const isSvelteKit =
        pkg?.dependencies?.['@sveltejs/kit'] ||
        pkg?.devDependencies?.['@sveltejs/kit'] ||
        appPkg?.dependencies?.['@sveltejs/kit'] ||
        appPkg?.devDependencies?.['@sveltejs/kit'];

      const hasDevScript = activePkg?.scripts?.dev;

      // Extracted Sandbox Utilities
      setHydrationStatus('Sanitizing environment and flattening workspace...');
      try {
        await sanitizeSandboxEnvironment(instance, appDir);
        await flattenWorkspace(instance);
        setTerminalOutput((prev) => [
          ...prev,
          '\n[WebContainer] Workspace flattened and system stabilized.',
        ]);
      } catch (e) {
        console.warn('[Discovery] Sandbox utilities failed:', e);
      }

      // 2. Install Dependencies
      // 1.8 Create .npmrc for hoisted dependency layout to bypass WASM VFS symlink overflow
      try {
        await instance.fs.writeFile(
          '.npmrc',
          'node-linker=hoisted\nsymlink=false\n'
        );
        console.log('[Discovery] Created flat dependency node-linker .npmrc');
      } catch (err) {
        console.warn('[Discovery] Failed to write .npmrc:', err);
      }

      // 2. Install Dependencies
      const pkgManager = isPnpm ? 'pnpm' : 'npm';
      setHydrationStatus(`Installing dependencies (${pkgManager})...`);
      const installArgs = isPnpm
        ? [
            'install',
            '--no-frozen-lockfile',
            '--no-lockfile',
            '--ignore-scripts',
          ]
        : [
            'install',
            '--prefer-offline',
            '--no-audit',
            '--no-package-lock',
            '--ignore-scripts',
          ];

      setTerminalOutput((prev) => [
        ...prev,
        `\n$ ${pkgManager} ${installArgs.join(' ')}`,
      ]);
      const installProcess = await instance.spawn(pkgManager, installArgs, {
        env: buildPatchedEnv('.'),
      });

      installProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            setTerminalOutput((prev) => [...prev, data]);
          },
        })
      );

      const installExitCode = await installProcess.exit;

      if (installExitCode !== 0) {
        setSandboxError(
          `${pkgManager} install failed. Check terminal for details.`
        );
        setIsDevServerStarted(false);
        return;
      }

      // Native workspace linking bypasses the need for legacy Nx CLI mocking and pre-build stubs.

      // We rely on the chunked readFileSync patch in async-hooks-patch.ts
      // to securely bypass the 1MB sync-bridge limit for large SWC WASM files,
      // avoiding any fatal WASM traps during Next.js boot.
      // 3. Start Dev Server
      setHydrationStatus('Starting development server...');
      let cmd = isPnpm ? 'pnpm' : 'npm';
      let args = ['run', 'dev'];

      if (!hasDevScript) {
        if (isNext) {
          cmd = isPnpm ? 'pnpm' : 'npx';
          args = isPnpm ? ['exec', 'next', 'dev', '-p', '3000'] : ['next', 'dev', '-p', '3000'];
        } else if (isAngular) {
          cmd = isPnpm ? 'pnpm' : 'npx';
          args = isPnpm ? ['exec', 'ng', 'serve', '--port', '3000', '--host', '0.0.0.0'] : ['ng', 'serve', '--port', '3000', '--host', '0.0.0.0'];
        } else if (isRemix) {
          cmd = isPnpm ? 'pnpm' : 'npx';
          args = isPnpm ? ['exec', 'remix', 'vite:dev', '--port', '3000', '--host', '0.0.0.0'] : ['remix', 'vite:dev', '--port', '3000', '--host', '0.0.0.0'];
        } else if (isNuxt) {
          cmd = isPnpm ? 'pnpm' : 'npx';
          args = isPnpm ? ['exec', 'nuxi', 'dev', '--port', '3000', '--host', '0.0.0.0'] : ['nuxi', 'dev', '--port', '3000', '--host', '0.0.0.0'];
        } else if (isAstro) {
          cmd = isPnpm ? 'pnpm' : 'npx';
          args = isPnpm ? ['exec', 'astro', 'dev', '--port', '3000', '--host', '0.0.0.0'] : ['astro', 'dev', '--port', '3000', '--host', '0.0.0.0'];
        } else if (isSvelteKit) {
          cmd = isPnpm ? 'pnpm' : 'npx';
          args = isPnpm ? ['exec', 'vite', 'dev', '--port', '3000', '--host'] : ['vite', 'dev', '--port', '3000', '--host'];
        } else if (isVite) {
          cmd = isPnpm ? 'pnpm' : 'npx';
          args = isPnpm ? ['exec', 'vite', '--port', '3000', '--host'] : ['vite', '--port', '3000', '--host'];
        }
      } else if (isNext && hasDevScript) {
        // Strip --turbo from existing dev scripts to prevent Turbopack loading SWC
        const devScript = activePkg.scripts.dev as string;
        if (devScript && devScript.includes('--turbo')) {
          activePkg.scripts.dev = devScript.replace(/\s*--turbo\b/g, '');
          const pkgPath =
            appPkg ? `${appDir}/package.json` : 'package.json';
          await instance.fs.writeFile(pkgPath, JSON.stringify(activePkg, null, 2));
        }
      }

      setTerminalOutput((prev) => [...prev, `\n$ ${cmd} ${args.join(' ')}`]);
      const devProcess = await instance.spawn(cmd, args, {
        cwd: appDir,
        env: buildPatchedEnv(appDir),
      });

      devProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            setTerminalOutput((prev) => [...prev, data]);
          },
        })
      );

      return new Promise<void>((resolve) => {
        instance.on('server-ready', (_port, url) => {
          console.log(`[Discovery] Server ready on port ${_port}: ${url}`);
          setHydrationStatus('Finalizing environment...');
          setPreviewUrl(url);
          resolve();
        });
        setTimeout(() => resolve(), 60000);
      });
    } catch (err) {
      console.error('Dev server failed:', err);
      setIsDevServerStarted(false);
      setSandboxError('Dev server failed to start. See terminal for details.');
    }
  };

  const handleWriteFile = async (path: string, content: string) => {
    let container = webContainerRef.current;
    if (!container) {
      console.log('webContainerRef is not initialized yet. Polling...');
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        container = webContainerRef.current;
        if (container) break;
      }
    }

    if (!container) {
      const errMsg =
        'Development environment is not initialized yet. Please wait for it to boot and try again.';
      setSandboxError(errMsg);
      throw new Error(errMsg);
    }

    setWrittenFiles((prev) => {
      const exists = prev.find((f) => f.path === path);
      if (exists)
        return prev.map((f) =>
          f.path === path ? { ...f, status: 'writing' } : f
        );
      return [...prev, { path, status: 'writing' }];
    });

    try {
      const parts = path.split('/');
      if (parts.length > 1) {
        let current = '';
        for (let i = 0; i < parts.length - 1; i++) {
          current += (current ? '/' : '') + parts[i];
          try {
            await container.fs.mkdir(current, { recursive: true });
          } catch (_) {}
        }
      }
      await container.fs.writeFile(path, content);

      setWrittenFiles((prev) =>
        prev.map((f) => (f.path === path ? { ...f, status: 'done' } : f))
      );

      if (devServerTimeoutRef.current)
        clearTimeout(devServerTimeoutRef.current);
      devServerTimeoutRef.current = setTimeout(() => {
        if (container) startDevServer(container);
      }, 2500);
    } catch (err) {
      console.error('Failed to write file:', path, err);
      setWrittenFiles((prev) =>
        prev.map((f) => (f.path === path ? { ...f, status: 'error' } : f))
      );
      setSandboxError(`Failed to write file: ${path}`);
      throw err;
    }
  };

  const hydrateProject = async (projectId: string) => {
    if (!projectId) return;

    setIsHydrating(true);
    setHydrationStatus('Fetching project bundle...');
    try {
      const res = await fetch(
        `/api/orchestrator/discovery/project-bundle?projectId=${projectId}`
      );
      if (!res.ok) throw new Error('Failed to fetch bundle');
      const { bundle } = await res.json();

      setHydrationStatus('Booting sandbox...');
      let instance = webContainer;
      if (!instance) {
        instance = await getWebContainerInstance();
        if (instance) setWebContainer(instance);
      }

      if (instance) {
        setHydrationStatus('Mounting repository...');
        await instance.mount(bundle);

        const hydratedFiles = flattenTree(bundle);
        setWrittenFiles(hydratedFiles);

        setHydrationStatus('Preparing runtime environment...');
        await startDevServer(instance);
      }
    } catch (err: any) {
      console.error('Hydration failed:', err);
      toast.error('Hydration failed, falling back to Template Mode.');
    } finally {
      setIsHydrating(false);
      setHydrationStatus('');
    }
  };

  const refreshProjectFiles = async (projectId: string) => {
    if (!projectId || !webContainer) return;

    setIsRefreshingFiles(true);
    setHydrationStatus('Refreshing files...');
    try {
      const res = await fetch(
        `/api/orchestrator/discovery/project-bundle?projectId=${projectId}`
      );
      if (!res.ok) throw new Error('Failed to fetch bundle');
      const { bundle } = await res.json();

      setHydrationStatus('Writing updated files...');

      const writeTree = async (tree: any, parentPath = '') => {
        for (const name in tree) {
          const item = tree[name];
          const currentPath = parentPath ? `${parentPath}/${name}` : name;
          if (item.directory) {
            try {
              await webContainer.fs.mkdir(currentPath, { recursive: true });
            } catch (_) {}
            await writeTree(item.directory, currentPath);
          } else if (item.file) {
            await webContainer.fs.writeFile(currentPath, item.file.contents);
          }
        }
      };

      await writeTree(bundle);

      // Re-flatten the tree to sync file list in sidebar
      const updatedFiles = flattenTree(bundle);
      setWrittenFiles(updatedFiles);

      // Re-read selected file if any is currently active to refresh the code editor view
      if (selectedFile) {
        try {
          const content = await webContainer.fs.readFile(selectedFile, 'utf-8');
          setFileContent(content);
        } catch (_) {}
      }

      toast.success('Files refreshed successfully!');
    } catch (err: any) {
      console.error('File refresh failed:', err);
      toast.error('Failed to refresh files.');
    } finally {
      setIsRefreshingFiles(false);
      setHydrationStatus('');
    }
  };

  return {
    isSandboxReady,
    webContainer,
    getWebContainer: () => webContainerRef.current,
    writtenFiles,
    previewUrl,
    isDevServerStarted,
    terminalOutput,
    sandboxError,
    isHydrating,
    hydrationStatus,
    isRefreshingFiles,
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
    refreshProjectFiles,
    setFileContent,
    setWrittenFiles,
  };
}
