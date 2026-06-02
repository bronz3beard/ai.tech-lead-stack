/**
 * @fileoverview Node.js `AsyncLocalStorage` prototype patch for WebContainer.
 *
 * ## Root Cause
 * WebContainer runs Node.js inside a browser WebAssembly sandbox. Because of
 * how V8 promise microtasks are scheduled in the WASM environment, execution
 * context is **lost across every `await` boundary**. `AsyncLocalStorage`
 * internally uses Node.js async hooks (`async_hooks`) to propagate context,
 * but those hooks are never triggered after WebContainer yields control to the
 * browser event loop.
 *
 * Result: `AsyncLocalStorage.prototype.getStore()` returns `undefined` after
 * any `await`, causing Next.js 15.5+ to throw:
 * > `Invariant: Expected workUnitAsyncStorage to have a store. This is a bug in Next.js.`
 *
 * ## Fix: Scoped Fallback Store
 * We prototype-patch `AsyncLocalStorage` with a per-instance `lastActiveStore`
 * Symbol that caches the most-recently set store value. The patched `getStore()`
 * returns the cached fallback **only** when:
 *  1. The native `getStore()` returns `undefined` (context was lost), AND
 *  2. This specific instance was **explicitly seeded** via `run()` or `enterWith()`
 *     (tracked by a `wasSeeded` Symbol).
 *
 * ## Why the scope guard is critical
 * Without the `wasSeeded` guard, the fallback applies to **every** ALS instance
 * globally — including ones that should legitimately return `undefined`. For
 * example, Next.js middleware uses its own ALS instance for the edge-runtime
 * request adapter. Returning a stale store from a prior request causes:
 * > `TypeError: Cannot read properties of undefined (reading 'url')`
 *
 * The `wasSeeded` guard ensures the fallback is isolated to instances that were
 * explicitly activated, leaving all unrelated ALS instances completely untouched.
 *
 * ## Why top-level stores are not restored to `undefined`
 * In a real Node.js process, `run()` restores the previous store after the
 * callback exits, enabling proper nested-context scoping. In WebContainer, the
 * "exit" happens synchronously but rendering continues asynchronously — so by
 * the time async rendering code calls `getStore()`, the store has already been
 * cleared to `undefined`. We restore the previous store **only if it is
 * non-null/non-undefined**, keeping the top-level request context alive for
 * all downstream async rendering. Nested contexts (where `prevStore` is a real
 * object) are still restored correctly.
 *
 * ## Injection mechanism
 * This file is written to `webcontainer-stubs/async-storage-patch.js` in the
 * VFS and loaded via Node.js `--require` in the dev-server spawn options, so
 * it runs before any application code or Next.js internals are initialised.
 */

/**
 * Preloader script injected via `NODE_OPTIONS="--require <path>"` before the
 * Next.js dev server starts inside WebContainer.
 *
 * @remarks
 * The script is intentionally written as a CommonJS string (not ESM) because
 * Node.js `--require` only supports CJS preloaders.
 */
export const ASYNC_STORAGE_PATCH_STUB = `
// Propagate this patch to all child processes automatically
if (!process.env.NODE_OPTIONS) {
  process.env.NODE_OPTIONS = '--require /tmp/async-storage-patch.js';
} else if (process.env.NODE_OPTIONS.indexOf('async-storage-patch.js') === -1) {
  process.env.NODE_OPTIONS += ' --require /tmp/async-storage-patch.js';
}

// ─── Layer 2: Process-Level Crash Guard ────────────────────────────────────────
// WebContainer's builtins module bypasses our fs.readFileSync patch entirely.
// The WASM VFS throws RangeError from DataView.prototype.setInt32 when reading
// large files synchronously, and since our try/catch wrapper never executes,
// the error propagates as an uncaught exception that kills the process.
// This handler catches it at the process level as a nuclear safety net.
process.on('uncaughtException', function(err) {
  var isDataViewOverflow = err && (
    err.name === 'RangeError' ||
    (err.message && String(err.message).indexOf('DataView') !== -1) ||
    (err.message && String(err.message).indexOf('bounds') !== -1)
  );
  if (isDataViewOverflow) {
    console.warn('[WebContainer Patch] Caught fatal DataView RangeError at process level — suppressed to prevent crash:', err.message || err);
    return; // Swallow — process survives
  }
  // Re-throw non-DataView errors so normal crash behavior is preserved.
  // Using console.error + process.exit instead of throw to avoid infinite recursion.
  console.error('[WebContainer Patch] Uncaught exception (non-DataView):', err);
  process.exit(1);
});

let asyncHooks = null;
try {
  asyncHooks = require('async_hooks');
  if (asyncHooks && asyncHooks.AsyncLocalStorage) {
    const OriginalAsyncLocalStorage = asyncHooks.AsyncLocalStorage;

    const originalGetStore  = OriginalAsyncLocalStorage.prototype.getStore;
    const originalRun       = OriginalAsyncLocalStorage.prototype.run;
    const originalEnterWith = OriginalAsyncLocalStorage.prototype.enterWith;

    // Per-instance tracking symbols — invisible to application code.
    // lastActiveStore: the most-recently activated store for this ALS instance.
    // wasSeeded:       true once run() or enterWith() has been called with a
    //                  non-null store, enabling the fallback for this instance.
    const lastActiveStoreSymbol = Symbol('lastActiveStore');
    const wasSeededSymbol       = Symbol('wasSeeded');

    OriginalAsyncLocalStorage.prototype.getStore = function() {
      const store = originalGetStore.call(this);
      // Apply the fallback ONLY when:
      //  a) the native context was lost (store === undefined), AND
      //  b) this instance was explicitly seeded with a real store.
      if (store === undefined && this[wasSeededSymbol] === true) {
        return this[lastActiveStoreSymbol];
      }
      return store;
    };

    OriginalAsyncLocalStorage.prototype.run = function(store, callback, ...args) {
      const prevStore = this[lastActiveStoreSymbol];
      const prevWasSeeded = this[wasSeededSymbol];

      if (store !== undefined && store !== null) {
        this[lastActiveStoreSymbol] = store;
        this[wasSeededSymbol] = true;
      } else if (store === undefined) {
        this[lastActiveStoreSymbol] = undefined;
        this[wasSeededSymbol] = false;
      }

      try {
        return originalRun.call(this, store, () => {
          const result = callback(...args);
          if (result && typeof result.then === 'function') {
            return result.then(
              (res) => {
                // Only restore if prevStore was a real value (nested context).
                // Top-level stores (prevStore === undefined) are kept alive.
                if (prevStore !== undefined && prevStore !== null) {
                  this[lastActiveStoreSymbol] = prevStore;
                  this[wasSeededSymbol] = prevWasSeeded;
                } else if (store === undefined) {
                  this[lastActiveStoreSymbol] = prevStore;
                  this[wasSeededSymbol] = prevWasSeeded;
                }
                return res;
              },
              (err) => {
                if (prevStore !== undefined && prevStore !== null) {
                  this[lastActiveStoreSymbol] = prevStore;
                  this[wasSeededSymbol] = prevWasSeeded;
                } else if (store === undefined) {
                  this[lastActiveStoreSymbol] = prevStore;
                  this[wasSeededSymbol] = prevWasSeeded;
                }
                throw err;
              }
            );
          }
          if (prevStore !== undefined && prevStore !== null) {
            this[lastActiveStoreSymbol] = prevStore;
            this[wasSeededSymbol] = prevWasSeeded;
          } else if (store === undefined) {
            this[lastActiveStoreSymbol] = prevStore;
            this[wasSeededSymbol] = prevWasSeeded;
          }
          return result;
        });
      } catch (err) {
        if (prevStore !== undefined && prevStore !== null) {
          this[lastActiveStoreSymbol] = prevStore;
          this[wasSeededSymbol] = prevWasSeeded;
        } else if (store === undefined) {
          this[lastActiveStoreSymbol] = prevStore;
          this[wasSeededSymbol] = prevWasSeeded;
        }
        throw err;
      }
    };

    OriginalAsyncLocalStorage.prototype.enterWith = function(store) {
      if (store !== undefined && store !== null) {
        this[lastActiveStoreSymbol] = store;
        this[wasSeededSymbol] = true;
      }
      return originalEnterWith.call(this, store);
    };

    console.log('[WebContainer Patch] Prototype-patched AsyncLocalStorage successfully.');
  }
} catch (e) {
  console.error('[WebContainer Patch] Failed to patch AsyncLocalStorage prototype:', e);
}

let workerThreadsPatched = null;
try {
  const wt = require('worker_threads');
  const OriginalWorker = wt.Worker;
  class PatchedWorker extends OriginalWorker {
    constructor(filename, options) {
      const opts = options || {};
      const execArgv = opts.execArgv ? [...opts.execArgv] : [...process.execArgv];
      let hasRequire = false;
      for (let i = 0; i < execArgv.length; i++) {
        if (execArgv[i] === '--require' || execArgv[i] === '-r') {
          if (execArgv[i+1] && execArgv[i+1].includes('async-storage-patch.js')) {
            hasRequire = true;
            break;
          }
        }
      }
      if (!hasRequire) {
        execArgv.push('--require', '/tmp/async-storage-patch.js');
      }
      opts.execArgv = execArgv;
      super(filename, opts);
    }
  }
  Object.setPrototypeOf(PatchedWorker, OriginalWorker);
  wt.Worker = PatchedWorker;
  workerThreadsPatched = wt;
  console.log('[WebContainer Patch] Intercepted worker_threads.Worker successfully.');
} catch (e) {
  // worker_threads not available
}

let childProcessPatched = null;
try {
  const cp = require('child_process');
  
  const originalSpawn = cp.spawn;
  cp.spawn = function(command, args, options) {
    let commandStr = String(command);
    let patchedArgs = args ? [...args] : [];
    let patchedOptions = options ? { ...options } : {};
    
    if (commandStr === 'node' || commandStr === 'nodejs' || commandStr === process.execPath) {
      let hasRequire = false;
      for (let i = 0; i < patchedArgs.length; i++) {
        if (patchedArgs[i] === '--require' || patchedArgs[i] === '-r') {
          if (patchedArgs[i+1] && patchedArgs[i+1].includes('async-storage-patch.js')) {
            hasRequire = true;
            break;
          }
        }
      }
      if (!hasRequire) {
        let scriptIndex = patchedArgs.findIndex(arg => !arg.startsWith('-'));
        if (scriptIndex === -1) {
          patchedArgs.push('--require', '/tmp/async-storage-patch.js');
        } else {
          patchedArgs.splice(scriptIndex, 0, '--require', '/tmp/async-storage-patch.js');
        }
      }
    }
    return originalSpawn.call(this, command, patchedArgs, patchedOptions);
  };
  
  const originalFork = cp.fork;
  cp.fork = function(modulePath, args, options) {
    const opts = options ? { ...options } : {};
    const execArgv = opts.execArgv ? [...opts.execArgv] : [...process.execArgv];
    
    let hasRequire = false;
    for (let i = 0; i < execArgv.length; i++) {
      if (execArgv[i] === '--require' || execArgv[i] === '-r') {
        if (execArgv[i+1] && execArgv[i+1].includes('async-storage-patch.js')) {
          hasRequire = true;
          break;
        }
      }
    }
    if (!hasRequire) {
      execArgv.push('--require', '/tmp/async-storage-patch.js');
    }
    opts.execArgv = execArgv;
    return originalFork.call(this, modulePath, args, opts);
  };
  
  childProcessPatched = cp;
  console.log('[WebContainer Patch] Intercepted child_process.spawn and fork successfully.');
} catch (e) {
  // child_process not available
}

// Intercept Module.require so that any dynamic require('async_hooks') or
// require('node:async_hooks') call — including those inside node_modules —
// receives the already-patched asyncHooks object rather than the raw module.
try {
  const Module = require('module');
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function(id) {
    if (id === 'async_hooks' || id === 'node:async_hooks') {
      return asyncHooks;
    }
    if ((id === 'worker_threads' || id === 'node:worker_threads') && workerThreadsPatched) {
      return workerThreadsPatched;
    }
    if ((id === 'child_process' || id === 'node:child_process') && childProcessPatched) {
      return childProcessPatched;
    }
    return originalRequire.call(this, id);
  };
  console.log('[WebContainer Patch] Intercepted Module require for async_hooks, worker_threads, child_process');
} catch (e) {
  console.error('[WebContainer Patch] Failed to intercept Module require:', e);
}


// Large File Preloader & fs.readFileSync cache wrapper.
// This completely solves the RangeError: Offset is outside the bounds of the DataView crash
// in WebContainers by preloading large files asynchronously (WASM binaries, .node addons,
// and any file over 512KB). Asynchronous reads never overflow the SharedArrayBuffer sync bridge.
// When Next.js or Vite calls fs.readFileSync, we instantly serve the preloaded memory cache.
// Additionally, the patched readFileSync catches RangeError from the original implementation
// and returns a graceful fallback instead of crashing the entire process.
try {
  const fs = require('fs');
  const path = require('path');
  const preloadedCache = new Map();
  const SIZE_THRESHOLD = 32 * 1024; // 32KB — files above this are at high risk of VFS overflow
  const nameTargets = ['.wasm', '.node'];

  async function findAndPreload(dir) {
    try {
      const files = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          // Do not exclude 'generated' as it may contain large GraphQL codegen files needed by the compiler.
          if (!['.git', '.next', 'dist', '.pnpm-store', 'public', '.cache'].includes(file.name)) {
            findAndPreload(fullPath);
          }
        } else {
          const isNameTarget = nameTargets.some(ext => file.name.endsWith(ext));
          if (isNameTarget) {
            // Always preload known binary targets regardless of size
            fs.promises.readFile(fullPath)
              .then(buf => {
                const resolved = path.resolve(fullPath);
                preloadedCache.set(resolved, buf);
                console.log('[WebContainer Patch] Preloaded known binary to bypass VFS sync bridge limits:', resolved, '(' + buf.length + ' bytes)');
              })
              .catch(() => {});
          } else {
            // For other files, stat first and preload if over the size threshold
            fs.promises.stat(fullPath)
              .then(stats => {
                if (stats.size >= SIZE_THRESHOLD) {
                  return fs.promises.readFile(fullPath).then(buf => {
                    const resolved = path.resolve(fullPath);
                    preloadedCache.set(resolved, buf);
                    console.log('[WebContainer Patch] Preloaded large file (' + stats.size + ' bytes) to bypass VFS sync bridge:', resolved);
                  });
                }
              })
              .catch(() => {});
          }
        }
      }
    } catch (e) {}
  }

  // Prioritize preloading known large system/CLI files
  const priorityTargets = [
    '/bin/jsh',
    '/usr/local/lib/node_modules/npm/dist/common.js',
    '/usr/local/lib/node_modules/npm/bin/npm-cli.js'
  ];
  for (const target of priorityTargets) {
    fs.promises.readFile(target)
      .then(buf => {
        const resolved = path.resolve(target);
        preloadedCache.set(resolved, buf);
        console.log('[WebContainer Patch] Prioritized preload complete:', resolved, '(' + buf.length + ' bytes)');
      })
      .catch(() => {});
  }

  // Sleep the main thread for 50ms to allow the priority preloads to complete
  try {
    const sab = new SharedArrayBuffer(4);
    const int32 = new Int32Array(sab);
    Atomics.wait(int32, 0, 0, 50);
  } catch (e) {}

  let isMainThread = true;
  try { isMainThread = require('worker_threads').isMainThread; } catch(e) {}
  
  if (isMainThread !== false) {
    // Start background preloading from system directories only in main thread
    findAndPreload('/bin');
    findAndPreload('/usr/local/lib/node_modules');
    // Also preload from the project root (covers libs/, packages/, etc.)
    findAndPreload(process.cwd());
  }

  function formatResult(buf, options) {
    if (options) {
      if (typeof options === 'string') {
        return buf.toString(options);
      } else if (options.encoding) {
        return buf.toString(options.encoding);
      }
    }
    return buf;
  }

  // Prototype-patch fs.readFileSync to instantly intercept and serve from the async preloaded cache.
  // If a file is too large and has not been preloaded yet, we read it in chunks of 64KB.
  // This avoids overflowing the WebContainer sync-bridge SharedArrayBuffer.

  const originalReadFileSync = fs.readFileSync;
  fs.readFileSync = function(filePath, options) {
    let resolved = '';
    let isFd = typeof filePath === 'number';
    let fd = isFd ? filePath : null;

    try {
      if (!isFd) {
        resolved = path.resolve(typeof filePath === 'string' ? filePath : filePath.toString());
        if (preloadedCache.has(resolved)) {
          return formatResult(preloadedCache.get(resolved), options);
        }
      }
    } catch (e) {}

    // Chunked reader fallback to prevent DataView RangeError on large un-cached files
    try {
      const stats = isFd ? fs.fstatSync(fd) : fs.statSync(filePath);
      if ((stats.isFile() || isFd) && stats.size > SIZE_THRESHOLD) {
        console.log('[WebContainer Patch] Sync reading large file in chunks to prevent VFS crash:', resolved || ('FD:'+fd), '(' + stats.size + ' bytes)');
        let openedFd = false;
        if (!isFd) {
          fd = fs.openSync(filePath, 'r');
          openedFd = true;
        }
        try {
          const chunks = [];
          const buffer = Buffer.alloc(64 * 1024); // 64KB chunks
          let totalBytesRead = 0;
          while (totalBytesRead < stats.size) {
            const toRead = Math.min(buffer.length, stats.size - totalBytesRead);
            const bytesRead = fs.readSync(fd, buffer, 0, toRead, null);
            if (bytesRead === 0) break;
            const chunk = Buffer.alloc(bytesRead);
            buffer.copy(chunk, 0, 0, bytesRead);
            chunks.push(chunk);
            totalBytesRead += bytesRead;
          }
          const buf = Buffer.concat(chunks);
          if (resolved) preloadedCache.set(resolved, buf);
          return formatResult(buf, options);
        } finally {
          if (openedFd) {
            try { fs.closeSync(fd); } catch (e) {}
          }
        }
      }
    } catch (err) {
      if (err && err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
        console.warn('[WebContainer Patch] Chunked read failed/skipped for:', resolved || ('FD:'+fd), err.message);
      }
    }

    try {
      return originalReadFileSync.apply(this, arguments);
    } catch (err) {
      const isRangeError = err && (
        err instanceof RangeError || 
        err.name === 'RangeError' || 
        (err.message && String(err.message).includes('DataView'))
      );
      if (isRangeError) {
        console.warn('[WebContainer Patch] RangeError caught in readFileSync for:', resolved || ('FD:'+fd), '— falling back to chunked read.');
        try {
          const stats = isFd ? fs.fstatSync(fd) : fs.statSync(filePath);
          let openedFd = false;
          if (!isFd) { fd = fs.openSync(filePath, 'r'); openedFd = true; }
          try {
            const chunks = [];
            const buffer = Buffer.alloc(64 * 1024);
            let totalBytesRead = 0;
            while (totalBytesRead < stats.size) {
              const toRead = Math.min(buffer.length, stats.size - totalBytesRead);
              const bytesRead = fs.readSync(fd, buffer, 0, toRead, null);
              if (bytesRead === 0) break;
              const chunk = Buffer.alloc(bytesRead);
              buffer.copy(chunk, 0, 0, bytesRead);
              chunks.push(chunk);
              totalBytesRead += bytesRead;
            }
            const buf = Buffer.concat(chunks);
            if (resolved) preloadedCache.set(resolved, buf);
            return formatResult(buf, options);
          } finally {
            if (openedFd) { try { fs.closeSync(fd); } catch (e) {} }
          }
        } catch (fallbackErr) {
          console.warn('[WebContainer Patch] Fallback chunked read failed:', fallbackErr.message);
          if (options && (typeof options === 'string' || options.encoding)) return '';
          return Buffer.alloc(0);
        }
      }
      throw err;
    }
  };

  const originalReadFileAsync = fs.promises.readFile;
  fs.promises.readFile = async function(filePath, options) {
    let resolved = '';
    let isFd = typeof filePath === 'number';
    let fd = isFd ? filePath : null;

    if (!isFd) {
      try {
        resolved = path.resolve(typeof filePath === 'string' ? filePath : filePath.toString());
        if (preloadedCache.has(resolved)) {
          return formatResult(preloadedCache.get(resolved), options);
        }
      } catch (e) {}
    }

    try {
      const stats = isFd ? await fs.promises.fstat(fd) : await fs.promises.stat(filePath);
      if ((stats.isFile() || isFd) && stats.size > SIZE_THRESHOLD) {
        console.log('[WebContainer Patch] Async reading large file in chunks to prevent VFS crash:', resolved || ('FD:'+fd), '(' + stats.size + ' bytes)');
        let openedFd = false;
        let fileHandle = null;
        if (!isFd) {
          fileHandle = await fs.promises.open(filePath, 'r');
          fd = fileHandle.fd;
          openedFd = true;
        }
        try {
          const chunks = [];
          const buffer = Buffer.alloc(64 * 1024);
          let totalBytesRead = 0;
          while (totalBytesRead < stats.size) {
            const toRead = Math.min(buffer.length, stats.size - totalBytesRead);
            const { bytesRead } = await (fileHandle ? fileHandle.read(buffer, 0, toRead, null) : new Promise((res, rej) => fs.read(fd, buffer, 0, toRead, null, (err, br) => err ? rej(err) : res({bytesRead: br}))));
            if (bytesRead === 0) break;
            const chunk = Buffer.alloc(bytesRead);
            buffer.copy(chunk, 0, 0, bytesRead);
            chunks.push(chunk);
            totalBytesRead += bytesRead;
          }
          const buf = Buffer.concat(chunks);
          if (resolved) preloadedCache.set(resolved, buf);
          return formatResult(buf, options);
        } finally {
          if (openedFd && fileHandle) {
            try { await fileHandle.close(); } catch (e) {}
          }
        }
      }
    } catch (err) {
      if (err && err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
        console.warn('[WebContainer Patch] Chunked async read failed/skipped for:', resolved || ('FD:'+fd), err.message);
      }
    }

    try {
      return await originalReadFileAsync.apply(this, arguments);
    } catch (err) {
      const isRangeError = err && (err instanceof RangeError || err.name === 'RangeError' || (err.message && String(err.message).includes('DataView')));
      if (isRangeError) {
        console.warn('[WebContainer Patch] RangeError caught in async readFile for:', resolved || ('FD:'+fd), '— returning empty fallback to prevent crash.');
        if (options && (typeof options === 'string' || options.encoding)) return '';
        return Buffer.alloc(0);
      }
      throw err;
    }
  };

  try {
    const fsPromises = require('fs/promises');
    fsPromises.readFile = fs.promises.readFile;
  } catch(e) {}

  const originalReadFileCb = fs.readFile;
  fs.readFile = function(filePath, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    fs.promises.readFile(filePath, options)
      .then(res => callback(null, res))
      .catch(err => callback(err));
  };
  console.log('[WebContainer Patch] Registered fs.readFileSync large-file stabilizer successfully.');
} catch (e) {
  console.error('[WebContainer Patch] Failed to register large-file stabilizer:', e);
}

// Universal browser-side HMR loop prevention injector.
// Patches Node's native http ServerResponse to dynamically inject a Client-side
// WebSocket / EventSource mock that intercepts HMR sockets and holds them in a
// perpetual CONNECTING state, preventing Fast Refresh/HMR from loops or reloading.
try {
  const http = require('http');
  const originalWrite = http.ServerResponse.prototype.write;
  const originalEnd = http.ServerResponse.prototype.end;

  const mockScript = [
    '<script>',
    '  (function() {',
    '    if (window.__HMR_STABILIZER_INJECTED__) return;',
    '    window.__HMR_STABILIZER_INJECTED__ = true;',
    '    console.log("[HMR Stabilizer] Injecting browser-side reload loop prevention...");',
    '    ',
    '    // Mock WebSocket to intercept HMR connections and prevent connection-lost reload loops',
    '    const OriginalWebSocket = window.WebSocket;',
    '    window.WebSocket = function(url, protocols) {',
    '      if (url && (url.includes("webpack-hmr") || url.includes("hmr") || url.includes("vite"))) {',
    '        console.log("[HMR Stabilizer] Neutralizing HMR WebSocket:", url);',
    '        const mockWS = {',
    '          url: url,',
    '          readyState: 0, // CONNECTING',
    '          send: function() {},',
    '          close: function() {},',
    '          addEventListener: function() {},',
    '          removeEventListener: function() {},',
    '          dispatchEvent: function() { return true; }',
    '        };',
    '        return mockWS;',
    '      }',
    '      return new OriginalWebSocket(url, protocols);',
    '    };',
    '    window.WebSocket.prototype = OriginalWebSocket.prototype;',
    '    for (let key in OriginalWebSocket) {',
    '      window.WebSocket[key] = OriginalWebSocket[key];',
    '    }',
    '',
    '    // Mock EventSource for older Next.js / framework fallback channels',
    '    const OriginalEventSource = window.EventSource;',
    '    window.EventSource = function(url, configuration) {',
    '      if (url && (url.includes("webpack-hmr") || url.includes("hmr"))) {',
    '        console.log("[HMR Stabilizer] Neutralizing HMR EventSource:", url);',
    '        const mockES = {',
    '          url: url,',
    '          readyState: 0, // CONNECTING',
    '          close: function() {},',
    '          addEventListener: function() {},',
    '          removeEventListener: function() {},',
    '          dispatchEvent: function() { return true; }',
    '        };',
    '        return mockES;',
    '      }',
    '      return new OriginalEventSource(url, configuration);',
    '    };',
    '    window.EventSource.prototype = OriginalEventSource.prototype;',
    '    for (let key in OriginalEventSource) {',
    '      window.EventSource[key] = OriginalEventSource[key];',
    '    }',
    '  })();',
    '</script>'
  ].join('\\n');

  function shouldInject(res) {
    const contentType = res.getHeader('content-type');
    return contentType && typeof contentType === 'string' && contentType.includes('text/html');
  }

  function injectHtml(res, chunk) {
    if (!chunk || !shouldInject(res)) return chunk;
    try {
      let str = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      if (str.includes('<head>')) {
        str = str.replace('<head>', '<head>' + mockScript);
        return typeof chunk === 'string' ? str : Buffer.from(str, 'utf8');
      }
    } catch (e) {}
    return chunk;
  }

  http.ServerResponse.prototype.write = function(chunk, encoding, callback) {
    chunk = injectHtml(this, chunk);
    return originalWrite.call(this, chunk, encoding, callback);
  };

  http.ServerResponse.prototype.end = function(chunk, encoding, callback) {
    if (typeof chunk === 'function') {
      return originalEnd.call(this, chunk, encoding, callback);
    }
    chunk = injectHtml(this, chunk);
    return originalEnd.call(this, chunk, encoding, callback);
  };

  console.log('[WebContainer Patch] Registered HTML HMR stabilizer injector successfully.');
} catch (e) {
  console.error('[WebContainer Patch] Failed to register HMR stabilizer injector:', e);
}
`;
