import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { hashOf } from '../../packages/core/src/install/copies.mjs';
import {
  applyReconcile,
  installSurfaces,
  planHasWork,
  planReconcile,
} from '../../packages/core/src/install/reconcile.mjs';

// The Continue surface copies <root>/.agents/workflows/*.md to
// <home>/.continue/prompts/*.prompt, which makes a small, readable fixture.
const SURFACE = { id: 'continue-prompts' };
let root;
let home;
let record;

const workflow = (name) =>
  path.join(root, '.agents', 'workflows', `${name}.md`);
const prompt = (name) =>
  path.join(home, '.continue', 'prompts', `${name}.prompt`);
const read = (file) => fs.readFileSync(file, 'utf8');

beforeEach(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-reconcile-'));
  root = path.join(base, 'source');
  home = path.join(base, 'home');
  fs.mkdirSync(path.dirname(workflow('a')), { recursive: true });
  fs.writeFileSync(workflow('a'), 'a v1');
  fs.writeFileSync(workflow('b'), 'b v1');
  record = {
    version: null,
    files: {},
    source: null,
    surfaces: null,
    lastRefresh: null,
  };
});

async function run({ mode = 'refresh', surfaces = [SURFACE], ...rest } = {}) {
  const plan = await planReconcile({ record, surfaces, root, home });
  const result = await applyReconcile({ plan, mode, record, home, ...rest });
  record = result.record;
  return { plan, ...result };
}

describe('planReconcile + applyReconcile', () => {
  test('writes a fresh surface and records every file under it', async () => {
    const { summary, error } = await run({ mode: 'install' });
    assert.equal(error, null);
    assert.equal(summary.written.length, 2);
    assert.equal(read(prompt('a')), 'a v1');
    assert.equal(record.files[prompt('a')], hashOf('a v1'));
    assert.deepEqual(record.surfaces, [
      { id: 'continue-prompts', files: [prompt('a'), prompt('b')] },
    ]);
  });

  test('is a no-op when everything is up to date', async () => {
    await run({ mode: 'install' });
    const plan = await planReconcile({
      record,
      surfaces: [SURFACE],
      root,
      home,
    });
    assert.equal(planHasWork({ plan, record, mode: 'refresh' }), false);
  });

  test('writes a new skill and updates a changed one', async () => {
    await run({ mode: 'install' });
    fs.writeFileSync(workflow('a'), 'a v2');
    fs.writeFileSync(workflow('c'), 'c v1');
    const { summary } = await run();
    assert.deepEqual(summary.written.sort(), [prompt('a'), prompt('c')]);
    assert.equal(read(prompt('a')), 'a v2');
  });

  test('removes a skill that disappeared, but only if the file is still ours', async () => {
    await run({ mode: 'install' });
    fs.rmSync(workflow('b'));
    const { summary } = await run();
    assert.deepEqual(summary.removed, [prompt('b')]);
    assert.ok(!fs.existsSync(prompt('b')));
    assert.ok(!(prompt('b') in record.files));
  });

  test('keeps a removed skill the user edited, and stops managing it', async () => {
    await run({ mode: 'install' });
    fs.writeFileSync(prompt('b'), 'my notes');
    fs.rmSync(workflow('b'));
    const { summary } = await run();
    assert.equal(read(prompt('b')), 'my notes');
    assert.deepEqual(
      summary.kept.map((k) => k.to),
      [prompt('b')]
    );
    assert.ok(!(prompt('b') in record.files));
  });

  test('an edited file is kept by a refresh and backed up by an install', async () => {
    await run({ mode: 'install' });
    fs.writeFileSync(prompt('a'), 'my edit');
    fs.writeFileSync(workflow('a'), 'a v2');

    const refresh = await run();
    assert.equal(read(prompt('a')), 'my edit');
    assert.deepEqual(
      refresh.summary.kept.map((k) => k.to),
      [prompt('a')]
    );

    const install = await run({ mode: 'install' });
    assert.equal(read(prompt('a')), 'a v2');
    assert.ok(
      install.backupDir.startsWith(
        path.join(home, '.tech-lead-stack', 'backup')
      )
    );
    assert.equal(
      read(path.join(install.backupDir, '.continue', 'prompts', 'a.prompt')),
      'my edit'
    );
  });

  test('never follows or replaces a symlink, in either mode', async () => {
    const outside = path.join(root, 'outside.txt');
    fs.writeFileSync(outside, 'not ours');
    fs.mkdirSync(path.dirname(prompt('a')), { recursive: true });
    fs.symlinkSync(outside, prompt('a'));
    for (const mode of ['refresh', 'install']) {
      const { summary } = await run({ mode });
      assert.ok(fs.lstatSync(prompt('a')).isSymbolicLink(), mode);
      assert.equal(read(outside), 'not ours');
      assert.ok(
        summary.kept.some((k) => k.to === prompt('a')),
        mode
      );
    }
  });

  test('adopts an identical file it did not write', async () => {
    fs.mkdirSync(path.dirname(prompt('a')), { recursive: true });
    fs.writeFileSync(prompt('a'), 'a v1');
    const { summary } = await run();
    assert.ok(summary.adopted.includes(prompt('a')));
    assert.equal(record.files[prompt('a')], hashOf('a v1'));
  });

  test('a file edited between planning and applying is kept, not overwritten', async () => {
    await run({ mode: 'install' });
    fs.writeFileSync(workflow('a'), 'a v2');
    const plan = await planReconcile({
      record,
      surfaces: [SURFACE],
      root,
      home,
    });
    fs.writeFileSync(prompt('a'), 'edited mid-refresh'); // after the plan was made
    const { summary } = await applyReconcile({
      plan,
      mode: 'refresh',
      record,
      home,
    });
    assert.equal(read(prompt('a')), 'edited mid-refresh');
    assert.ok(summary.kept.some((k) => k.to === prompt('a')));
  });

  test('a destination replaced by a folder between planning and applying is kept', async () => {
    await run({ mode: 'install' });
    fs.writeFileSync(workflow('a'), 'a v2');
    const plan = await planReconcile({
      record,
      surfaces: [SURFACE],
      root,
      home,
    });
    fs.rmSync(prompt('a'));
    fs.mkdirSync(prompt('a'));
    const { summary } = await applyReconcile({
      plan,
      mode: 'install',
      record,
      home,
    });
    assert.ok(fs.statSync(prompt('a')).isDirectory());
    assert.ok(summary.kept.some((k) => k.to === prompt('a')));
  });

  test('an interrupted apply records what landed and the next one finishes', async () => {
    const controller = new AbortController();
    const first = await run({
      onFile: () => controller.abort(),
      signal: controller.signal,
    });
    assert.match(first.error, /stopped/);
    assert.equal(first.summary.written.length, 1);
    assert.equal(
      Object.keys(record.files).length,
      1,
      'the landed file is recorded'
    );

    const second = await run();
    assert.equal(second.error, null);
    assert.equal(second.summary.kept.length, 0, 'nothing mistaken for an edit');
    assert.ok(fs.existsSync(prompt('a')) && fs.existsSync(prompt('b')));
  });

  test('dropping a surface removes its files that are still ours and keeps edited ones', async () => {
    await run({ mode: 'install' });
    fs.writeFileSync(prompt('b'), 'my notes');
    const { summary } = await run({ mode: 'install', surfaces: [] });
    assert.ok(!fs.existsSync(prompt('a')));
    assert.equal(read(prompt('b')), 'my notes');
    assert.deepEqual(
      summary.kept.map((k) => k.to),
      [prompt('b')]
    );
    assert.deepEqual(record.files, {});
    assert.deepEqual(record.surfaces, []);
  });

  test('a backup that cannot be made skips only that file; the rest still apply', async () => {
    await run({ mode: 'install' });
    fs.writeFileSync(prompt('a'), 'my edit');
    fs.writeFileSync(workflow('a'), 'a v2');
    fs.writeFileSync(workflow('b'), 'b v2');
    // A file where the backup folder should go makes every backup fail.
    fs.mkdirSync(path.join(home, '.tech-lead-stack'), { recursive: true });
    fs.writeFileSync(path.join(home, '.tech-lead-stack', 'backup'), 'blocker');

    const { summary, error } = await run({ mode: 'install' });
    assert.equal(error, null, 'one failed backup must not stop the apply');
    assert.equal(
      read(prompt('a')),
      'my edit',
      'not overwritten without a backup'
    );
    assert.ok(summary.kept.some((k) => k.to === prompt('a')));
    assert.equal(read(prompt('b')), 'b v2', 'later files still apply');
  });

  test('a file replaced by a folder after planning stays exactly where it is', async () => {
    await run({ mode: 'install' });
    fs.rmSync(workflow('b'));
    const plan = await planReconcile({
      record,
      surfaces: [SURFACE],
      root,
      home,
    });
    fs.rmSync(prompt('b'));
    fs.mkdirSync(prompt('b'));
    fs.writeFileSync(path.join(prompt('b'), 'inside.txt'), 'mine');

    const { summary } = await applyReconcile({
      plan,
      mode: 'refresh',
      record,
      home,
    });
    assert.equal(read(path.join(prompt('b'), 'inside.txt')), 'mine');
    assert.ok(summary.kept.some((k) => k.to === prompt('b')));
    assert.deepEqual(
      fs.readdirSync(path.dirname(prompt('b'))).sort(),
      ['a.prompt', 'b.prompt'],
      'nothing moved aside or left behind'
    );
  });
});

describe('installSurfaces', () => {
  test('records a source without .git as the npm package', async () => {
    const result = await installSurfaces({
      record,
      surfaces: [SURFACE],
      root,
      home,
    });
    assert.deepEqual(result.record.source, { kind: 'npm' });
    assert.equal(read(prompt('a')), 'a v1');
  });

  test('records a source with .git as a clone, by its real path', async () => {
    fs.mkdirSync(path.join(root, '.git'));
    const result = await installSurfaces({
      record,
      surfaces: [SURFACE],
      root,
      home,
    });
    assert.deepEqual(result.record.source, {
      kind: 'clone',
      root: fs.realpathSync(root),
    });
  });
});
