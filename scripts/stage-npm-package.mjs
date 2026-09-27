#!/usr/bin/env node
/**
 * @file stage-npm-package.mjs
 * @description Assembles the public npm package `tech-lead-stack` (the MCP
 * server plus the skills and workflows it serves) in a staging folder, ready
 * for `npm pack`. The workspace package keeps its internal name,
 * @zenithfoundry/tech-lead-stack; only the staged manifest carries the public
 * name. The server finds its skills by walking up from dist/ to a folder that
 * holds `.ai/skills` and `.agents/workflows` (packages/core/src/lib/skills/
 * repo-root.ts), which the staged package root does.
 * Run `pnpm run mcp:build` first. Usage:
 *   node scripts/stage-npm-package.mjs [outDir]   (default: .tmp/npm-package)
 */

import fs from 'fs';
import { builtinModules } from 'module';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORE = path.join(ROOT, 'packages/core');
const BUNDLE = path.join(CORE, 'dist/mcp-server.mjs');

export const PUBLISHED_NAME = 'tech-lead-stack';

// Everything the server reads from its package root at runtime.
const BUNDLED_PATHS = [
  '.ai/skills',
  '.ai/hr-skills',
  '.ai/pm-skills',
  '.ai/policies',
  '.ai/hooks',
  '.ai/skills.graph.json',
  '.ai/agent-surfaces.json',
  // Read by `tech-lead-stack init` to install Cursor skills.
  '.ai/cursor-skills.manifest',
  '.agents/workflows',
  '.agents/pm-workflows',
  '.agents/hr-workflows',
  'LICENSE',
];

const packageName = (specifier) =>
  specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/');

/** Package names the bundle imports, excluding Node built-ins and relative paths. */
export function bareImports(bundleSource) {
  const names = new Set();
  for (const [, specifier] of bundleSource.matchAll(
    /\b(?:from|import)\s*\(?\s*["']([^"'./][^"']*)["']/g
  )) {
    const name = packageName(specifier);
    if (!specifier.startsWith('node:') && !builtinModules.includes(name)) {
      names.add(name);
    }
  }
  return names;
}

/** The published package.json: public name, CLI entry, and only the runtime dependencies. */
export function buildManifest({ corePackage, runtimeDependencies }) {
  const dependencies = {};
  for (const name of [...runtimeDependencies].sort()) {
    const range = corePackage.dependencies?.[name];
    if (!range) {
      throw new Error(
        `The MCP bundle needs "${name}", but packages/core/package.json does not list it as a dependency.`
      );
    }
    dependencies[name] = range;
  }
  return {
    name: PUBLISHED_NAME,
    version: corePackage.version,
    description: corePackage.description,
    keywords: ['mcp', 'mcp-server', 'agent-skills', 'tech-lead', 'ai-agents'],
    license: corePackage.license,
    author: corePackage.author,
    homepage: corePackage.homepage,
    repository: corePackage.repository,
    bugs: corePackage.bugs,
    engines: corePackage.engines,
    type: 'module',
    bin: { [PUBLISHED_NAME]: 'dist/mcp-server.mjs' },
    files: ['dist', '.ai', '.agents'],
    dependencies,
  };
}

function stage(outDir) {
  if (!fs.existsSync(BUNDLE)) {
    throw new Error(`${BUNDLE} is missing. Run: pnpm run mcp:build`);
  }
  const corePackage = JSON.parse(
    fs.readFileSync(path.join(CORE, 'package.json'), 'utf8')
  );
  const runtimeDependencies = bareImports(fs.readFileSync(BUNDLE, 'utf8'));
  const manifest = buildManifest({ corePackage, runtimeDependencies });

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'dist'), { recursive: true });
  fs.copyFileSync(BUNDLE, path.join(outDir, 'dist/mcp-server.mjs'));
  for (const entry of BUNDLED_PATHS) {
    fs.cpSync(path.join(ROOT, entry), path.join(outDir, entry), {
      recursive: true,
    });
  }
  fs.copyFileSync(path.join(CORE, 'README.md'), path.join(outDir, 'README.md'));
  fs.writeFileSync(
    path.join(outDir, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  console.log(`Staged ${PUBLISHED_NAME}@${manifest.version} in ${outDir}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    stage(path.resolve(process.argv[2] ?? path.join(ROOT, '.tmp/npm-package')));
  } catch (err) {
    console.error(`stage-npm-package: ${err.message}`);
    process.exit(1);
  }
}
