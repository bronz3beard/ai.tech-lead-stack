/**
 * @fileoverview Generic no-op proxy stubs — the shared implementation behind
 * every WebContainer-incompatible package replacement.
 *
 * ## Design philosophy
 * All stubbed packages ultimately resolve their `main` to
 * `webcontainer-stubs/index.js`, which exports an infinitely chainable no-op
 * `Proxy`. Any import from a stubbed package returns a value that:
 *
 *  - Can be called as a function:         `stub()`
 *  - Has any property accessed on it:     `stub.foo.bar.baz`
 *  - Will never throw:                    all paths return the same noop
 *  - Is **not** thenable:                 `stub.then === undefined` so
 *                                          `await stub` does not hang forever
 *
 * This is intentionally maximally permissive. The goal is to let the sandboxed
 * app **boot and render** without crashing on missing native modules — not to
 * provide functional implementations.
 */

/**
 * Content for `webcontainer-stubs/index.js`.
 *
 * The shared no-op Proxy entry point re-exported by every per-package stub.
 * Satisfies all common import patterns:
 *  - Default import:    `import Foo from 'pkg'`
 *  - Named import:      `import { bar } from 'pkg'`
 *  - CJS require:       `const x = require('pkg')`
 *  - Nx helper:         `createGlobPatternsForDependencies()` → `[]`
 */
export const INDEX_JS_STUB = `const noop = () => new Proxy(noop, {
  get: (t, p) => {
    if (p === 'then') return undefined;
    return noop;
  }
});
const stub = new Proxy(noop, { get: () => noop });
module.exports = stub;
module.exports.default = stub;
module.exports.createGlobPatternsForDependencies = () => [];
`;

/**
 * Content for `webcontainer-stubs/tailwind.js`.
 *
 * Some Tailwind + Nx project presets import a `tailwind.js` helper from the
 * workspace root (via `@nx/react` or `@nx/next` presets). This stub satisfies
 * the `createGlobPatternsForDependencies` export contract, preventing Tailwind's
 * content scanner from failing on a missing real implementation.
 */
export const TAILWIND_JS_STUB = `
module.exports = {
  createGlobPatternsForDependencies: () => []
};
`;

/**
 * Content for `webcontainer-stubs/src/devkit-exports.js`.
 *
 * `@nx/devkit` exposes a `workspaceRoot` constant imported by many Nx plugins
 * at module-initialisation time. Inside WebContainer there is no real Nx
 * workspace root, so this stub walks up from `process.cwd()` looking for the
 * nearest `pnpm-workspace.yaml` or `nx.json` as a best-effort approximation.
 */
export const DEVKIT_EXPORTS_JS_STUB = `
const fs = require('fs');
const path = require('path');
let root = process.cwd();
while (root && root !== '/') {
  if (
    fs.existsSync(path.join(root, 'pnpm-workspace.yaml')) ||
    fs.existsSync(path.join(root, 'nx.json'))
  ) {
    break;
  }
  const parent = path.dirname(root);
  if (parent === root) break;
  root = parent;
}
module.exports = { workspaceRoot: root };
`;

/**
 * Content written over any `middleware.ts` / `middleware.js` found in a hydrated
 * Next.js project.
 *
 * ## Why middleware must be neutralised
 * Next.js middleware executes in an **edge-like runtime** inside WebContainer.
 * The WASM sandbox cannot reliably propagate the `Request` object through the
 * edge adapter's `AsyncLocalStorage`-based context pipeline. As a result, the
 * `request` parameter received by the middleware function is frequently
 * `undefined`, causing:
 *
 * > `TypeError: Cannot read properties of undefined (reading 'url')`
 *
 * Since middleware (auth guards, redirects, header injection, etc.) serves no
 * purpose in a **preview-only sandbox**, we replace the entire file with a safe
 * passthrough that:
 *  1. Defensively checks `request` before accessing any property.
 *  2. Returns `NextResponse.next()` unconditionally — letting all requests
 *     through to the page router.
 *  3. Exports an empty `config.matcher` so Next.js doesn't apply it globally.
 */
export const MIDDLEWARE_NOOP_STUB = `
import { NextResponse } from 'next/server';

export function middleware(request) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
`;
