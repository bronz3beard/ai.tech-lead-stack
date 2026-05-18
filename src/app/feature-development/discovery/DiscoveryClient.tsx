'use client';

import { DiscoverySetupModal } from '@/components/feature-development/DiscoverySetupModal';
import { FeatureDevelopmentModal } from '@/components/feature-development/FeatureDevelopmentModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useChat } from '@ai-sdk/react';
import { WebContainer } from '@webcontainer/api';
import { DefaultChatTransport } from 'ai';
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCode,
  Folder,
  HelpCircle,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  Send,
  Terminal as TerminalIcon,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

interface WriteToSandboxArgs {
  path: string;
  content: string;
}

export interface Project {
  id: string;
  name: string;
  githubFullName?: string | null;
}

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

/**
 * Recursively flattens a WebContainer FileSystemTree into a flat list of file paths.
 */
function flattenTree(
  tree: any,
  parentPath = ''
): { path: string; status: 'writing' | 'done' | 'error' }[] {
  let files: any[] = [];
  for (const name in tree) {
    const item = tree[name];
    const currentPath = parentPath ? `${parentPath}/${name}` : name;
    if (item.directory) {
      files = [...files, ...flattenTree(item.directory, currentPath)];
    } else {
      files.push({ path: currentPath, status: 'done' });
    }
  }
  return files;
}

interface FileNode {
  name: string;
  path: string;
  children?: FileNode[];
  isDirectory: boolean;
  status?: 'writing' | 'done' | 'error';
}

function buildTree(files: { path: string; status: any }[]): FileNode[] {
  const root: FileNode[] = [];

  files.forEach((file) => {
    const parts = file.path.split('/');
    let currentLevel = root;

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      let existingNode = currentLevel.find((node) => node.name === part);

      if (!existingNode) {
        existingNode = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
          isDirectory: !isLast,
          children: isLast ? undefined : [],
          status: isLast ? file.status : undefined,
        };
        currentLevel.push(existingNode);
        currentLevel.sort((a, b) => {
          if (a.isDirectory === b.isDirectory)
            return a.name.localeCompare(b.name);
          return a.isDirectory ? -1 : 1;
        });
      }
      if (!isLast) {
        currentLevel = existingNode.children!;
      }
    });
  });

  return root;
}

export default function DiscoveryClient({
  projects,
  defaultCreatorModel,
}: {
  projects: Project[];
  defaultCreatorModel: string;
}) {
  const router = useRouter();
  const [isSandboxReady, setIsSandboxReady] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [webContainer, setWebContainer] = useState<WebContainer | null>(null);
  const [writtenFiles, setWrittenFiles] = useState<
    { path: string; status: 'writing' | 'done' | 'error' }[]
  >([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDevServerStarted, setIsDevServerStarted] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const devServerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isTerminalAtBottom, setIsTerminalAtBottom] = useState(true);

  // Discovery Context State
  const [componentName, setComponentName] = useState<string | undefined>();
  const [figmaUrl, setFigmaUrl] = useState<string | undefined>();
  const [branchUrl, setBranchUrl] = useState<string | undefined>();

  // Modal State
  const [isSetupOpen, setIsSetupOpen] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [hydrationStatus, setHydrationStatus] = useState('');

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [showTerminal, setShowTerminal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['src', 'app', 'components', 'libs'])
  );

  const fileTree = useMemo(() => buildTree(writtenFiles), [writtenFiles]);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const syncFilesystem = async (instance: WebContainer) => {
    const scan = async (
      dir: string
    ): Promise<{ path: string; status: 'done' }[]> => {
      let results: any[] = [];
      try {
        const files = await instance.fs.readdir(dir, { withFileTypes: true });
        for (const file of files) {
          const path = dir === '.' ? file.name : `${dir}/${file.name}`;

          // STRICT EXCLUSIONS: Do not crawl these or their subdirectories
          if (
            file.name === 'node_modules' ||
            file.name === '.git' ||
            file.name === '.next' ||
            file.name === '.pnpm' ||
            file.name === '.turbo'
          ) {
            continue;
          }

          if (file.isDirectory()) {
            const sub = await scan(path);
            results = [...results, ...sub];
          } else {
            results.push({ path, status: 'done' });
          }
        }
      } catch (e) {
        // Fallback for older WebContainer API or permission issues
        try {
          const files = await instance.fs.readdir(dir);
          for (const file of files) {
            if (
              file === 'node_modules' ||
              file === '.git' ||
              file === '.next' ||
              file === '.pnpm'
            )
              continue;
            const path = dir === '.' ? file : `${dir}/${file}`;
            results.push({ path, status: 'done' });
          }
        } catch {}
      }
      return results;
    };

    const allFiles = await scan('.');
    setWrittenFiles(allFiles);
  };

  const renderTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node) => (
      <div key={node.path}>
        {node.isDirectory ? (
          <div>
            <button
              onClick={() => toggleFolder(node.path)}
              className="w-full flex items-center gap-2 p-1.5 rounded-lg text-left text-[11px] text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-all group"
              style={{ paddingLeft: `${level * 12 + 8}px` }}
            >
              {expandedFolders.has(node.path) ? (
                <ChevronDown className="w-3 h-3 text-slate-500" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-500" />
              )}
              <Folder className="w-3.5 h-3.5 text-blue-500/60" />
              <span className="truncate">{node.name}</span>
            </button>
            {expandedFolders.has(node.path) && node.children && (
              <div className="animate-in slide-in-from-left-1 duration-200">
                {renderTree(node.children, level + 1)}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              setSelectedFile(node.path);
              setViewMode('code');
            }}
            className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left text-[11px] transition-all group border ${
              selectedFile === node.path
                ? 'bg-blue-600/10 text-blue-400 border-blue-500/30'
                : 'text-slate-400 border-transparent hover:bg-slate-800/50 hover:text-slate-200'
            }`}
            style={{ paddingLeft: `${level * 12 + 24}px` }}
          >
            <div className="flex items-center gap-2 truncate">
              {node.status === 'writing' ? (
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
              ) : (
                <FileCode
                  className={`w-3.5 h-3.5 ${
                    selectedFile === node.path
                      ? 'text-blue-400'
                      : 'text-slate-500 group-hover:text-slate-400'
                  }`}
                />
              )}
              <span className="truncate">{node.name}</span>
            </div>
          </button>
        )}
      </div>
    ));
  };

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

  // WebContainer Initialization
  useEffect(() => {
    async function boot() {
      try {
        console.log('Booting WebContainer...');
        const instance = await getWebContainerInstance();
        if (instance) {
          setWebContainer(instance);
          setIsSandboxReady(true);
          console.log('WebContainer ready.');

          // Check Node version for verification
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

  const [input, setInput] = useState('');

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/orchestrator/discovery',
        body: {
          projectId: selectedProjectId,
          figmaUrl,
          branchUrl,
          componentName,
        },
      }),
    [selectedProjectId, figmaUrl, branchUrl, componentName]
  );

  // Helper to start dev server
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
              // Only check directories
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
      // 1. Read package.json to detect framework and package manager
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

        // Sanitize: Remove local file: dependencies that break in WebContainer
        let hasChanges = false;
        const sanitizeDeps = (deps?: Record<string, string>) => {
          if (!deps) return;
          for (const key in deps) {
            // Strip any file: or .git dependencies as they usually point to absolute local paths
            // or require git which is not available in WebContainer.
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

        // Sanitize: Remove engines.pnpm to avoid version mismatch errors in WebContainer
        if (pkg.engines?.pnpm) {
          console.log(
            `[Sanitizer] Removing engines.pnpm requirement: ${pkg.engines.pnpm}`
          );
          delete pkg.engines.pnpm;
          // If engines is now empty, remove it too
          if (Object.keys(pkg.engines).length === 0) {
            delete pkg.engines;
          }
          hasChanges = true;
        }

        if (hasChanges) {
          setHydrationStatus('Sanitizing incompatible dependencies...');
          console.log(
            '[Sanitizer] Updating package.json to remove incompatible requirements...'
          );
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
      const hasStartScript = pkg.scripts?.start;
      const hasServeScript = pkg.scripts?.serve;

      // ─── WebContainer Compatibility Patches ───────────────────────────
      // WebContainers run a WASM-based Node.js in the browser. Native binary
      // packages (SWC, Sentry native, Nx native, etc.) CANNOT run here.
      // This causes: RangeError: Offset is outside the bounds of the DataView
      //
      // Strategy:
      // 1. Delete .swcrc (forces SWC config that overrides .babelrc)
      // 2. Inject .babelrc with next/babel preset (forces pure-JS compilation)
      // 3. Replace next.config with a minimal WebContainer-safe version
      // 4. Remove instrumentation files (Sentry SDK has native deps)
      // 5. Strip all native/incompatible dependencies from package.json
      // ─── Universal WebContainer Stability Patch ───────────────────────
      // WebContainers run a WASM-based Node.js in the browser. Native binary
      // packages (SWC, Sentry native, Nx native, etc.) CANNOT run here.
      // This causes: RangeError: Offset is outside the bounds of the DataView
      //
      // Strategy:
      // 1. Recursive Sanitizer: Find every package.json and strip native deps.
      // 2. Nuclear Cleanup: rm -rf all .next, node_modules, .nx, .turbo.
      // 3. Forced Fallbacks: .babelrc, safe next.config, NODE_OPTIONS.
      if (isNext || isRemix || isAngular) {
        setHydrationStatus('Applying universal stability patches...');
        console.log('[Discovery] Applying nuclear WebContainer compatibility patches...');

        // 1. Create Physical Stub Package (Universal Link Strategy)
        // This is the most robust way to mock—it works at the filesystem level.
        try {
          await instance.fs.mkdir('webcontainer-stubs', { recursive: true });
          await instance.fs.mkdir('webcontainer-stubs/src', { recursive: true });
          await instance.fs.mkdir('webcontainer-stubs/bin', { recursive: true });
          
          await instance.fs.writeFile('webcontainer-stubs/package.json', JSON.stringify({
            name: 'webcontainer-stubs',
            version: '1.0.0',
            main: 'index.js',
            bin: {
              "nx": "./bin/nx.js"
            }
          }, null, 2));

          await instance.fs.writeFile('webcontainer-stubs/index.js', `
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
          `);

          await instance.fs.writeFile('webcontainer-stubs/bin/nx.js', `#!/usr/bin/env node
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
                  } else if (file.isDirectory() && !['node_modules', '.git', '.next', 'dist', 'webcontainer-stubs'].includes(file.name)) {
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
          `);

          await instance.fs.writeFile('webcontainer-stubs/tailwind.js', `
            module.exports = {
              createGlobPatternsForDependencies: () => []
            };
          `);

          await instance.fs.writeFile('webcontainer-stubs/src/devkit-exports.js', `
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
          `);
          console.log('[Discovery] Successfully created comprehensive webcontainer-stubs package at root');
        } catch (err) {
          console.warn('[Discovery] Failed to create stub package:', err);
        }

        // 2. Nuclear Cleanup: Remove all potential binary pollution
        const foldersToClean = ['.next', 'node_modules', '.nx', '.turbo', 'dist', '.swc', '.pnpm-store'];
        for (const folder of foldersToClean) {
          try {
             // We use spawn rm -rf for speed and reliability in WebContainer
             const rm = await instance.spawn('rm', ['-rf', folder]);
             await rm.exit;
          } catch {}
        }

        // 3. Recursive Package Sanitizer
        const incompatiblePackages = [
          '@swc/core', '@swc-node/core', '@swc-node/register', '@swc/cli', '@swc/helpers',
          '@next/swc-linux-x64-gnu', '@next/swc-linux-x64-musl', '@next/swc-win32-x64-msvc', 
          '@next/swc-darwin-x64', '@next/swc-darwin-arm64',
          '@sentry/nextjs', '@sentry/node', '@sentry/browser', '@sentry/react', '@sentry/profiling-node',
          '@nx/next', '@nx/react', '@nx/js', '@nx/node', '@nx/web', '@nx/vite', 'nx',
          '@serwist/next', 'serwist', 'next-video', 'prisma', '@prisma/client', 'sharp'
        ];

        const linkStubsAndSanitizeRecursively = async (dir: string) => {
          const files = await instance.fs.readdir(dir, { withFileTypes: true });
          for (const file of files) {
            const path = dir === '.' ? file.name : `${dir}/${file.name}`;
            if (file.name === 'package.json') {
              try {
                const content = await instance.fs.readFile(path, 'utf-8');
                const p = JSON.parse(content);
                let changed = false;

                // Calculate relative path back to root stub folder
                const depth = dir === '.' ? 0 : dir.split('/').length;
                const relativeStubPath = depth === 0 ? 'file:./webcontainer-stubs' : `file:${'../'.repeat(depth)}webcontainer-stubs`;

                const link = (deps?: Record<string, string>) => {
                  if (!deps) return;
                  for (const name of incompatiblePackages) {
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

                // Inject tRPC strict version overrides in root package.json to prevent pnpm resolution mismatches
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

                // 1. Sanitize modern ES2018 Unicode property escape regex that crashes Babel's parser/transpiler (charCodeAt error)
                if (content.includes('[\\p{Cc}\\p{Cf}]') || content.includes('[\\p{Cc}]')) {
                  console.log(`[Regex Fixer] Sanitizing Unicode property escape regex in ${path}`);
                  content = content.replace(/\/\[\\p\{Cc\}\\p\{Cf\}\]\/gu/g, '/[\\x00-\\x1F\\x7F-\\x9F]/g');
                  content = content.replace(/\/\[\\p\{Cc\}\]\/gu/g, '/[\\x00-\\x1F\\x7F-\\x9F]/g');
                  changed = true;
                }

                // 2. Intercept and mock next/font google loader imports
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
            } else if (file.isDirectory() && !['node_modules', '.git', '.next', 'dist', 'webcontainer-stubs'].includes(file.name)) {
              await linkStubsAndSanitizeRecursively(path);
            }
          }
        };

        await linkStubsAndSanitizeRecursively('.');

        // 5. Specific Next.js Fixes
        if (isNext) {
          // Force Babel
          const babelrc = JSON.stringify({ presets: ['next/babel'] }, null, 2);
          await instance.fs.writeFile(appDir === '.' ? '.babelrc' : `${appDir}/.babelrc`, babelrc);
          
          // Delete .swcrc everywhere
          try { await instance.fs.rm('.swcrc'); } catch {}
          try { await instance.fs.rm(`${appDir}/.swcrc`); } catch {}

          // Safe next.config
          const configFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts'];
          for (const cf of configFiles) {
            const target = appDir === '.' ? cf : `${appDir}/${cf}`;
            try {
              await instance.fs.readFile(target);
              const safe = `{ reactStrictMode: true, images: { unoptimized: true }, eslint: { ignoreDuringBuilds: true }, typescript: { ignoreBuildErrors: true } }`;
              await instance.fs.writeFile(target, target.endsWith('.js') ? `module.exports = ${safe};` : `export default ${safe};`);
            } catch {}
          }

          // Kill instrumentation
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
      const pkgManager = isPnpm ? 'pnpm' : 'npm';
      setHydrationStatus(`Installing dependencies (${pkgManager})...`);
      const installArgs = isPnpm
        ? ['install', '--no-frozen-lockfile']
        : ['install', '--prefer-offline', '--no-audit'];

      setTerminalOutput((prev) => [
        ...prev,
        `\n$ ${pkgManager} ${installArgs.join(' ')}`,
      ]);
      const installProcess = await instance.spawn(pkgManager, installArgs);

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

      // 2.5 Dynamic Workspace Library Pre-Builder & Bootstrap System
      // Agnostically discovers workspace packages, checks the app's dependencies,
      // and builds any local packages before the main server runs.
      try {
        const localPackages: Array<{ name: string; dir: string; buildScript?: string }> = [];
        const nxLibrariesToBuild: Array<{ name: string; dir: string }> = [];

        // Recursive scanner to map out all workspace packages, config files, and Nx projects
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
        console.log('[Workspace Discoverer] Discovered local packages:', localPackages);
        console.log('[Workspace Discoverer] Discovered Nx libraries:', nxLibrariesToBuild);

        // Find dependencies of the main application
        const appPkgPath = appDir === '.' ? 'package.json' : `${appDir}/package.json`;
        let appPkgContent = '';
        try {
          appPkgContent = await instance.fs.readFile(appPkgPath, 'utf-8');
        } catch {
          console.log(`[Workspace Discoverer] Client package.json not found at ${appPkgPath}, falling back to root package.json`);
          appPkgContent = await instance.fs.readFile('package.json', 'utf-8');
        }
        const appPkg = JSON.parse(appPkgContent);

        const appDeps = {
          ...(appPkg.dependencies || {}),
          ...(appPkg.devDependencies || {})
        };

        // 1. Dependency-driven Package Builds
        const packagesToBuild = localPackages.filter(pkg => 
          appDeps[pkg.name] !== undefined && pkg.buildScript !== undefined
        );

        if (packagesToBuild.length > 0) {
          console.log('[Workspace Discoverer] Packages to pre-build:', packagesToBuild);
          for (const pkgToBuild of packagesToBuild) {
            setHydrationStatus(`Building workspace package ${pkgToBuild.name}...`);
            setTerminalOutput((prev) => [
              ...prev, 
              `\n$ cd ${pkgToBuild.dir} && ${pkgManager} run ${pkgToBuild.buildScript}`
            ]);

            const buildProc = await instance.spawn(pkgManager, ['run', pkgToBuild.buildScript!], {
              cwd: pkgToBuild.dir
            });

            buildProc.output.pipeTo(
              new WritableStream({
                write(data) {
                  setTerminalOutput((prev) => [...prev, data]);
                },
              })
            );

            const buildExitCode = await buildProc.exit;
            console.log(`[Workspace Discoverer] Package ${pkgToBuild.name} build finished with code ${buildExitCode}`);
            await syncFilesystem(instance);
          }
        }

        // 2. Build Nx Vite Libraries directly (to generate dist folders required by TS paths)
        if (nxLibrariesToBuild.length > 0) {
          console.log('[Workspace Discoverer] Nx libraries to pre-compile via Vite:', nxLibrariesToBuild);
          for (const lib of nxLibrariesToBuild) {
            setHydrationStatus(`Compiling library ${lib.name} via Vite...`);
            setTerminalOutput((prev) => [
              ...prev, 
              `\n$ cd ${lib.dir} && npx vite build`
            ]);

            const buildProc = await instance.spawn('npx', ['vite', 'build'], {
              cwd: lib.dir
            });

            buildProc.output.pipeTo(
              new WritableStream({
                write(data) {
                  setTerminalOutput((prev) => [...prev, data]);
                },
              })
            );

            const buildExitCode = await buildProc.exit;
            console.log(`[Workspace Discoverer] Library ${lib.name} compile finished with code ${buildExitCode}`);
            await syncFilesystem(instance);
          }
        }

        // 3. Fallback Root Setup & Bootstrap scripts
        if (pkg.scripts) {
          const setupScripts = Object.keys(pkg.scripts).filter(name => 
            /^(ui:build|build:libs|build-libs|build:ui|libs:build|bootstrap|setup|predev)$/i.test(name)
          );

          for (const script of setupScripts) {
            // Check if this package wasn't already built in the dependency or Nx Vite passes
            const isRedundant = packagesToBuild.some(p => 
              script.includes(p.name.replace('@', '').split('/')[0])
            ) || nxLibrariesToBuild.some(p => 
              script.includes(p.name.replace('@', '').split('/')[0])
            );
            if (isRedundant) continue;

            setHydrationStatus(`Running workspace setup script (${script})...`);
            setTerminalOutput((prev) => [...prev, `\n$ ${pkgManager} run ${script}`]);
            
            const buildProc = await instance.spawn(pkgManager, ['run', script]);
            buildProc.output.pipeTo(
              new WritableStream({
                write(data) {
                  setTerminalOutput((prev) => [...prev, data]);
                },
              })
            );
            
            const buildExitCode = await buildProc.exit;
            console.log(`[Discovery] Workspace setup script ${script} finished with code ${buildExitCode}`);
            await syncFilesystem(instance);
          }
        }
      } catch (err: any) {
        console.warn('[Workspace Discoverer] Failed during dynamic pre-build analysis:', err);
        setTerminalOutput((prev) => [
          ...prev,
          `\n[Workspace Discoverer Error] Failed during dynamic pre-build analysis: ${err.message || err}`
        ]);
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
          // SvelteKit uses Vite under the hood
          cmd = 'npx';
          args = ['vite', 'dev', '--port', '3000', '--host'];
        } else if (isVite) {
          cmd = 'npx';
          args = ['vite', '--port', '3000', '--host'];
        }
      } else if (isNext && hasDevScript) {
        // Strip --turbo from existing dev scripts to prevent Turbopack loading SWC
        const devScript = pkg.scripts.dev as string;
        if (devScript.includes('--turbo')) {
          pkg.scripts.dev = devScript.replace(/\s*--turbo\b/g, '');
          const pkgPath =
            appDir === '.' ? 'package.json' : `${appDir}/package.json`;
          await instance.fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
          console.log(
            `[Discovery] Stripped --turbo from dev script: ${pkg.scripts.dev}`
          );
        }
      }

      setTerminalOutput((prev) => [...prev, `\n$ ${cmd} ${args.join(' ')}`]);
      const devProcess = await instance.spawn(cmd, args, {
        cwd: appDir,
        env: {
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
        },
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
        // Increase timeout for cold starts (Babel is slower than SWC)
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
      // Ensure directory exists
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

      // Reset dev server timeout
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

  // Streaming AI Chat
  const { messages, status, sendMessage, addToolOutput } = useChat({
    transport,
    async onToolCall({ toolCall }) {
      if (toolCall.toolName === 'write_to_sandbox') {
        const args =
          (toolCall as any).args ||
          (toolCall as any).input ||
          (toolCall as any).parameters ||
          {};
        const { path, content } = args as WriteToSandboxArgs;

        if (!path || !content) {
          console.warn(
            '[onToolCall] Received incomplete arguments for write_to_sandbox',
            toolCall
          );
          return;
        }

        console.log(`[onToolCall] Writing to sandbox: ${path}`);

        // Mark as processed immediately to prevent duplicate triggers from useEffect
        processedToolCalls.current.add(toolCall.toolCallId);

        try {
          await handleWriteFile(path, content);

          // Refresh content if it's the currently viewed file
          if (selectedFile === path) {
            setFileContent(content);
          }

          addToolOutput({
            toolCallId: toolCall.toolCallId,
            tool: toolCall.toolName,
            output: { success: true, path },
          });
        } catch (error: any) {
          console.error(
            `[onToolCall] Failed to write to sandbox: ${path}`,
            error
          );
          addToolOutput({
            toolCallId: toolCall.toolCallId,
            tool: toolCall.toolName,
            state: 'output-error',
            errorText: error instanceof Error ? error.message : String(error),
          });
        }
      }
    },
    onError: (err) => {
      console.error('Chat error:', err);
      setSandboxError(`Stream error: ${err.message}`);
      toast.error(`Discovery Error: ${err.message}`);
    },
    onFinish: (message) => {
      console.log('Chat finished:', message);
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    },
  });

  const processedToolCalls = useRef<Set<string>>(new Set());

  // Keep visual sync for streaming tool calls (optional but good for UX)
  useEffect(() => {
    messages.forEach((message: any) => {
      if (message.toolInvocations) {
        message.toolInvocations.forEach((invocation: any) => {
          const { toolCallId, toolName } = invocation;
          const args =
            invocation.args || invocation.input || invocation.parameters || {};

          if (
            toolName === 'write_to_sandbox' &&
            args?.path &&
            !processedToolCalls.current.has(toolCallId)
          ) {
            // Check if it's the first time we see this path in this call
            setWrittenFiles((prev) => {
              const exists = prev.find((f) => f.path === args.path);
              if (exists) return prev;
              return [...prev, { path: args.path, status: 'writing' }];
            });
          }
        });
      }
    });
  }, [messages]);

  const isLoading = status === 'streaming';

  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    sendMessage(
      { parts: [{ type: 'text', text: input }] },
      { body: { projectId: selectedProjectId } }
    );
    setInput('');
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Terminal Autoscroll Logic
  const handleTerminalScroll = () => {
    if (!terminalScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = terminalScrollRef.current;
    // Buffer of 10px to account for rounding/precision
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    setIsTerminalAtBottom(isAtBottom);
  };

  useEffect(() => {
    if (showTerminal && isTerminalAtBottom && terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalOutput, isTerminalAtBottom, showTerminal]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStarted, setGenerationStarted] = useState(false);

  const handleStartGeneration = async () => {
    if (!selectedProjectId || messages.length === 0) return;

    setIsGenerating(true);
    try {
      const lastMessage = messages[messages.length - 1];
      const lastPrompt =
        lastMessage.parts
          ?.filter((p: any) => p.type === 'text')
          .map((p: any) => (p as any).text)
          .join('\n') ||
        (lastMessage as any).content ||
        '';
      const branchName = `discovery/feature-requirements-${Date.now()}`;

      const response = await fetch('/api/orchestrator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchName,
          prompt: lastPrompt,
          projectId: selectedProjectId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to trigger cloud runner');
      }

      setGenerationStarted(true);
      (window as any)._currentBranch = branchName;
      alert('Cloud Runner triggered! Branch: ' + branchName);
    } catch (err: any) {
      console.error('Error starting generation:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinishDiscovery = async () => {
    const branchName =
      (window as any)._currentBranch ||
      `discovery/feature-requirements-${Date.now()}`;
    try {
      const response = await fetch('/api/orchestrator/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchName,
          creatorModelUsed: defaultCreatorModel,
          projectId: selectedProjectId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to trigger audit');
      }

      router.push('/feature-development/in-progress');
    } catch (err: any) {
      console.error('Error finishing discovery:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const hasStarted = messages.length > 0;

  return (
    <div className="flex h-dvh w-full flex-col bg-slate-950 text-slate-50 dark overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-6 bg-slate-900/50 backdrop-blur-xl">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="h-4 w-px bg-slate-800 mx-2" />
          <h1 className="text-sm font-semibold text-white tracking-tight uppercase">
            Feature Discovery
          </h1>
          {componentName && (
            <>
              <div className="h-4 w-px bg-slate-800 mx-2" />
              <span className="text-xs font-medium text-slate-400">
                {componentName}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsGuideOpen(true)}
            className="text-slate-400 hover:text-white"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Guide
          </Button>
          <div className="h-4 w-px bg-slate-800 mx-2" />
          {!generationStarted ? (
            <Button
              onClick={handleStartGeneration}
              disabled={!hasStarted || !selectedProjectId || isGenerating}
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {isGenerating ? 'Triggering Runner...' : 'Start Generation'}
            </Button>
          ) : (
            <Button
              onClick={handleFinishDiscovery}
              variant="default"
              className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all active:scale-95"
            >
              Trigger Audit Phase
            </Button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar: Discovery Chat (Floating in Fullscreen) */}
        <section
          className={`bg-slate-900/50 backdrop-blur-xl border-r border-slate-800 transition-all duration-500 ease-in-out flex flex-col z-40 ${
            isFullscreen
              ? isChatMinimized
                ? 'w-0 opacity-0 pointer-events-none'
                : 'fixed top-12 right-6 bottom-12 w-[400px] rounded-3xl shadow-2xl border-slate-700/50 bg-slate-900/90'
              : 'w-[400px]'
          }`}
        >
          {isFullscreen && !isChatMinimized && (
            <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Discovery Agent
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-white"
                onClick={() => setIsChatMinimized(true)}
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
            </div>
          )}
          {/* Project Selector */}
          <div className="p-5 border-b border-slate-800/50">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3 block">
              Deployment Target
            </label>
            <div className="relative group">
              <Folder className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 group-focus-within:text-blue-400 transition-colors pointer-events-none" />
              <select
                id="project-select"
                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg py-2.5 pl-10 pr-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all appearance-none disabled:opacity-50"
                value={selectedProjectId}
                onChange={async (e) => {
                  const newProjectId = e.target.value;
                  setSelectedProjectId(newProjectId);

                  // Hydrate automatically when a project is selected
                  if (newProjectId && !isSetupOpen) {
                    setIsHydrating(true);
                    setHydrationStatus('Fetching project bundle...');
                    try {
                      const res = await fetch(
                        `/api/orchestrator/discovery/project-bundle?projectId=${newProjectId}`
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

                        // Sync the file list UI with the hydrated bundle
                        const hydratedFiles = flattenTree(bundle);
                        setWrittenFiles(hydratedFiles);

                        setHydrationStatus('Preparing runtime environment...');
                        await startDevServer(instance);
                      }
                    } catch (err: any) {
                      console.error('Hydration failed:', err);
                      toast.error(
                        'Hydration failed, falling back to Template Mode.'
                      );
                    } finally {
                      setIsHydrating(false);
                      setHydrationStatus('');
                    }
                  }
                }}
                disabled={hasStarted || isHydrating}
              >
                <option value="" disabled>
                  Select a repository…
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-hide">
            {!selectedProjectId ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center">
                  <Folder className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Select a project repository above to begin the requirements
                  discovery process.
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <Send className="w-6 h-6 text-blue-500" />
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Describe the feature you want to build. Our Discovery Agent
                  will help you refine the technical specifications.
                </p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
                    {msg.role === 'user' ? 'User' : 'Discovery Agent'}
                  </span>
                  <div
                    className={`max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed chat-prose ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-slate-800 text-slate-200 border border-slate-700/50 rounded-tl-none'
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.parts
                        ?.filter((p: any) => p.type === 'text')
                        .map((p: any) => (p as any).text)
                        .join('\n') || (msg as any).content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex flex-col space-y-2 items-start animate-pulse">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
                  Discovery Agent
                </span>
                <div className="bg-slate-800 h-10 w-24 rounded-2xl rounded-tl-none border border-slate-700/50" />
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="p-5 border-t border-slate-800/50 bg-slate-900/50">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(e);
              }}
              className="flex space-x-2"
            >
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder={
                  selectedProjectId
                    ? isHydrating
                      ? 'Hydrating sandbox...'
                      : 'Type a message...'
                    : 'Select target first'
                }
                disabled={!selectedProjectId || isLoading || isHydrating}
                className="bg-slate-950/50 border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-600 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
              />
              <Button
                type="submit"
                size="icon"
                disabled={
                  !selectedProjectId ||
                  !input.trim() ||
                  isLoading ||
                  isHydrating
                }
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl shrink-0 transition-all active:scale-90"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </section>{' '}
        {/* WebContainer Sandbox Preview */}
        <section className="flex-1 bg-slate-950 p-6 relative flex flex-col gap-4 overflow-hidden">
          {/* Controls Bar */}
          <div className="flex items-center justify-between shrink-0 px-1">
            <div className="flex items-center gap-2 p-1 bg-slate-900/80 rounded-xl border border-slate-800 shadow-lg">
              <Button
                variant={viewMode === 'preview' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('preview')}
                className={
                  viewMode === 'preview'
                    ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20'
                    : 'text-slate-400 hover:text-white'
                }
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button
                variant={viewMode === 'code' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('code')}
                className={
                  viewMode === 'code'
                    ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20'
                    : 'text-slate-400 hover:text-white'
                }
              >
                <FileCode className="w-4 h-4 mr-2" />
                Code Review
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTerminal(!showTerminal)}
                className={`text-[10px] font-bold uppercase tracking-widest transition-all ${
                  showTerminal
                    ? 'text-blue-400 bg-blue-500/10'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <TerminalIcon className="w-3.5 h-3.5 mr-2" />
                Terminal {showTerminal ? 'On' : 'Off'}
              </Button>
              <div className="h-4 w-px bg-slate-800 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="text-slate-500 hover:text-white transition-all"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
              <div className="h-4 w-px bg-slate-800 mx-1" />
              {isSandboxReady && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                    Node v22 Active
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex gap-4 overflow-hidden relative">
            {/* Sidebar: File Tree */}
            <Card
              className={`shrink-0 flex flex-col overflow-hidden border-slate-800 bg-slate-900/40 backdrop-blur-md shadow-xl transition-all duration-300 ${
                showSidebar
                  ? 'w-64 opacity-100'
                  : 'w-0 opacity-0 -ml-4 pointer-events-none'
              }`}
            >
              <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
                <div className="flex items-center gap-2">
                  <Folder className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Filesystem
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-slate-600">
                    {writtenFiles.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-slate-600 hover:text-slate-400"
                    onClick={() => setShowSidebar(false)}
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                {writtenFiles.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-4 text-center opacity-40">
                    <Loader2 className="w-5 h-5 mb-2 animate-spin" />
                    <span className="text-[9px] uppercase tracking-tighter">
                      Waiting for sync...
                    </span>
                  </div>
                ) : (
                  <div className="space-y-0.5">{renderTree(fileTree)}</div>
                )}
              </div>
            </Card>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
              {!showSidebar && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 -left-2 z-50 h-10 w-4 bg-slate-900 border border-slate-800 rounded-r-lg hover:bg-slate-800 transition-all shadow-xl"
                  onClick={() => setShowSidebar(true)}
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              )}
              <Card className="flex-1 flex flex-col overflow-hidden shadow-2xl border-slate-800 bg-slate-900/80 backdrop-blur-sm group relative">
                <div className="flex-1 flex flex-col bg-slate-950/50 relative overflow-hidden">
                  {/* Error Banner */}
                  {sandboxError && (
                    <div className="absolute top-0 inset-x-0 z-50 bg-red-500/10 border-b border-red-500/50 backdrop-blur-md p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-red-500">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-medium">
                          {sandboxError}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-500 hover:bg-red-500/20"
                        onClick={() => setSandboxError(null)}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {isHydrating ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6 z-10">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-emerald-500 animate-spin" />
                        <div className="absolute inset-2 rounded-full border-t-2 border-l-2 border-slate-800 animate-spin-reverse" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-medium text-slate-200">
                          Hydrating Project Context
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                          {hydrationStatus}
                        </p>
                      </div>
                    </div>
                  ) : !isSandboxReady ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6 z-10">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-blue-500 animate-spin" />
                        <div className="absolute inset-2 rounded-full border-t-2 border-l-2 border-slate-800 animate-spin-reverse" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-medium text-slate-200">
                          Booting Sandbox
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                          Initializing WebContainer API...
                        </p>
                      </div>
                    </div>
                  ) : viewMode === 'preview' ? (
                    previewUrl ? (
                      <div className="w-full h-full bg-white">
                        <iframe
                          src={previewUrl}
                          className="w-full h-full border-none"
                          title="Live Prototyping Preview"
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center z-10">
                        <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mb-6 shadow-2xl shadow-blue-500/5">
                          {writtenFiles.length > 0 ? (
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                          ) : (
                            <Eye className="w-10 h-10 text-blue-500" />
                          )}
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">
                          {writtenFiles.length > 0
                            ? 'Building Preview...'
                            : 'Awaiting Prototype'}
                        </h3>
                        <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                          {writtenFiles.length > 0
                            ? 'The dev server is starting. Review the file tree or code while it initializes.'
                            : 'Select a project to get started, and then you will be able to start a conversation to generate visual requirements and interactive prototypes.'}
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="w-full h-full overflow-auto custom-scrollbar bg-[#1e1e1e]">
                      {selectedFile ? (
                        <SyntaxHighlighter
                          language={
                            selectedFile.split('.').pop() === 'tsx'
                              ? 'typescript'
                              : selectedFile.split('.').pop() || 'typescript'
                          }
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            padding: '1.5rem',
                            background: 'transparent',
                            fontSize: '13px',
                            lineHeight: '1.6',
                          }}
                          showLineNumbers
                        >
                          {fileContent || '// Loading file content...'}
                        </SyntaxHighlighter>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 p-12 text-center">
                          <FileCode className="w-16 h-16 mb-4 opacity-10" />
                          <h4 className="text-sm font-medium text-slate-400">
                            Select a file to review
                          </h4>
                          <p className="text-xs max-w-[200px] mt-2 leading-relaxed">
                            Click any file in the sidebar to review the code
                            generated by the Discovery Agent.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Collapsible Terminal */}
                {showTerminal && (
                  <div className="h-64 shrink-0 bg-slate-950 border-t border-slate-800 font-mono text-[10px] flex flex-col overflow-hidden z-20">
                    <div className="flex items-center justify-between text-slate-500 p-2 bg-slate-900/50 border-b border-slate-800/50 shrink-0">
                      <div className="flex items-center space-x-2">
                        <TerminalIcon className="w-3 h-3" />
                        <span className="uppercase tracking-widest font-bold">
                          Sandbox Logs
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[9px] text-emerald-500 font-bold animate-pulse">
                          ● RUNTIME ACTIVE
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-slate-500 hover:text-white"
                          onClick={() => setShowTerminal(false)}
                        >
                          <XCircle className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div 
                      ref={terminalScrollRef}
                      onScroll={handleTerminalScroll}
                      className="flex-1 p-3 overflow-y-auto custom-scrollbar text-slate-400 bg-black/40"
                    >
                      {terminalOutput.map((line, i) => (
                        <div key={i} className="mb-0.5 whitespace-pre-wrap">
                          {line}
                        </div>
                      ))}
                      <div className="h-4" />
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </section>
        {isFullscreen && isChatMinimized && (
          <Button
            onClick={() => setIsChatMinimized(false)}
            className="fixed top-6 right-6 z-50 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 shadow-2xl shadow-blue-900/40 animate-in fade-in zoom-in duration-300"
          >
            <MessageSquare className="w-5 h-5 text-white" />
          </Button>
        )}
      </main>

      <style jsx global>{`
        @keyframes spin-reverse {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(-360deg);
          }
        }
        .animate-spin-reverse {
          animation: spin-reverse 1.5s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>

      <DiscoverySetupModal
        isOpen={isSetupOpen}
        onComplete={async (data) => {
          setIsSetupOpen(false);
          setComponentName(data.componentName);
          setFigmaUrl(data.figmaUrl);
          setBranchUrl(data.branchUrl);

          // We defer hydration if no project ID is selected yet. We will catch this in a useEffect.
          if (!selectedProjectId) return;

          setIsHydrating(true);
          setHydrationStatus('Fetching project bundle...');
          try {
            const res = await fetch(
              `/api/orchestrator/discovery/project-bundle?projectId=${selectedProjectId}`
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

              // Sync the file list UI with the hydrated bundle
              const hydratedFiles = flattenTree(bundle);
              setWrittenFiles(hydratedFiles);

              setHydrationStatus('Preparing runtime environment...');
              await startDevServer(instance);
            }
          } catch (e: any) {
            console.error('Hydration failed:', e);
            toast.error('Hydration failed, falling back to Template Mode.');
          } finally {
            setIsHydrating(false);
            setHydrationStatus('');
          }
        }}
      />

      <FeatureDevelopmentModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        figmaUrl={figmaUrl}
      />
    </div>
  );
}
