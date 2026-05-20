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
      if (store !== undefined && store !== null) {
        this[lastActiveStoreSymbol] = store;
        this[wasSeededSymbol] = true;
      }
      try {
        return originalRun.call(this, store, () => {
          const result = callback();
          if (result && typeof result.then === 'function') {
            return result.then(
              (res) => {
                // Only restore if prevStore was a real value (nested context).
                // Top-level stores (prevStore === undefined) are kept alive.
                if (prevStore !== undefined && prevStore !== null) {
                  this[lastActiveStoreSymbol] = prevStore;
                }
                return res;
              },
              (err) => {
                if (prevStore !== undefined && prevStore !== null) {
                  this[lastActiveStoreSymbol] = prevStore;
                }
                throw err;
              }
            );
          }
          if (prevStore !== undefined && prevStore !== null) {
            this[lastActiveStoreSymbol] = prevStore;
          }
          return result;
        }, ...args);
      } catch (err) {
        if (prevStore !== undefined && prevStore !== null) {
          this[lastActiveStoreSymbol] = prevStore;
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
      return asyncHooks || originalRequire.apply(this, arguments);
    }
    return originalRequire.apply(this, arguments);
  };
  console.log('[WebContainer Patch] Intercepted Module require for async_hooks');
} catch (e) {
  console.error('[WebContainer Patch] Failed to intercept Module require:', e);
}
`;
