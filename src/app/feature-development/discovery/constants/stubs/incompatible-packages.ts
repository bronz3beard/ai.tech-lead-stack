/**
 * @fileoverview Categorized registry of npm packages incompatible with the
 * WebContainer runtime, and the spoofed versions used in their package.json stubs.
 *
 * ## Why packages are incompatible with WebContainer
 * WebContainer (https://webcontainer.io) runs Node.js inside a browser WebAssembly
 * sandbox. Packages in this registry fail in that environment because they:
 *  - Load platform-specific native binaries (.node addons, compiled Rust/C++)
 *  - Open raw TCP/Unix sockets to external services
 *  - Register OS-level signal handlers or patch global Node.js internals
 *  - Spawn child processes or long-lived daemon processes
 *  - Depend on capabilities unavailable in a browser (FS watchers, native crypto, etc.)
 *
 * ## Why stub versions matter
 * pnpm validates `file:` dependencies by reading the stub's `package.json` and
 * checking its `version` against all `peerDependencies` constraints in the tree.
 * `STUB_PEER_VERSIONS` maps each package to the **lowest version that satisfies
 * the widest known peer-constraint floor** in the npm ecosystem (2024–2026).
 * These are intentionally generic — not tied to any specific application.
 */

// ─── 1. Native SWC Compiler Binaries ────────────────────────────────────────
// @swc/* packages are Rust-compiled native Node.js addons (.node files).
// They cannot be loaded inside a WASM sandbox. Typical peer floor: ^1.3.85.
const SWC_NATIVE = [
  '@swc/core',
  '@swc-node/core',
  '@swc-node/register',
  '@swc/cli',
  '@swc/helpers',
] as const;

// ─── 2. Next.js Platform Transpiler Binaries ────────────────────────────────
// Next.js ships pre-compiled Rust (SWC) transpilers per OS/arch pair. The pure-JS
// fallback is used inside WebContainer; these native packages must be stubbed to
// prevent failed dlopen() / WASM binary load attempts at startup.
const NEXTJS_NATIVE = [
  '@next/swc-linux-x64-gnu',
  '@next/swc-linux-x64-musl',
  '@next/swc-win32-x64-msvc',
  '@next/swc-darwin-x64',
  '@next/swc-darwin-arm64',
] as const;

// ─── 3. Error Monitoring & Observability SDKs ───────────────────────────────
// These SDKs hook into Node.js internals (uncaughtException, process signals,
// http module patching). @sentry/profiling-node loads a native CPU profiler.
// All are incompatible with the sandboxed WebContainer process model.
const MONITORING = [
  '@sentry/nextjs',
  '@sentry/node',
  '@sentry/browser',
  '@sentry/react',
  '@sentry/profiling-node',
] as const;

// ─── 4. Nx Monorepo Tooling ──────────────────────────────────────────────────
// Nx spawns a long-lived daemon process for caching, file watching, and task
// orchestration. It also dynamically loads @swc-node as its TS runner.
// Inside WebContainer, Nx targets are replaced by the NX_CLI_MOCK_STUB binary.
const NX_TOOLING = [
  '@nx/next',
  '@nx/react',
  '@nx/js',
  '@nx/node',
  '@nx/web',
  '@nx/vite',
  'nx',
] as const;

// ─── 5. PWA / Service Worker Tooling ────────────────────────────────────────
// Service Worker registration requires browser SW APIs that are unavailable
// inside WebContainer's cross-origin iframe embedding model.
const PWA_TOOLING = ['@serwist/next', 'serwist'] as const;

// ─── 6. Media / Image Processing Native Binaries ────────────────────────────
// next-video shells out to FFmpeg; sharp uses libvips as a native Node addon.
// Neither native binary can execute inside a WASM/browser sandbox.
const MEDIA_PROCESSING = ['next-video', 'sharp'] as const;

// ─── 7. Database Client Binaries ─────────────────────────────────────────────
// Prisma's query engine is a native binary that opens TCP/Unix socket
// connections to databases. Raw sockets are unavailable in WebContainer.
// Apps must use Prisma Data Proxy or an HTTP transport for sandbox environments.
const DATABASE_CLIENTS = ['prisma', '@prisma/client'] as const;

// ─── Unified export ───────────────────────────────────────────────────────────

/**
 * Complete list of npm packages replaced with no-op stubs inside WebContainer.
 *
 * @remarks
 * This list is intentionally **framework and project agnostic**. Add any package
 * here that relies on native binaries, OS-level APIs, or direct socket access.
 * The sandbox initialisation loop will automatically create a correctly-named
 * per-package stub directory for every entry in this array.
 */
export const INCOMPATIBLE_PACKAGES: string[] = [
  ...SWC_NATIVE,
  ...NEXTJS_NATIVE,
  ...MONITORING,
  ...NX_TOOLING,
  ...PWA_TOOLING,
  ...MEDIA_PROCESSING,
  ...DATABASE_CLIENTS,
];

/**
 * Maps each incompatible package to a version number that satisfies the widest
 * range of `peerDependencies` semver constraints across the npm ecosystem.
 *
 * @remarks
 * - Values here reflect **ecosystem-wide** peer floors, not any specific app.
 * - Update a version only when a new major raises the ecosystem minimum
 *   (e.g. a framework ships a new major that bumps its peer floor).
 * - Packages not listed here fall back to `'1.0.0'` which satisfies `^1.x`
 *   and `>=1.x` peer constraints.
 */
export const STUB_PEER_VERSIONS: Readonly<Record<string, string>> = {
  // SWC — satisfies common ^1.3.x / ^1.8.x peer floors
  '@swc/core': '1.10.0',
  '@swc-node/core': '1.13.0',
  '@swc-node/register': '1.10.0',
  '@swc/cli': '0.5.0',
  '@swc/helpers': '0.5.0',
  // Next.js native transpilers — match the Next.js 15.x series
  '@next/swc-linux-x64-gnu': '15.5.0',
  '@next/swc-linux-x64-musl': '15.5.0',
  '@next/swc-win32-x64-msvc': '15.5.0',
  '@next/swc-darwin-x64': '15.5.0',
  '@next/swc-darwin-arm64': '15.5.0',
  // Sentry — v8 is the stable major as of 2025
  '@sentry/nextjs': '8.0.0',
  '@sentry/node': '8.0.0',
  '@sentry/browser': '8.0.0',
  '@sentry/react': '8.0.0',
  '@sentry/profiling-node': '8.0.0',
  // Nx — v20 matches the latest stable series
  '@nx/next': '20.6.4',
  '@nx/react': '20.6.4',
  '@nx/js': '20.6.4',
  '@nx/node': '20.6.4',
  '@nx/web': '20.6.4',
  '@nx/vite': '20.6.4',
  nx: '20.6.4',
  // Serwist (Workbox successor) — v9 stable
  '@serwist/next': '9.0.0',
  serwist: '9.0.0',
  // Media processing
  'next-video': '2.0.0',
  sharp: '0.33.0',
  // Prisma — v6 stable
  prisma: '6.0.0',
  '@prisma/client': '6.0.0',
};
