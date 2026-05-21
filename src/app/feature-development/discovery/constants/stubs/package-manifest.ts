/**
 * @fileoverview `package.json` generators for the WebContainer stub system.
 *
 * The stub system needs two kinds of package manifests:
 *
 * **1. Root manifest** (`webcontainer-stubs/package.json`)
 * Owns the shared `index.js` noop-proxy and the `bin/nx.js` mock CLI.
 * Never directly linked as a `file:` dependency — it's the implementation owner.
 *
 * **2. Per-package manifests** (`webcontainer-stubs/<pkg>/package.json`)
 * One directory per incompatible package. Each carries the *correct* package
 * `name` and a `version` that satisfies ecosystem peer-dependency constraints.
 *
 * ### Why per-package manifests are required
 * pnpm's `.pnpmfile.cjs` hook validates every resolved `file:` dependency by
 * reading the target's `package.json` and confirming the `name` field matches
 * the name declared in `dependencies`. A single shared stub with
 * `name: 'webcontainer-stubs'` fails this check with `pnpm: Invalid package`.
 * Per-package stubs satisfy both the name check and peer-semver validation.
 *
 * @see {@link buildPackageJsonStub} for runtime generation.
 * @see {@link STUB_PEER_VERSIONS} for version rationale.
 */

import { STUB_PEER_VERSIONS } from './incompatible-packages';

/**
 * Root `package.json` for the shared `webcontainer-stubs/` directory.
 *
 * This is the **implementation owner** — it points `main` at `index.js`
 * (the noop Proxy) and registers the mock `nx` binary. Per-package stubs
 * reference this file via a relative `main` path.
 */
export const PACKAGE_JSON_STUB = JSON.stringify(
  {
    name: 'webcontainer-stubs',
    version: '1.0.0',
    main: 'index.js',
    bin: { nx: './bin/nx.js' },
  },
  null,
  2
);

/**
 * Generates a per-package `package.json` stub for a single incompatible package.
 *
 * ### Path depth
 * The `main` field must resolve back to `webcontainer-stubs/index.js`:
 * - Non-scoped  `webcontainer-stubs/sharp/`           → `main: '../../index.js'`
 * - Scoped      `webcontainer-stubs/@swc/core/`        → `main: '../../../index.js'`
 *
 * @param packageName - Exact npm package name, e.g. `'@swc/core'` or `'sharp'`
 * @returns JSON string suitable for writing to `<stubDir>/package.json`
 *
 * @example
 * // { name: "@swc/core", version: "1.10.0", main: "../../../index.js", ... }
 * buildPackageJsonStub('@swc/core');
 */
export function buildPackageJsonStub(packageName: string): string {
  const version = STUB_PEER_VERSIONS[packageName] ?? '1.0.0';

  const manifest: any = {
    name: packageName,
    version,
    main: './index.js',
    exports: {
      ".": "./index.js",
      "./*": "./index.js"
    },
    // Empty peerDependenciesMeta signals zero peer requirements for the stub
    // itself, suppressing residual "unmet peer" warnings from pnpm.
    peerDependenciesMeta: {},
  };

  if (packageName === 'nx') {
    manifest.bin = { nx: '../bin/nx.js' };
  }

  return JSON.stringify(manifest, null, 2);
}
