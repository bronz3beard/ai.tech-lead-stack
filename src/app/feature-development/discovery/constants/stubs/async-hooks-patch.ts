/**
 * @fileoverview Node.js `AsyncLocalStorage` prototype patch for WebContainer.
 */

export const ASYNC_STORAGE_PATCH_STUB = `
// Propagate this patch to all child processes automatically
if (!process.env.NODE_OPTIONS) {
  process.env.NODE_OPTIONS = '--require /tmp/async-storage-patch.js';
} else if (process.env.NODE_OPTIONS.indexOf('async-storage-patch.js') === -1) {
  process.env.NODE_OPTIONS += ' --require /tmp/async-storage-patch.js';
}

// -----------------------------------------------------------------------------
// WebContainer readFileUtf8 Guard (fs.readFileSync)
// -----------------------------------------------------------------------------
try {
  const fs = require('fs');
  const originalReadFileSync = fs.readFileSync;

  // WebContainer's WASM bridge crashes (DataView out of bounds) when readFileUtf8
  // is called on large files or files with certain character sequences.
  // To completely bypass this, we force all readFileSync calls to read as a Buffer
  // first (which uses the much safer readFileBuffer WASM binding) and then manually
  // decode to a string in the Node.js context.
  fs.readFileSync = function (path, options) {
    let encoding = null;
    let flag = 'r';
    
    if (typeof options === 'string') {
      encoding = options;
    } else if (options && typeof options === 'object') {
      if (options.encoding) encoding = options.encoding;
      if (options.flag) flag = options.flag;
    }

    if (encoding) {
      // Force read as Buffer by completely omitting the encoding property
      let bufOptions = { flag: flag };
      let buf = originalReadFileSync(path, bufOptions);
      return buf.toString(encoding);
    }
    
    // If no encoding requested, read as Buffer normally
    return originalReadFileSync(path, options);
  };
  console.log('[WebContainer Patch] Registered fs.readFileSync buffer fallback guard to bypass WASM crashes.');

  // =========================================================================
  // DEEP PATCH: Module Loader Override
  // The Node.js module loader captures fs.readFileSync internally before our
  // patch runs. When it requires large files like bundle5.js (2.4MB), it uses
  // the unpatched version which requests 'utf8' and crashes the WASM bridge.
  // We MUST reimplement the extensions to force buffer reading!
  // =========================================================================
  try {
    const Module = require('module');
    if (Module && Module._extensions) {
      
      const originalJsExt = Module._extensions['.js'];
      Module._extensions['.js'] = function(module, filename) {
        // Force reading as a buffer to avoid DataView crashes
        let buf = originalReadFileSync(filename, { flag: 'r' });
        let content = buf.toString('utf8');
        // Strip BOM
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }
        module._compile(content, filename);
      };

      const originalJsonExt = Module._extensions['.json'];
      Module._extensions['.json'] = function(module, filename) {
        let buf = originalReadFileSync(filename, { flag: 'r' });
        let content = buf.toString('utf8');
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }
        try {
          module.exports = JSON.parse(content);
        } catch (err) {
          err.message = filename + ': ' + err.message;
          throw err;
        }
      };
      
      console.log('[WebContainer Patch] Successfully deep-patched Module._extensions for .js and .json');
    }
  } catch (e) {
    console.error('[WebContainer Patch] Deep patch failed:', e);
  }
} catch (e) {
  console.error('[WebContainer Patch] Failed to intercept fs.readFileSync:', e);
}


let asyncHooks = null;
try {
  asyncHooks = require('async_hooks');
  if (asyncHooks && asyncHooks.AsyncLocalStorage) {
    const OriginalAsyncLocalStorage = asyncHooks.AsyncLocalStorage;

    const originalGetStore  = OriginalAsyncLocalStorage.prototype.getStore;
    const originalRun       = OriginalAsyncLocalStorage.prototype.run;
    const originalEnterWith = OriginalAsyncLocalStorage.prototype.enterWith;

    const lastActiveStoreSymbol = Symbol('lastActiveStore');
    const wasSeededSymbol       = Symbol('wasSeeded');

    OriginalAsyncLocalStorage.prototype.getStore = function() {
      const store = originalGetStore.call(this);
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

// Universal browser-side HMR loop prevention injector.
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
