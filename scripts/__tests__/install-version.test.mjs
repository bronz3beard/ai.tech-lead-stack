import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { packageVersion } from '../../packages/core/src/install/version.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
const coreVersion = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, 'packages', 'core', 'package.json'),
    'utf8'
  )
).version;

test('packageVersion reads the package version when run from source', async () => {
  assert.equal(await packageVersion(), coreVersion);
});

test('the built server reports the package version, not the advertised one', () => {
  const bundle = path.join(
    repoRoot,
    'packages',
    'core',
    'dist',
    'mcp-server.mjs'
  );
  assert.ok(fs.existsSync(bundle), `${bundle} is missing; run pnpm install.`);
  const run = spawnSync(process.execPath, [bundle, '--version'], {
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), coreVersion);
});

test('packageVersion fails clearly when no stack package.json is above', async () => {
  await assert.rejects(packageVersion('file:///'), /package\.json not found/);
});
