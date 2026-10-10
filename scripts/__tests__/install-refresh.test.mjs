import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  hashOf,
  loadManifest,
  saveManifest,
} from '../../packages/core/src/install/copies.mjs';
import { installSurfaces } from '../../packages/core/src/install/reconcile.mjs';
import {
  adoptLegacy,
  refreshInstalledSurfaces,
} from '../../packages/core/src/install/refresh.mjs';

// Fixture: the Continue surface copies <root>/.agents/workflows/*.md to
// <home>/.continue/prompts/*.prompt. The root has no .git, so it is "npm".
let root;
let home;
let recordFile;
let lockFile;
let logged;

const workflow = (name) =>
  path.join(root, '.agents', 'workflows', `${name}.md`);
const prompt = (name) =>
  path.join(home, '.continue', 'prompts', `${name}.prompt`);

async function installAt(version) {
  const empty = await loadManifest(recordFile);
  const { record } = await installSurfaces({
    record: empty,
    surfaces: [{ id: 'continue-prompts' }],
    root,
    home,
  });
  await saveManifest({ ...record, version }, recordFile);
}

const refresh = (extra = {}) =>
  refreshInstalledSurfaces({
    root,
    version: '2.2.0',
    env: {},
    home,
    recordFile,
    lockFile,
    log: (line) => logged.push(line),
    ...extra,
  });

beforeEach(async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-refresh-'));
  root = path.join(base, 'pkg');
  home = path.join(base, 'home');
  recordFile = path.join(home, '.tech-lead-stack', 'installed.json');
  lockFile = path.join(home, '.tech-lead-stack', 'refresh.lock');
  logged = [];
  fs.mkdirSync(path.dirname(workflow('a')), { recursive: true });
  fs.writeFileSync(workflow('a'), 'a v1');
  await installAt('2.1.0');
  fs.writeFileSync(workflow('show-it'), 'new skill'); // released in 2.2.0
});

describe('refreshInstalledSurfaces', () => {
  test('brings recorded outputs up to the running release', async () => {
    const result = await refresh();
    assert.equal(result.status, 'refreshed');
    assert.equal(fs.readFileSync(prompt('show-it'), 'utf8'), 'new skill');
    const record = await loadManifest(recordFile);
    assert.equal(record.version, '2.2.0');
    assert.equal(record.lastRefresh.by, '2.2.0');
    assert.equal(record.lastRefresh.error, null);
    assert.match(
      logged.join('\n'),
      /refreshed editor files to 2\.2\.0: 1 written/
    );
    assert.ok(!fs.existsSync(lockFile), 'lock released');
  });

  test('does nothing and writes nothing when already up to date', async () => {
    await refresh();
    const before = fs.statSync(recordFile).mtimeMs;
    logged = [];
    assert.equal((await refresh()).status, 'up-to-date');
    assert.equal(fs.statSync(recordFile).mtimeMs, before);
    assert.deepEqual(logged, []);
  });

  test('is turned off by TLS_AUTO_REFRESH=0', async () => {
    const result = await refresh({ env: { TLS_AUTO_REFRESH: '0' } });
    assert.equal(result.status, 'disabled');
    assert.ok(!fs.existsSync(prompt('show-it')));
  });

  test('does nothing without a record of surfaces (e.g. a remote server)', async () => {
    fs.rmSync(recordFile);
    assert.equal((await refresh()).status, 'no-record');
    assert.ok(!fs.existsSync(prompt('show-it')));
  });

  test('a clone never refreshes an npm install, and vice versa', async () => {
    fs.mkdirSync(path.join(root, '.git')); // now this server runs from a clone
    assert.equal((await refresh()).status, 'source-mismatch');
    fs.rmSync(path.join(root, '.git'), { recursive: true });

    const record = await loadManifest(recordFile);
    await saveManifest(
      { ...record, source: { kind: 'clone', root: '/somewhere/else' } },
      recordFile
    );
    assert.equal((await refresh()).status, 'source-mismatch');
    assert.ok(!fs.existsSync(prompt('show-it')));
  });

  test('an older npm server never rolls outputs back', async () => {
    assert.equal((await refresh({ version: '2.0.9' })).status, 'older-version');
    assert.ok(!fs.existsSync(prompt('show-it')));
  });

  test('skips while another session holds the lock, and takes over a dead one', async () => {
    fs.writeFileSync(
      lockFile,
      JSON.stringify({ pid: process.ppid, token: 'x' })
    );
    assert.equal((await refresh()).status, 'busy');

    const dead = spawnSync(process.execPath, ['-e', '0']).pid;
    fs.writeFileSync(lockFile, JSON.stringify({ pid: dead, token: 'x' }));
    assert.equal((await refresh()).status, 'refreshed');
  });

  test('a failure mid-apply keeps the old version, records the error and releases the lock', async () => {
    // A file where the prompts folder's new file must go makes that write fail.
    fs.rmSync(prompt('a'));
    fs.mkdirSync(path.dirname(prompt('a')), { recursive: true });
    fs.writeFileSync(workflow('a'), 'a v2');
    fs.writeFileSync(path.join(path.dirname(prompt('a')), 'blocker'), '');
    fs.writeFileSync(workflow('show-it'), 'new skill');
    fs.rmSync(path.dirname(prompt('show-it')), { recursive: true });
    fs.writeFileSync(path.dirname(prompt('show-it')), 'not a folder');

    const result = await refresh();
    assert.equal(result.status, 'failed');
    const record = await loadManifest(recordFile);
    assert.equal(record.version, '2.1.0', 'version not advanced');
    assert.ok(record.lastRefresh.error);
    assert.ok(!fs.existsSync(lockFile), 'lock released');
  });

  test('stops when its signal aborts, without throwing, and records why', async () => {
    // The real budget is AbortSignal.timeout(); an aborted signal stands in
    // for it deterministically (the fixture is too small to outlast 0 ms).
    const result = await refresh({ signal: AbortSignal.abort() });
    assert.equal(result.status, 'failed');
    const record = await loadManifest(recordFile);
    assert.match(record.lastRefresh.error, /planning|stopped/);
    assert.equal(record.version, '2.1.0');
  });

  test('never writes to stdout', async () => {
    const original = process.stdout.write;
    const written = [];
    process.stdout.write = (chunk, ...rest) => {
      written.push(String(chunk));
      return original.call(process.stdout, chunk, ...rest);
    };
    try {
      await refreshInstalledSurfaces({
        root,
        version: '2.2.0',
        env: {},
        home,
        recordFile,
        lockFile,
      });
    } finally {
      process.stdout.write = original;
    }
    assert.ok(
      !written.some((w) => w.includes('[tls]')),
      `stdout got: ${written.join('')}`
    );
  });

  test('a log callback that throws never escapes as a rejection', async () => {
    const result = await refresh({
      log: () => {
        throw new Error('stderr closed');
      },
    });
    assert.equal(result.status, 'refreshed');
  });
});

// Legacy fixture: what `init` 1.1.0–2.1.0 left behind — commands in
// ~/.claude/commands/tls recorded by hash, no `surfaces`, no `source`.
describe('adopting an install made by init <= 2.1.0', () => {
  let commands;
  const entry = (name, domainKey) => ({
    name,
    skill: name,
    ideEligible: true,
    domainKey,
    description: name,
  });

  async function legacyInstall({ names, server = 'slm-gate' }) {
    fs.writeFileSync(
      path.join(root, '.ai', 'agent-surfaces.json'),
      JSON.stringify({
        entries: [
          entry('ask', 'eng'),
          entry('pm-plan', 'pm'),
          entry('hr-brief', 'hr'),
          entry('show-it', 'eng'),
        ],
      })
    );
    const files = {};
    for (const name of names) {
      const file = path.join(commands, `${name}.md`);
      const body = `old ${name}: call \`mcp__${
        typeof server === 'function' ? server(name) : server
      }__get_skill\``;
      fs.writeFileSync(file, body);
      files[file] = hashOf(body);
    }
    await saveManifest({ version: '1.1.0', files }, recordFile);
  }

  beforeEach(() => {
    fs.rmSync(recordFile, { force: true });
    fs.mkdirSync(path.join(root, '.ai'), { recursive: true });
    commands = path.join(home, '.claude', 'commands', 'tls');
    fs.mkdirSync(commands, { recursive: true });
  });

  test('takes it over with the server named in its commands and adds new skills', async () => {
    await legacyInstall({ names: ['ask', 'pm-plan', 'hr-brief'] });
    const result = await refresh();
    assert.equal(result.status, 'refreshed');
    const showIt = fs.readFileSync(path.join(commands, 'show-it.md'), 'utf8');
    assert.match(showIt, /mcp__slm-gate__get_skill/);
    const record = await loadManifest(recordFile);
    assert.deepEqual(record.source, { kind: 'npm' });
    assert.equal(record.surfaces[0].server, 'slm-gate');
    assert.deepEqual(record.surfaces[0].domains, ['eng', 'pm', 'hr']);
    assert.match(logged.join('\n'), /took over the install made by 1\.1\.0/);
  });

  for (const [name, setup, reason] of [
    [
      'no server named',
      { names: ['ask', 'pm-plan', 'hr-brief'], server: () => '' },
      /no server/,
    ],
    [
      'two different servers',
      {
        names: ['ask', 'pm-plan', 'hr-brief'],
        server: (n) => (n === 'ask' ? 'a' : 'b'),
      },
      /2 different servers/,
    ],
    ['no pm/hr commands', { names: ['ask'] }, /every domain/],
  ]) {
    test(`is left alone when unsure: ${name}`, async () => {
      await legacyInstall(setup);
      const before = fs.readdirSync(commands).sort();
      const result = await refresh();
      assert.equal(result.status, 'not-adoptable');
      assert.match(result.reason, reason);
      assert.deepEqual(
        fs.readdirSync(commands).sort(),
        before,
        'nothing written'
      );
      assert.equal((await loadManifest(recordFile)).surfaces, null);
    });
  }

  test('adoptLegacy reads only: it reports surfaces without writing', async () => {
    await legacyInstall({ names: ['ask', 'pm-plan', 'hr-brief'] });
    const record = await loadManifest(recordFile);
    const before = fs.statSync(recordFile).mtimeMs;
    const { surfaces } = await adoptLegacy({ record, home });
    assert.equal(surfaces[0].id, 'claude-code-commands');
    assert.equal(surfaces[0].files.length, 3);
    assert.equal(fs.statSync(recordFile).mtimeMs, before);
  });
});
