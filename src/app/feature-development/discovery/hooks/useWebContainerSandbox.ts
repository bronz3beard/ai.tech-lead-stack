import { useState, useEffect, useRef } from 'react';
import { WebContainer } from '@webcontainer/api';
import { toast } from 'sonner';
import {
  PACKAGE_JSON_STUB,
  INDEX_JS_STUB,
  NX_JS_STUB,
  TAILWIND_JS_STUB,
  DEVKIT_EXPORTS_JS_STUB,
  DEV_SERVER_ENV,
  INCOMPATIBLE_PACKAGES,
} from '../constants/stubs';
import { flattenTree } from '../utils/tree-helpers';
import { scanFileSystem } from '../utils/fs-helpers';

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

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

  const devServerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const startDevServer = async (instance: WebContainer) => {
    if (isDevServerStarted) return;
    setIsDevServerStarted(true);
    let appDir = '.';

    setHydrationStatus('Detecting application structure...');

    try {
      // 1. Detect App Directory (Exhaustive Search)
      try {
        const scanForApp = async (
          dir: string,
          depth = 0
        ): Promise<string | null> => {
          if (depth > 2) return null;
          const files = await instance.fs.readdir(dir);

          // Primary signals
          if (
            files.includes('next.config.js') ||
            files.includes('next.config.mjs') ||
            files.includes('vite.config.ts') ||
            files.includes('vite.config.js')
          ) {
            return dir;
          }

          // Secondary signals (Next.js folders)
          if (files.includes('app') || files.includes('pages')) {
            return dir;
          }

          for (const file of files) {
            if (file === 'node_modules' || file.startsWith('.')) continue;
            try {
              const path = dir === '.' ? file : `${dir}/${file}`;
              const found = await scanForApp(path, depth + 1);
              if (found) return found;
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
        console.warn('Exhaustive app detection failed:', e);
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

      try {
        const pkgContent = await instance.fs.readFile('package.json', 'utf-8');
        pkg = JSON.parse(pkgContent);

        // Sanitize incompatible dependencies
        let hasChanges = false;
        const sanitizeDeps = (deps?: Record<string, string>) => {
          if (!deps) return;
          for (const key in deps) {
            const value = deps[key];
            if (
              value.startsWith('file:') ||
              value.includes('.git') ||
              value.startsWith('github:')
            ) {
              console.log(
                `[Sanitizer] Removing incompatible dependency: ${key} -> ${value}`
              );
              delete deps[key];
              hasChanges = true;
            }
          }
        };

        sanitizeDeps(pkg.dependencies);
        sanitizeDeps(pkg.devDependencies);

        // Sanitize engines.pnpm requirement
        if (pkg.engines?.pnpm) {
          console.log(
            `[Sanitizer] Removing engines.pnpm requirement: ${pkg.engines.pnpm}`
          );
          delete pkg.engines.pnpm;
          if (Object.keys(pkg.engines).length === 0) {
            delete pkg.engines;
          }
          hasChanges = true;
        }

        if (hasChanges) {
          setHydrationStatus('Sanitizing incompatible dependencies...');
          await instance.fs.writeFile(
            'package.json',
            JSON.stringify(pkg, null, 2)
          );
        }
      } catch (e) {
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

      const isNext = pkg.dependencies?.next || pkg.devDependencies?.next;
      const isVite = pkg.dependencies?.vite || pkg.devDependencies?.vite;
      const isAngular =
        pkg.dependencies?.['@angular/core'] ||
        pkg.devDependencies?.['@angular/core'];
      const isRemix =
        pkg.dependencies?.['@remix-run/dev'] ||
        pkg.devDependencies?.['@remix-run/dev'] ||
        pkg.dependencies?.['@remix-run/react'] ||
        pkg.devDependencies?.['@remix-run/react'];
      const isNuxt = pkg.dependencies?.nuxt || pkg.devDependencies?.nuxt;
      const isAstro = pkg.dependencies?.astro || pkg.devDependencies?.astro;
      const isSvelteKit =
        pkg.dependencies?.['@sveltejs/kit'] ||
        pkg.devDependencies?.['@sveltejs/kit'];
      const hasDevScript = pkg.scripts?.dev;

      // Compatibility/Nuclear stability patch injection
      if (isNext || isRemix || isAngular) {
        setHydrationStatus('Applying universal stability patches...');
        console.log('[Discovery] Applying nuclear WebContainer compatibility patches...');

        try {
          await instance.fs.mkdir('webcontainer-stubs', { recursive: true });
          await instance.fs.mkdir('webcontainer-stubs/src', { recursive: true });
          await instance.fs.mkdir('webcontainer-stubs/bin', { recursive: true });
          
          await instance.fs.writeFile('webcontainer-stubs/package.json', PACKAGE_JSON_STUB);
          await instance.fs.writeFile('webcontainer-stubs/index.js', INDEX_JS_STUB);
          await instance.fs.writeFile('webcontainer-stubs/bin/nx.js', NX_JS_STUB);
          await instance.fs.writeFile('webcontainer-stubs/tailwind.js', TAILWIND_JS_STUB);
          await instance.fs.writeFile('webcontainer-stubs/src/devkit-exports.js', DEVKIT_EXPORTS_JS_STUB);
          console.log('[Discovery] Successfully created comprehensive webcontainer-stubs package at root');
        } catch (err) {
          console.warn('[Discovery] Failed to create stub package:', err);
        }

        // Clean up binary folders recursively to prevent VFS SharedArrayBuffer memory limits crashes
        const foldersToClean = [
          '.next', 'client/.next', 'node_modules', '.nx', 'client/.nx', 
          '.turbo', 'dist', '.swc', '.pnpm-store', 'storybook/storybook-static'
        ];
        for (const folder of foldersToClean) {
          try {
            const proc = await instance.spawn('rm', ['-rf', folder]);
            await proc.exit;
          } catch {}
        }

        // Scan and sanitize packages recursively
        const linkStubsAndSanitizeRecursively = async (dir: string) => {
          const files = await instance.fs.readdir(dir, { withFileTypes: true });
          for (const file of files) {
            const path = dir === '.' ? file.name : `${dir}/${file.name}`;
            if (
              file.name.endsWith('.tsbuildinfo') ||
              file.name.endsWith('.map') ||
              file.name.endsWith('.schema.json') ||
              file.name === 'pnpm-lock.yaml' ||
              file.name === 'package-lock.json' ||
              file.name === 'yarn.lock'
            ) {
              try {
                await instance.fs.rm(path, { force: true });
                console.log(`[Sanitizer] Removed VFS buffer overflow risk file: ${path}`);
              } catch {}
              continue;
            }
            if (file.name.endsWith('tsconfig.json') || file.name === 'tsconfig.base.json') {
              try {
                let content = await instance.fs.readFile(path, 'utf-8');
                let changed = false;
                
                try {
                  const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
                  const parsed = JSON.parse(cleanContent);
                  if (parsed.compilerOptions) {
                    if (parsed.compilerOptions.composite !== false) {
                      parsed.compilerOptions.composite = false;
                      changed = true;
                    }
                    if (parsed.compilerOptions.declarationMap !== false) {
                      parsed.compilerOptions.declarationMap = false;
                      changed = true;
                    }
                    if (parsed.compilerOptions.incremental !== false) {
                      parsed.compilerOptions.incremental = false;
                      changed = true;
                    }
                    if (parsed.compilerOptions.tsBuildInfoFile) {
                      delete parsed.compilerOptions.tsBuildInfoFile;
                      changed = true;
                    }
                  }
                  if (changed) {
                    content = JSON.stringify(parsed, null, 2);
                  }
                } catch {
                  if (content.includes('"composite": true') || content.includes('"composite":true')) {
                    content = content.replace(/"composite"\s*:\s*true/g, '"composite": false');
                    changed = true;
                  }
                  if (content.includes('"declarationMap": true') || content.includes('"declarationMap":true')) {
                    content = content.replace(/"declarationMap"\s*:\s*true/g, '"declarationMap": false');
                    changed = true;
                  }
                  if (content.includes('"incremental": true') || content.includes('"incremental":true')) {
                    content = content.replace(/"incremental"\s*:\s*true/g, '"incremental": false');
                    changed = true;
                  }
                }

                if (changed) {
                  await instance.fs.writeFile(path, content);
                  console.log(`[Sanitizer] Disabled composite/incremental/map in: ${path}`);
                }
              } catch (e) {
                console.warn('[Sanitizer] Failed to rewrite tsconfig:', path, e);
              }
            }
            if (file.name === 'package.json') {
              try {
                const content = await instance.fs.readFile(path, 'utf-8');
                const p = JSON.parse(content);
                let changed = false;

                const depth = dir === '.' ? 0 : dir.split('/').length;
                const relativeStubPath = depth === 0 ? 'file:./webcontainer-stubs' : `file:${'../'.repeat(depth)}webcontainer-stubs`;

                const link = (deps?: Record<string, string>) => {
                  if (!deps) return;
                  for (const name of INCOMPATIBLE_PACKAGES) {
                    if (deps[name]) {
                      console.log(`[Linker] Linking ${name} in ${path} to ${relativeStubPath}`);
                      deps[name] = relativeStubPath;
                      changed = true;
                    }
                  }
                };

                link(p.dependencies);
                link(p.devDependencies);
                link(p.peerDependencies);

                if (p.name && (dir === '.' || p.workspaces || p.devDependencies?.nx)) {
                  p.pnpm = p.pnpm || {};
                  p.pnpm.overrides = p.pnpm.overrides || {};
                  p.resolutions = p.resolutions || {};
                  
                  const trpcVersion = '11.1.2';
                  ['@trpc/client', '@trpc/next', '@trpc/react-query', '@trpc/server'].forEach(name => {
                    p.pnpm.overrides[name] = trpcVersion;
                    p.resolutions[name] = trpcVersion;
                  });
                  changed = true;
                }

                if (p.scripts) {
                  ['postinstall', 'prepare', 'preinstall'].forEach(s => {
                    if (p.scripts[s]) {
                      delete p.scripts[s];
                      changed = true;
                    }
                  });
                  if (p.scripts.dev && p.scripts.dev.includes('--turbo')) {
                    p.scripts.dev = p.scripts.dev.replace('--turbo', '');
                    changed = true;
                  }
                }

                if (changed) {
                  await instance.fs.writeFile(path, JSON.stringify(p, null, 2));
                }
              } catch {}
            } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx') || file.name.endsWith('.js') || file.name.endsWith('.jsx')) {
              try {
                let content = await instance.fs.readFile(path, 'utf-8');
                let changed = false;

                if (content.includes('[\\p{Cc}\\p{Cf}]') || content.includes('[\\p{Cc}]')) {
                  console.log(`[Regex Fixer] Sanitizing Unicode property escape regex in ${path}`);
                  content = content.replace(/\/\[\\p\{Cc\}\\p\{Cf\}\]\/gu/g, '/[\\x00-\\x1F\\x7F-\\x9F]/g');
                  content = content.replace(/\/\[\\p\{Cc\}\]\/gu/g, '/[\\x00-\\x1F\\x7F-\\x9F]/g');
                  changed = true;
                }

                if (file.name === 'fonts.ts' || file.name === 'fonts.tsx') {
                  if (content.includes('next/font/google') || content.includes('next/font')) {
                    console.log(`[Font Fixer] Mocking next/font inside ${path}`);
                    content = `
                      const mockFont = (variable) => ({
                        className: 'mock-font-' + variable,
                        variable: variable,
                        style: { fontFamily: 'sans-serif' }
                      });
                      
                      export const open = mockFont('--font-open');
                      export const oswald = mockFont('--font-oswald');
                      export const caveat = mockFont('--font-caveat');
                      export const cookie = mockFont('--font-cookie');
                      export const dancing = mockFont('--font-dancing');
                      export const sedgwick = mockFont('--font-sedgwick');
                      export const mr = mockFont('--font-mr');
                      export const inter = mockFont('--font-inter');
                      export const geist = mockFont('--font-geist');
                      export const geistMono = mockFont('--font-geist-mono');
                    `;
                    changed = true;
                  }
                }

                if (changed) {
                  await instance.fs.writeFile(path, content);
                }
              } catch (e) {
                console.warn('[Code Sanitizer] Failed to rewrite file:', path, e);
              }
            } else if (file.isDirectory()) {
              if (['.next', '.nx', '.cache', 'dist', 'build', 'storybook-static', '.swc', '.pnpm-store'].includes(file.name)) {
                try {
                  await instance.fs.rm(path, { recursive: true, force: true });
                  console.log(`[Sanitizer] Recursively purged large cache folder: ${path}`);
                } catch {}
              } else if (!['node_modules', '.git', 'webcontainer-stubs', 'public', 'generated'].includes(file.name)) {
                await linkStubsAndSanitizeRecursively(path);
              }
            }
          }
        };

        await linkStubsAndSanitizeRecursively('.');

        if (isNext) {
          const babelrc = JSON.stringify({ presets: ['next/babel'] }, null, 2);
          await instance.fs.writeFile(appDir === '.' ? '.babelrc' : `${appDir}/.babelrc`, babelrc);
          
          try { await instance.fs.rm('.swcrc'); } catch {}
          try { await instance.fs.rm(`${appDir}/.swcrc`); } catch {}

          const configFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts'];
          let hasConfig = false;
          for (const cf of configFiles) {
            const target = appDir === '.' ? cf : `${appDir}/${cf}`;
            try {
              await instance.fs.readFile(target);
              hasConfig = true;
            } catch {}
          }

          const safeConfig = `{
            reactStrictMode: true,
            images: { unoptimized: true },
            eslint: { ignoreDuringBuilds: true },
            typescript: { ignoreBuildErrors: true },
            webpack: (config, { dev }) => {
              if (dev) {
                config.watchOptions = {
                  poll: 1000,
                  aggregateTimeout: 300,
                  ignored: ['**/node_modules/**', '**/.next/**']
                };
              }
              return config;
            }
          }`;

          if (!hasConfig) {
            const target = appDir === '.' ? 'next.config.mjs' : `${appDir}/next.config.mjs`;
            await instance.fs.writeFile(target, `export default ${safeConfig};`);
            console.log(`[Sanitizer] Created fallback next.config.mjs at: ${target}`);
          } else {
            for (const cf of configFiles) {
              const target = appDir === '.' ? cf : `${appDir}/${cf}`;
              try {
                await instance.fs.readFile(target);
                await instance.fs.writeFile(
                  target,
                  cf.endsWith('.js')
                    ? `module.exports = ${safeConfig};`
                    : `export default ${safeConfig};`
                );
                console.log(`[Sanitizer] Overwrote next config with safe watchOptions at: ${target}`);
              } catch {}
            }
          }

          const instrs = ['instrumentation.ts', 'instrumentation.js', 'sentry.client.config.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts'];
          for (const f of instrs) {
            try { await instance.fs.rm(f); } catch {}
            try { await instance.fs.rm(`${appDir}/${f}`); } catch {}
            try { await instance.fs.rm(`src/${f}`); } catch {}
            try { await instance.fs.rm(`${appDir}/src/${f}`); } catch {}
          }
        }

        setTerminalOutput((prev) => [...prev, '\n[WebContainer] Nuclear link-mocking applied. System stabilized.']);
      }

      // 2. Install Dependencies
      // 1.8 Create .npmrc for hoisted dependency layout to bypass WASM VFS symlink overflow
      try {
        await instance.fs.writeFile('.npmrc', 'node-linker=hoisted\nsymlink=false\n');
        console.log('[Discovery] Created flat dependency node-linker .npmrc');
      } catch (err) {
        console.warn('[Discovery] Failed to write .npmrc:', err);
      }

      // 2. Install Dependencies
      const pkgManager = isPnpm ? 'pnpm' : 'npm';
      setHydrationStatus(`Installing dependencies (${pkgManager})...`);
      const installArgs = isPnpm
        ? ['install', '--no-frozen-lockfile', '--no-lockfile', '--ignore-scripts']
        : ['install', '--prefer-offline', '--no-audit', '--no-package-lock', '--ignore-scripts'];

      setTerminalOutput((prev) => [
        ...prev,
        `\n$ ${pkgManager} ${installArgs.join(' ')}`,
      ]);
      const installProcess = await instance.spawn(pkgManager, installArgs, {
        env: DEV_SERVER_ENV
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

      // 2.5 Pre-build Local Packages
      try {
        const localPackages: Array<{ name: string; dir: string; buildScript?: string }> = [];
        const nxLibrariesToBuild: Array<{ name: string; dir: string }> = [];

        const scanWorkspacePackages = async (dir: string) => {
          try {
            const files = await instance.fs.readdir(dir, { withFileTypes: true });
            for (const file of files) {
              const path = dir === '.' ? file.name : `${dir}/${file.name}`;
              if (file.name === 'package.json') {
                try {
                  const content = await instance.fs.readFile(path, 'utf-8');
                  const parsed = JSON.parse(content);
                  if (parsed.name && path !== 'package.json') {
                    localPackages.push({
                      name: parsed.name,
                      dir,
                      buildScript: parsed.scripts?.build ? 'build' : parsed.scripts?.compile ? 'compile' : undefined
                    });
                  }
                } catch {}
              } else if (file.name === 'project.json') {
                try {
                  const content = await instance.fs.readFile(path, 'utf-8');
                  const parsed = JSON.parse(content);
                  if (parsed.targets?.build?.executor === '@nx/vite:build') {
                    nxLibrariesToBuild.push({
                      name: parsed.name || dir.split('/').pop() || 'lib',
                      dir
                    });
                  }
                } catch {}
              } else if (file.name === 'vite.config.ts' || file.name === 'vite.config.js') {
                try {
                  let content = await instance.fs.readFile(path, 'utf-8');
                  if (content.includes('@nx/vite')) {
                    console.log(`[Vite Fixer] Sanitizing Nx plugins in ${path}`);
                    content = content.replace(/import\s+\{\s*nxViteTsPaths\s*\}\s+from\s+['"]@nx\/vite\/plugins\/nx-tsconfig-paths\.plugin['"];?/g, 'const nxViteTsPaths = () => ({ name: "nx-tsconfig-paths-mock" });');
                    content = content.replace(/import\s+\{\s*nxCopyAssetsPlugin\s*\}\s+from\s+['"]@nx\/vite\/plugins\/nx-copy-assets\.plugin['"];?/g, 'const nxCopyAssetsPlugin = () => ({ name: "nx-copy-assets-mock" });');
                    await instance.fs.writeFile(path, content);
                  }
                } catch (e) {
                  console.warn('[Vite Fixer] Failed to sanitize vite config:', e);
                }
              } else if (file.isDirectory() && !['node_modules', '.git', '.next', 'dist', 'webcontainer-stubs'].includes(file.name)) {
                try {
                  await scanWorkspacePackages(path);
                } catch (e) {
                  console.warn(`[Workspace Discoverer] Skip directory crawl ${path}:`, e);
                }
              }
            }
          } catch (e) {
            console.warn(`[Workspace Discoverer] Skip readdir ${dir}:`, e);
          }
        };

        await scanWorkspacePackages('.');

        const appPkgPath = appDir === '.' ? 'package.json' : `${appDir}/package.json`;
        let appPkgContent = '';
        try {
          appPkgContent = await instance.fs.readFile(appPkgPath, 'utf-8');
        } catch {
          appPkgContent = await instance.fs.readFile('package.json', 'utf-8');
        }
        const appPkg = JSON.parse(appPkgContent);

        const appDeps = {
          ...(appPkg.dependencies || {}),
          ...(appPkg.devDependencies || {})
        };

        const packagesToBuild = localPackages.filter(pkg => 
          appDeps[pkg.name] !== undefined && pkg.buildScript !== undefined
        );

        if (packagesToBuild.length > 0) {
          for (const pkgToBuild of packagesToBuild) {
            setHydrationStatus(`Building workspace package ${pkgToBuild.name}...`);
            setTerminalOutput((prev) => [
              ...prev, 
              `\n$ cd ${pkgToBuild.dir} && ${pkgManager} run ${pkgToBuild.buildScript}`
            ]);

            const buildProc = await instance.spawn(pkgManager, ['run', pkgToBuild.buildScript!], {
              cwd: pkgToBuild.dir,
              env: DEV_SERVER_ENV
            });

            buildProc.output.pipeTo(
              new WritableStream({
                write(data) {
                  setTerminalOutput((prev) => [...prev, data]);
                },
              })
            );

            await buildProc.exit;
            await syncFilesystem(instance);
          }
        }

        if (nxLibrariesToBuild.length > 0) {
          for (const lib of nxLibrariesToBuild) {
            setHydrationStatus(`Compiling library ${lib.name} via Vite...`);
            setTerminalOutput((prev) => [
              ...prev, 
              `\n$ cd ${lib.dir} && npx vite build`
            ]);

            const buildProc = await instance.spawn('npx', ['vite', 'build'], {
              cwd: lib.dir,
              env: DEV_SERVER_ENV
            });

            buildProc.output.pipeTo(
              new WritableStream({
                write(data) {
                  setTerminalOutput((prev) => [...prev, data]);
                },
              })
            );

            await buildProc.exit;
            await syncFilesystem(instance);
          }
        }

        if (pkg.scripts) {
          const setupScripts = Object.keys(pkg.scripts).filter(name => 
            /^(ui:build|build:libs|build-libs|build:ui|libs:build|bootstrap|setup|predev)$/i.test(name)
          );

          for (const script of setupScripts) {
            const isRedundant = packagesToBuild.some(p => 
              script.includes(p.name.replace('@', '').split('/')[0])
            ) || nxLibrariesToBuild.some(p => 
              script.includes(p.name.replace('@', '').split('/')[0])
            );
            if (isRedundant) continue;

            setHydrationStatus(`Running workspace setup script (${script})...`);
            setTerminalOutput((prev) => [...prev, `\n$ ${pkgManager} run ${script}`]);
            
            const buildProc = await instance.spawn(pkgManager, ['run', script], {
              env: DEV_SERVER_ENV
            });
            buildProc.output.pipeTo(
              new WritableStream({
                write(data) {
                  setTerminalOutput((prev) => [...prev, data]);
                },
              })
            );
            
            await buildProc.exit;
            await syncFilesystem(instance);
          }
        }
      } catch (err: any) {
        console.warn('[Workspace Discoverer] Failed during dynamic pre-build analysis:', err);
      }

      // 3. Start Dev Server
      setHydrationStatus('Starting development server...');
      let cmd = isPnpm ? 'pnpm' : 'npm';
      let args = ['run', 'dev'];

      if (!hasDevScript) {
        if (isNext) {
          cmd = 'npx';
          args = ['next', 'dev', '-p', '3000'];
        } else if (isAngular) {
          cmd = 'npx';
          args = ['ng', 'serve', '--port', '3000', '--host', '0.0.0.0'];
        } else if (isRemix) {
          cmd = 'npx';
          args = ['remix', 'vite:dev', '--port', '3000', '--host', '0.0.0.0'];
        } else if (isNuxt) {
          cmd = 'npx';
          args = ['nuxi', 'dev', '--port', '3000', '--host', '0.0.0.0'];
        } else if (isAstro) {
          cmd = 'npx';
          args = ['astro', 'dev', '--port', '3000', '--host', '0.0.0.0'];
        } else if (isSvelteKit) {
          cmd = 'npx';
          args = ['vite', 'dev', '--port', '3000', '--host'];
        } else if (isVite) {
          cmd = 'npx';
          args = ['vite', '--port', '3000', '--host'];
        }
      } else if (isNext && hasDevScript) {
        // Strip --turbo from existing dev scripts to prevent Turbopack loading SWC
        const devScript = pkg.scripts.dev as string;
        if (devScript && devScript.includes('--turbo')) {
          pkg.scripts.dev = devScript.replace(/\s*--turbo\b/g, '');
          const pkgPath = appDir === '.' ? 'package.json' : `${appDir}/package.json`;
          await instance.fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
        }
      }

      setTerminalOutput((prev) => [...prev, `\n$ ${cmd} ${args.join(' ')}`]);
      const devProcess = await instance.spawn(cmd, args, {
        cwd: appDir,
        env: DEV_SERVER_ENV,
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
    if (!webContainer) return;

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
            await webContainer.fs.mkdir(current, { recursive: true });
          } catch (_) {}
        }
      }
      await webContainer.fs.writeFile(path, content);

      setWrittenFiles((prev) =>
        prev.map((f) => (f.path === path ? { ...f, status: 'done' } : f))
      );

      if (devServerTimeoutRef.current)
        clearTimeout(devServerTimeoutRef.current);
      devServerTimeoutRef.current = setTimeout(() => {
        startDevServer(webContainer);
      }, 2500);
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

  return {
    isSandboxReady,
    webContainer,
    writtenFiles,
    previewUrl,
    isDevServerStarted,
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
  };
}
