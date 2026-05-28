/**
 * @fileoverview Environment variables injected into the WebContainer dev-server
 * child process to maximise sandbox stability and compatibility.
 *
 * ## Why these vars are needed
 * A standard `next dev` process relies on OS-level file watchers (inotify /
 * kqueue), OpenTelemetry, and Sentry instrumentation — none of which are
 * available inside WebContainer. These env vars disable incompatible subsystems
 * and substitute polling-based watchers that work in the WASM VFS.
 *
 * Each variable is documented inline with the problem it solves.
 */

/**
 * Environment variables passed to the spawned dev-server process.
 *
 * @remarks
 * These are **additive only** — they do not override variables the application
 * itself declares in `.env` files. They are merged at spawn time via the
 * WebContainer `spawn()` `env` option.
 */
export const DEV_SERVER_ENV: Record<string, string> = {
  // Prevents Next.js / Vercel from sending anonymous telemetry data — avoids
  // outbound fetch requests that fail silently in the sandbox.
  NEXT_TELEMETRY_DISABLED: '1',

  // Enable polling-based file watching (chokidar) because inotify-based
  // watchers are not available in the WebContainer WASM VFS.
  CHOKIDAR_USEPOLLING: '1',

  // Enable polling for webpack's watchpack (used by Next.js HMR).
  WATCHPACK_POLLING: '1',

  // Increase the Node.js heap to handle large monorepo trees that
  // would otherwise hit V8's default limits in the WASM sandbox.
  // Note: We intentionally avoid setting custom --stack-size here, as custom V8 call stacks
  // exceed native WebAssembly execution limits and trigger RangeError VFS crashes.
  NODE_OPTIONS: '--max-old-space-size=4096',

  // Disable OpenTelemetry fetch tracing — outbound OTEL requests fail in the
  // sandbox and produce noisy error logs.
  NEXT_OTEL_FETCH_DISABLED: '1',

  // Skip Next.js V8 code-cache optimisation — not applicable in WASM.
  NEXT_PRIVATE_LOCAL_SKIP_V8_OPTIMIZE: '1',

  // Prevent Sentry from auto-instrumenting the Next.js server at startup.
  // Even though Sentry is stubbed, residual config files may trigger init.
  SENTRY_SKIP_AUTO_INSTRUMENTATION: '1',
  NEXT_SENTRY_SKIP_INIT: '1',
  SENTRY_IGNORE_API_ERRORS: '1',

  // Bind the dev server to port 3000 so the WebContainer 'server-ready' event
  // fires predictably.
  PORT: '3000',

  // Reduce the number of simultaneous FS watch handles to stay within the
  // WebContainer VFS limit.
  WATCHPACK_WATCHER_LIMIT: '20',

  // Polling interval in milliseconds — 500 ms is a reasonable balance between
  // responsiveness and CPU load inside the WASM sandbox.
  CHOKIDAR_INTERVAL: '500',

  // Redirect the Nx task cache to /tmp so it doesn't pollute the project VFS.
  NX_CACHE_DIRECTORY: '/tmp/nx-cache',

  // Disable the Nx daemon — it spawns a persistent background process that
  // cannot survive in the WebContainer process model.
  NX_DAEMON: 'false',

  // Disable React Fast Refresh/HMR client-side code instrumentation and WebSocket
  // connection channels. In iframe environments like WebContainers, HMR socket
  // connection loss triggers infinite client-side full-page reload loops.
  FAST_REFRESH: 'false',
};
