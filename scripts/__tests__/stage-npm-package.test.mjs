import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  PUBLISHED_NAME,
  bareImports,
  buildManifest,
} from '../stage-npm-package.mjs';

const BUNDLE = [
  'import { Server } from "@modelcontextprotocol/sdk/server/index.js";',
  'import matter from "gray-matter";',
  'import * as fs from "fs";',
  'import { readFile } from "node:fs/promises";',
  'import { thing } from "./local.js";',
  'const lazy = await import("zod");',
  'import "dotenv/config";',
].join('\n');

const CORE_PACKAGE = {
  name: '@zenithfoundry/tech-lead-stack',
  version: '1.2.3',
  description: 'MCP server',
  license: 'MIT',
  repository: {
    type: 'git',
    url: 'git+https://github.com/bronz3beard/ai.tech-lead-stack.git',
  },
  dependencies: {
    '@modelcontextprotocol/sdk': '^1.30.1',
    'gray-matter': '^4.0.3',
    octokit: '^5.0.5',
  },
};

describe('bareImports', () => {
  it('returns package names, reducing scoped and deep imports to the package', () => {
    assert.deepStrictEqual([...bareImports(BUNDLE)].sort(), [
      '@modelcontextprotocol/sdk',
      'dotenv',
      'gray-matter',
      'zod',
    ]);
  });
});

describe('buildManifest', () => {
  const manifest = buildManifest({
    corePackage: CORE_PACKAGE,
    runtimeDependencies: new Set(['gray-matter', '@modelcontextprotocol/sdk']),
  });

  it('publishes under the public name with a CLI that starts the MCP server', () => {
    assert.strictEqual(manifest.name, PUBLISHED_NAME);
    assert.deepStrictEqual(manifest.bin, {
      [PUBLISHED_NAME]: 'dist/mcp-server.mjs',
    });
    assert.strictEqual(manifest.version, '1.2.3');
  });

  it('carries the licence and repository needed for provenance', () => {
    assert.strictEqual(manifest.license, 'MIT');
    assert.deepStrictEqual(manifest.repository, CORE_PACKAGE.repository);
  });

  it('depends only on what the bundle uses, at the workspace versions', () => {
    assert.deepStrictEqual(manifest.dependencies, {
      '@modelcontextprotocol/sdk': '^1.30.1',
      'gray-matter': '^4.0.3',
    });
  });

  it('never leaks the internal workspace name', () => {
    assert.doesNotMatch(JSON.stringify(manifest), /@zenithfoundry/);
  });

  it('fails when the bundle needs a package packages/core does not declare', () => {
    assert.throws(
      () =>
        buildManifest({
          corePackage: CORE_PACKAGE,
          runtimeDependencies: new Set(['left-pad']),
        }),
      /needs "left-pad"/
    );
  });
});
