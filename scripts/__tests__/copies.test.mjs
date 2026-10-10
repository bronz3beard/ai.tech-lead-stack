import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  copyOwned,
  hashOf,
  loadManifest,
  ownership,
  readManifest,
  removeOwned,
  saveManifest,
  writeManifest,
} from '../../packages/core/src/install/copies.mjs';

let dir;
let manifest;
const source = () => path.join(dir, 'source.md');
const dest = () => path.join(dir, 'skills', 'x', 'SKILL.md');

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-copies-'));
  fs.writeFileSync(source(), 'v1');
  manifest = { version: '1.0.0', files: {} };
});

describe('copyOwned', () => {
  test('writes a new file and records it', () => {
    assert.equal(
      copyOwned({ from: source(), to: dest(), manifest }),
      'written'
    );
    assert.equal(fs.readFileSync(dest(), 'utf8'), 'v1');
    assert.equal(manifest.files[dest()], hashOf('v1'));
  });

  test('refreshes its own unchanged file with the new version', () => {
    copyOwned({ from: source(), to: dest(), manifest });
    fs.writeFileSync(source(), 'v2');
    assert.equal(
      copyOwned({ from: source(), to: dest(), manifest }),
      'written'
    );
    assert.equal(fs.readFileSync(dest(), 'utf8'), 'v2');
  });

  test('keeps a file someone edited', () => {
    copyOwned({ from: source(), to: dest(), manifest });
    fs.writeFileSync(dest(), 'my edits');
    fs.writeFileSync(source(), 'v2');
    assert.equal(copyOwned({ from: source(), to: dest(), manifest }), 'kept');
    assert.equal(fs.readFileSync(dest(), 'utf8'), 'my edits');
  });

  test("never replaces a clone install's symlink", () => {
    fs.mkdirSync(path.dirname(dest()), { recursive: true });
    fs.symlinkSync(source(), dest());
    assert.equal(copyOwned({ from: source(), to: dest(), manifest }), 'kept');
    assert.ok(fs.lstatSync(dest()).isSymbolicLink());
    assert.equal(ownership(dest(), manifest), 'theirs');
  });
});

describe('removeOwned', () => {
  test('previews, then removes only unchanged files and their empty folders', () => {
    copyOwned({ from: source(), to: dest(), manifest });
    const edited = path.join(dir, 'prompts', 'plan.prompt');
    copyOwned({ from: source(), to: edited, manifest });
    fs.writeFileSync(edited, 'my edits');

    const preview = removeOwned({ manifest, apply: false });
    assert.deepEqual(preview, { removed: [dest()], kept: [edited] });
    assert.ok(fs.existsSync(dest()), 'a preview must not delete');

    removeOwned({ manifest, apply: true });
    assert.ok(!fs.existsSync(path.join(dir, 'skills')), 'empty folders remain');
    assert.equal(fs.readFileSync(edited, 'utf8'), 'my edits');
  });
});

describe('the install record', () => {
  const recordFile = () => path.join(dir, 'state', 'installed.json');

  test('reads a record written by init <= 2.1.0 with the new keys unset', () => {
    fs.mkdirSync(path.dirname(recordFile()), { recursive: true });
    fs.writeFileSync(
      recordFile(),
      JSON.stringify({ version: '1.1.0', files: { '/a': 'h' } })
    );
    assert.deepEqual(readManifest(recordFile()), {
      version: '1.1.0',
      files: { '/a': 'h' },
      source: null,
      surfaces: null,
      lastRefresh: null,
    });
  });

  test('reads a missing or corrupt record as empty', () => {
    assert.equal(readManifest(recordFile()).version, null);
    fs.mkdirSync(path.dirname(recordFile()), { recursive: true });
    fs.writeFileSync(recordFile(), '{ not json');
    assert.deepEqual(readManifest(recordFile()).files, {});
  });

  test('writes atomically: no temp file is left and the result parses', async () => {
    const record = {
      version: '2.2.0',
      files: {},
      source: { kind: 'npm' },
      surfaces: [],
      lastRefresh: null,
    };
    writeManifest(record, recordFile());
    assert.deepEqual(readManifest(recordFile()), record);

    await saveManifest({ ...record, version: '2.3.0' }, recordFile());
    assert.equal((await loadManifest(recordFile())).version, '2.3.0');
    assert.deepEqual(fs.readdirSync(path.dirname(recordFile())), [
      'installed.json',
    ]);
  });
});
