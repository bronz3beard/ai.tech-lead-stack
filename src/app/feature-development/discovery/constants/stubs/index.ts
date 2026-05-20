/**
 * @fileoverview Barrel export for the WebContainer stub system.
 *
 * Import from this module (or from the parent `stubs.ts` shim) to get all
 * stubs, helpers, and configuration needed to initialise a WebContainer sandbox.
 *
 * ## Module map
 * | Module                   | Exports                                        |
 * |--------------------------|------------------------------------------------|
 * | `incompatible-packages`  | `INCOMPATIBLE_PACKAGES`, `STUB_PEER_VERSIONS`  |
 * | `package-manifest`       | `PACKAGE_JSON_STUB`, `buildPackageJsonStub()`  |
 * | `noop-proxy`             | `INDEX_JS_STUB`, `TAILWIND_JS_STUB`, `DEVKIT_EXPORTS_JS_STUB` |
 * | `nx-cli-mock`            | `NX_JS_STUB`                                   |
 * | `async-hooks-patch`      | `ASYNC_STORAGE_PATCH_STUB`                     |
 * | `dev-server-env`         | `DEV_SERVER_ENV`                               |
 */

export * from './incompatible-packages';
export * from './package-manifest';
export * from './noop-proxy';
export * from './nx-cli-mock';
export * from './async-hooks-patch';
export * from './dev-server-env';
