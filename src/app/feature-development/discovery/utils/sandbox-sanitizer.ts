import { WebContainer } from '@webcontainer/api';
import {
  ASYNC_STORAGE_PATCH_STUB,
  MIDDLEWARE_NOOP_STUB,
} from '../constants/stubs';

/**
 * Recursively cleans large/unnecessary caching directories and sanitizes
 * application files (middleware, fonts, service workers, problematic regexes)
 * to ensure they boot cleanly within a WebContainer environment.
 */
export async function sanitizeSandboxEnvironment(
  instance: WebContainer,
  appDir: string
) {
  console.log('[Sanitizer] Starting universal sandbox sanitization...');

  // 0. Inject mandatory WebContainer stability patches
  try {
    await instance.fs.mkdir('webcontainer-stubs', { recursive: true });
    await instance.fs.writeFile(
      'webcontainer-stubs/async-storage-patch.js',
      ASYNC_STORAGE_PATCH_STUB
    );
    console.log(
      '[Sanitizer] Injected async-storage-patch.js stability module.'
    );
  } catch (err) {
    console.warn('[Sanitizer] Failed to inject stability patches:', err);
  }

  // 1. Clean up binary folders recursively to prevent VFS SharedArrayBuffer memory limits crashes
  const foldersToClean = [
    '.next',
    'client/.next',
    'node_modules',
    '.nx',
    'client/.nx',
    '.turbo',
    'dist',
    '.swc',
    '.pnpm-store',
    'storybook/storybook-static',
  ];

  for (const folder of foldersToClean) {
    try {
      const proc = await instance.spawn('rm', ['-rf', folder]);
      await proc.exit;
    } catch {}
  }

  // 2. Scan and sanitize files recursively
  const sanitizeRecursively = async (dir: string) => {
    const files = await instance.fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
      const path = dir === '.' ? file.name : `${dir}/${file.name}`;

      // Remove known problematic files AND large non-essential files that trigger
      // WebContainer's DataView RangeError. WebContainer's builtins layer bypasses
      // our fs.readFileSync patch, so the ONLY reliable defense is to remove
      // large files from the VFS before the dev server reads them synchronously.
      const nameLower = file.name.toLowerCase();

      // --- VFS Diet: files that are never needed for compilation/dev server ---
      const isDocFile =
        nameLower === 'changelog.md' ||
        nameLower === 'changelog' ||
        nameLower === 'changes.md' ||
        nameLower === 'history.md' ||
        nameLower === 'readme.md' ||
        nameLower === 'readme' ||
        nameLower === 'contributing.md' ||
        nameLower === 'code_of_conduct.md' ||
        nameLower === 'security.md' ||
        nameLower === 'authors' ||
        nameLower === 'authors.md';

      const isLicenseFile =
        nameLower === 'license' ||
        nameLower === 'licence' ||
        nameLower === 'license.md' ||
        nameLower === 'licence.md' ||
        nameLower === 'license.txt' ||
        nameLower === 'licence.txt';

      const isBuildArtifact =
        file.name.endsWith('.tsbuildinfo') ||
        file.name.endsWith('.map') ||
        file.name.endsWith('.schema.json') ||
        file.name === 'pnpm-lock.yaml' ||
        file.name === 'package-lock.json' ||
        file.name === 'yarn.lock';

      if (isDocFile || isLicenseFile || isBuildArtifact) {
        try {
          await instance.fs.rm(path, { force: true });
          console.log(
            `[Sanitizer] VFS diet: removed non-essential file: ${path}`
          );
        } catch {}
        continue;
      }

      if (file.isDirectory()) {
        if (
          [
            '.next',
            '.nx',
            '.cache',
            'dist',
            'build',
            'storybook-static',
            '.swc',
            '.pnpm-store',
          ].includes(file.name)
        ) {
          try {
            await instance.fs.rm(path, { recursive: true, force: true });
            console.log(
              `[Sanitizer] Recursively purged large cache folder: ${path}`
            );
          } catch {}
        } else if (
          ![
            'node_modules',
            '.git',
            'webcontainer-stubs',
            'public',
            'generated',
          ].includes(file.name)
        ) {
          await sanitizeRecursively(path);
        }
      } else if (
        file.name.endsWith('.ts') ||
        file.name.endsWith('.tsx') ||
        file.name.endsWith('.js') ||
        file.name.endsWith('.jsx') ||
        file.name.endsWith('.html')
      ) {
        try {
          let content = await instance.fs.readFile(path, 'utf-8');
          let changed = false;

          // Neutralise Next.js middleware files — edge runtime in WebContainer
          // cannot reliably propagate the Request object
          if (file.name === 'middleware.ts' || file.name === 'middleware.js') {
            console.log(
              `[Middleware Fixer] Replacing ${path} with safe passthrough stub`
            );
            content = MIDDLEWARE_NOOP_STUB;
            changed = true;
          }

          if (
            content.includes('[\\p{Cc}\\p{Cf}]') ||
            content.includes('[\\p{Cc}]')
          ) {
            console.log(
              `[Regex Fixer] Sanitizing Unicode property escape regex in ${path}`
            );
            content = content.replace(
              /\/\[\\p\{Cc\}\\p\{Cf\}\]\/gu/g,
              '/[\\x00-\\x1F\\x7F-\\x9F]/g'
            );
            content = content.replace(
              /\/\[\\p\{Cc\}\]\/gu/g,
              '/[\\x00-\\x1F\\x7F-\\x9F]/g'
            );
            changed = true;
          }

          if (file.name === 'fonts.ts' || file.name === 'fonts.tsx') {
            if (
              content.includes('next/font/google') ||
              content.includes('next/font')
            ) {
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

          // Neutralise any custom framework Service Worker registration
          if (content.includes('navigator.serviceWorker')) {
            console.log(
              `[SW Sanitizer] Mocking navigator.serviceWorker inside ${path}`
            );
            content = content.replace(
              /navigator\s*\.\s*serviceWorker/g,
              `({ register: () => Promise.resolve({ active: true, scope: '/' }), addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true, getRegistrations: () => Promise.resolve([]), ready: new Promise(() => {}), controller: { postMessage: () => {} } })`
            );
            changed = true;
          }

          if (changed) {
            await instance.fs.writeFile(path, content);
          }
        } catch (e) {
          console.warn('[Code Sanitizer] Failed to rewrite file:', path, e);
        }
      }
    }
  };

  await sanitizeRecursively('.');

  // 3. Next.js specific deep sanitization
  try {
    const pkgContent = await instance.fs.readFile('package.json', 'utf-8');
    const pkg = JSON.parse(pkgContent);
    const isNext = pkg.dependencies?.next || pkg.devDependencies?.next;

    if (isNext) {
      // Force Next.js to use Babel instead of SWC. The SWC WASM binary is typically 30MB+
      // and attempting to load it synchronously inside WebContainer triggers the VFS DataView RangeError.
      // By injecting .babelrc, Next.js falls back to Babel (pure JS), bypassing the WASM binary completely.
      const babelConfig = `{
        "presets": ["next/babel"]
      }`;
      const targetBabel = appDir === '.' ? '.babelrc' : `${appDir}/.babelrc`;
      await instance.fs.writeFile(targetBabel, babelConfig);
      console.log(
        `[Sanitizer] Injected .babelrc to force Babel compiler (bypass SWC WASM crash) at: ${targetBabel}`
      );

      try {
        await instance.fs.rm('.swcrc');
      } catch {}
      try {
        await instance.fs.rm(`${appDir}/.swcrc`);
      } catch {}

      const safeConfig = `{
        reactStrictMode: true,
        images: { unoptimized: true },
        eslint: { ignoreDuringBuilds: true },
        typescript: { ignoreBuildErrors: true },
        webpack: (config, { dev, isServer }) => {
          if (dev) {
            config.watchOptions = {
              ignored: [
                '**/node_modules/**',
                '**/.next/**',
                '**/.nx/**',
                '**/dist/**',
                '**/.git/**'
              ]
            };
          }
          if (!isServer) {
            config.resolve = config.resolve || {};
            config.resolve.fallback = {
              ...config.resolve.fallback,
              fs: false,
              path: false,
              child_process: false,
              net: false,
              dns: false,
              tls: false,
            };
          }
          return config;
        }
      }`;

      // Exclusively use next.config.mjs to bypass the Next.js TypeScript config compilation
      const targetMjs =
        appDir === '.' ? 'next.config.mjs' : `${appDir}/next.config.mjs`;
      await instance.fs.writeFile(targetMjs, `export default ${safeConfig};`);
      console.log(
        `[Sanitizer] Exclusively wrote safe next.config.mjs at: ${targetMjs}`
      );

      // Delete any competing configurations that could cause conflicts or trigger TS compilation
      const configsToDelete = ['next.config.js', 'next.config.ts'];
      for (const cf of configsToDelete) {
        const targetToDelete = appDir === '.' ? cf : `${appDir}/${cf}`;
        try {
          await instance.fs.rm(targetToDelete);
          console.log(
            `[Sanitizer] Cleaned up competing config file to bypass TS compilation: ${targetToDelete}`
          );
        } catch {}
      }

      const instrs = [
        'instrumentation.ts',
        'instrumentation.js',
        'sentry.client.config.ts',
        'sentry.server.config.ts',
        'sentry.edge.config.ts',
      ];
      for (const f of instrs) {
        try {
          await instance.fs.rm(f);
        } catch {}
        try {
          await instance.fs.rm(`${appDir}/${f}`);
        } catch {}
        try {
          await instance.fs.rm(`src/${f}`);
        } catch {}
        try {
          await instance.fs.rm(`${appDir}/src/${f}`);
        } catch {}
      }

      // Neutralise middleware files at well-known Next.js locations.
      const middlewareFiles = ['middleware.ts', 'middleware.js'];
      for (const mw of middlewareFiles) {
        const candidates = [
          mw,
          `${appDir}/${mw}`,
          `src/${mw}`,
          `${appDir}/src/${mw}`,
        ];
        for (const candidate of candidates) {
          try {
            await instance.fs.readFile(candidate);
            await instance.fs.writeFile(candidate, MIDDLEWARE_NOOP_STUB);
            console.log(
              `[Middleware Fixer] Neutralised middleware at: ${candidate}`
            );
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn(
      '[Sanitizer] Failed to perform Next.js specific sanitization:',
      err
    );
  }

  console.log('[Sanitizer] Sanitization complete.');
}
