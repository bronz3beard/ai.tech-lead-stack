/**
 * Version helpers shared by the CLI (`--version`, `init`, `doctor`) and the
 * install-output refresh.
 *
 * The refresh compares the running server's version with the one recorded in
 * ~/.tech-lead-stack/installed.json, so it must read the package's real
 * version. The MCP server's advertised `Server` info carries a hard-coded
 * value that drifts; never use that.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAMES = new Set([
  'tech-lead-stack',
  '@zenithfoundry/tech-lead-stack',
]);

const versionParts = (v) =>
  String(v)
    .replace(/^v/, '')
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0);

/**
 * True when version a is the same as or newer than b ("v0.50.0", "0.43.1").
 * Same rule as cli/doctor-checks.ts#versionAtLeast. Kept as a second copy on
 * purpose: core's Jest compiles TS to CommonJS and cannot require this .mjs
 * file, and install/ code runs as plain node and cannot import the .ts one.
 */
export function versionAtLeast(a, b) {
  const [x, y] = [versionParts(a), versionParts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return true;
}

/**
 * The version of this package, from the nearest package.json above this
 * module whose name is the stack's. Works from source (src/install/), from the
 * clone bundle (packages/core/dist/) and from the npm package (dist/), because
 * a fixed `../package.json` is only right for one of those layouts.
 */
export async function packageVersion(from = import.meta.url) {
  let dir = path.dirname(fileURLToPath(from));
  for (;;) {
    try {
      const pkg = JSON.parse(
        await fs.readFile(path.join(dir, 'package.json'), 'utf8')
      );
      if (PACKAGE_NAMES.has(pkg.name) && pkg.version) return pkg.version;
    } catch {
      // No package.json here, or not readable: keep walking up.
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error('tech-lead-stack package.json not found above ' + from);
    }
    dir = parent;
  }
}
