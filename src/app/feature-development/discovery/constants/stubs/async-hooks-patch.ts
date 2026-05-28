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
    return originalRequire.call(this, id);
  };
  console.log('[WebContainer Patch] Intercepted Module require for async_hooks');
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
  const SIZE_THRESHOLD = 512 * 1024; // 512KB — files above this are at high risk of VFS overflow
  const nameTargets = ['.wasm', '.node'];

  async function findAndPreload(dir) {
    try {
      const files = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          if (!['.git', '.next', 'dist', '.pnpm-store', 'public', 'generated', '.cache'].includes(file.name)) {
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

  // Start background preloading from the node_modules directory
  findAndPreload(path.join(process.cwd(), 'node_modules'));
  // Also preload from the project root (covers libs/, packages/, etc.)
  findAndPreload(process.cwd());

  // Prototype-patch fs.readFileSync to instantly intercept and serve from the async preloaded cache.
  // If the file is not preloaded and the original readFileSync throws a RangeError (VFS overflow),
  // we catch it and return a graceful fallback instead of crashing the process.
  const originalReadFileSync = fs.readFileSync;
  fs.readFileSync = function(filePath, options) {
    try {
      const resolved = path.resolve(typeof filePath === 'string' ? filePath : filePath.toString());
      if (preloadedCache.has(resolved)) {
        console.log('[WebContainer Patch] Intercepted sync read, returning preloaded memory buffer for:', resolved);
        const buf = preloadedCache.get(resolved);
        if (options) {
          if (typeof options === 'string') {
            return buf.toString(options);
          } else if (options.encoding) {
            return buf.toString(options.encoding);
          }
        }
        return buf;
      }
    } catch (e) {}

    try {
      return originalReadFileSync.apply(this, arguments);
    } catch (err) {
      // Catch the specific RangeError that crashes WebContainer's WASM VFS sync bridge
      // when reading files too large for the SharedArrayBuffer DataView.
      if (err instanceof RangeError && err.message && err.message.includes('DataView')) {
        const resolvedPath = typeof filePath === 'string' ? filePath : String(filePath);
        console.warn('[WebContainer Patch] RangeError caught in readFileSync for:', resolvedPath, '— returning empty fallback to prevent crash.');

        // Attempt async preload for next time this file is requested
        const absPath = path.resolve(resolvedPath);
        fs.promises.readFile(absPath)
          .then(buf => {
            preloadedCache.set(absPath, buf);
            console.log('[WebContainer Patch] Late-preloaded file after RangeError:', absPath, '(' + buf.length + ' bytes)');
          })
          .catch(() => {});

        // Return appropriate empty fallback based on requested encoding
        if (options) {
          if (typeof options === 'string' || (options && options.encoding)) {
            return '';
          }
        }
        return Buffer.alloc(0);
      }
      throw err;
    }
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
