import { WebContainer } from '@webcontainer/api';

/**
 * Initializes native npm/pnpm workspaces and sanitizes tsconfig.json files
 * to ensure path mapping and native linking function correctly without
 * relying on legacy Nx CLI mocking.
 */
export async function flattenWorkspace(instance: WebContainer) {
  console.log('[Flattener] Initializing native workspace flattening...');

  // 1. Detect package manager and global configurations from the workspace root
  let packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' = 'npm';
  let globalTrpcVersion: string | null = null;

  try {
    const rootFiles = await instance.fs.readdir('.', { withFileTypes: true });
    const fileNames = rootFiles.map(f => f.name);
    
    // Determine the package manager by looking for specific lockfiles
    if (fileNames.includes('pnpm-lock.yaml')) packageManager = 'pnpm';
    else if (fileNames.includes('yarn.lock')) packageManager = 'yarn';
    else if (fileNames.includes('bun.lockb')) packageManager = 'bun';
    
    // Attempt to extract the global tRPC version from the root package.json if it exists
    if (fileNames.includes('package.json')) {
      const rootPkgContent = await instance.fs.readFile('package.json', 'utf-8');
      const rootPkg = JSON.parse(rootPkgContent);
      const deps = { ...(rootPkg.dependencies || {}), ...(rootPkg.devDependencies || {}) };
      globalTrpcVersion = deps['@trpc/client'] || deps['@trpc/server'] || deps['@trpc/react-query'] || deps['@trpc/next'] || null;
    }
  } catch (err) {
    console.warn('[Flattener] Failed to detect workspace context:', err);
  }

  // 2. Recursively scan and flatten the workspace files
  const flattenRecursively = async (dir: string) => {
    try {
      const files = await instance.fs.readdir(dir, { withFileTypes: true });
      for (const file of files) {
        const path = dir === '.' ? file.name : `${dir}/${file.name}`;
        
        // Traverse directories, skipping non-source and heavy build output folders
        if (file.isDirectory()) {
          if (!['node_modules', '.git', 'dist', '.next', '.nx'].includes(file.name)) {
            await flattenRecursively(path);
          }
        } else if (file.name.endsWith('tsconfig.json') || file.name === 'tsconfig.base.json') {
          // Sanitize TypeScript configs to prevent heavy compilation memory crashes in WebContainers
          try {
            let content = await instance.fs.readFile(path, 'utf-8');
            let changed = false;
            
            try {
              // Strip comments for safe JSON parsing
              const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
              const parsed = JSON.parse(cleanContent);
              
              if (parsed.compilerOptions) {
                // Disable composite and incremental builds to save memory
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
              // Fallback: use regex to rewrite flags if JSON parsing fails due to trailing commas/etc.
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
              console.log(`[Flattener] Disabled composite/incremental/map in: ${path}`);
            }
          } catch (e) {
            console.warn('[Flattener] Failed to rewrite tsconfig:', path, e);
          }
        } else if (file.name === 'package.json') {
          // Sanitize package.json files to inject proper resolutions and strip heavy scripts
          try {
            const content = await instance.fs.readFile(path, 'utf-8');
            const p = JSON.parse(content);
            let changed = false;

            // Dynamically detect tRPC version: prefer local to this package.json, fallback to global root version
            const deps = { ...(p.dependencies || {}), ...(p.devDependencies || {}) };
            const localTrpcVersion = deps['@trpc/client'] || deps['@trpc/server'] || deps['@trpc/react-query'] || deps['@trpc/next'];
            const trpcVersion = localTrpcVersion || globalTrpcVersion;

            if (p.name && trpcVersion && dir === '.') {
              const trpcPackages = ['@trpc/client', '@trpc/next', '@trpc/react-query', '@trpc/server'];
              
              // Apply the discovered tRPC version using the detected package manager's resolution strategy
              if (packageManager === 'pnpm') {
                p.pnpm = p.pnpm || {};
                p.pnpm.overrides = p.pnpm.overrides || {};
                trpcPackages.forEach(name => { p.pnpm.overrides[name] = trpcVersion; });
              } else if (packageManager === 'yarn') {
                p.resolutions = p.resolutions || {};
                trpcPackages.forEach(name => { p.resolutions[name] = trpcVersion; });
              } else {
                p.overrides = p.overrides || {};
                trpcPackages.forEach(name => { p.overrides[name] = trpcVersion; });
              }
              changed = true;
            }

            // Strip out pre/post install scripts that often fail in WebContainers
            if (p.scripts) {
              ['postinstall', 'prepare', 'preinstall'].forEach(s => {
                if (p.scripts[s]) {
                  delete p.scripts[s];
                  changed = true;
                }
              });
              
              // Remove --turbo flag as TurboPack can have issues in WebContainers
              if (p.scripts.dev && p.scripts.dev.includes('--turbo')) {
                p.scripts.dev = p.scripts.dev.replace('--turbo', '');
                changed = true;
              }
            }

            if (changed) {
              await instance.fs.writeFile(path, JSON.stringify(p, null, 2));
              console.log(`[Flattener] Sanitized package.json scripts and overrides: ${path}`);
            }
          } catch (e) {
            console.warn('[Flattener] Failed to parse package.json:', path, e);
          }
        }
      }
    } catch (err) {
      console.warn(`[Flattener] Skip directory crawl ${dir}:`, err);
    }
  };

  await flattenRecursively('.');
}
