import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderSurface,
  selectSurfaces,
} from '../../packages/core/src/install/surfaces.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
const installDir = path.join(repoRoot, 'packages', 'core', 'src', 'install');
const home = path.join(os.tmpdir(), 'tls-surfaces-home');
const render = (surface, signal) =>
  renderSurface({ surface, root: repoRoot, home, signal });

const eligible = (domains) =>
  JSON.parse(
    fs.readFileSync(path.join(repoRoot, '.ai', 'agent-surfaces.json'), 'utf8')
  ).entries.filter((e) => e.ideEligible && domains.includes(e.domainKey));

describe('renderSurface', () => {
  test('renders one Claude command per eligible skill, under the given home', async () => {
    const files = await render({
      id: 'claude-code-commands',
      server: 'slm-gate',
      domains: ['eng', 'pm', 'hr'],
    });
    const names = files.map((f) => path.basename(f.to)).sort();
    assert.deepEqual(
      names,
      eligible(['eng', 'pm', 'hr'])
        .map((e) => `${e.name}.md`)
        .sort()
    );
    const commandsDir = path.join(home, '.claude', 'commands', 'tls');
    assert.ok(files.every((f) => path.dirname(f.to) === commandsDir));
    const ask = files.find((f) => f.to.endsWith('/ask.md'));
    assert.match(ask.content, /mcp__slm-gate__get_skills/);
  });

  test('respects the recorded domains', async () => {
    const files = await render({
      id: 'claude-code-commands',
      server: 'tech-lead-stack',
      domains: ['eng'],
    });
    assert.equal(files.length, eligible(['eng']).length);
  });

  test('is deterministic: same input, same bytes', async () => {
    for (const id of [
      'claude-code-commands',
      'cursor-skills',
      'continue-prompts',
    ]) {
      const surface = { id, server: 'slm-gate', domains: ['eng', 'pm', 'hr'] };
      const [a, b] = [await render(surface), await render(surface)];
      assert.deepEqual(a, b, id);
    }
  });

  test('copies Cursor skills and Continue prompts byte for byte, re-rooted at home', async () => {
    const cursor = await render({ id: 'cursor-skills' });
    assert.ok(cursor.length > 0);
    assert.ok(
      cursor.every(
        (f) =>
          f.to.startsWith(path.join(home, '.cursor', 'skills') + path.sep) &&
          f.to.endsWith(`${path.sep}SKILL.md`)
      )
    );
    const workflows = fs
      .readdirSync(path.join(repoRoot, '.agents', 'workflows'))
      .filter((f) => f.endsWith('.md'));
    const prompts = await render({ id: 'continue-prompts' });
    assert.equal(prompts.length, workflows.length);
    const ask = prompts.find((f) => f.to.endsWith('/ask.prompt'));
    assert.deepEqual(
      ask.content,
      fs.readFileSync(path.join(repoRoot, '.agents', 'workflows', 'ask.md'))
    );
  });

  test('stops when the signal is aborted', async () => {
    await assert.rejects(
      render({ id: 'continue-prompts' }, AbortSignal.abort()),
      { name: 'AbortError' }
    );
  });

  test('rejects an unknown surface', async () => {
    await assert.rejects(render({ id: 'nope' }), /unknown surface: nope/);
  });
});

describe('selectSurfaces', () => {
  const claude = {
    id: 'claude-code-commands',
    server: 'slm-gate',
    domains: ['eng', 'pm', 'hr'],
    files: ['/x/ask.md'],
  };

  test('keeps a recorded surface whose editor this run did not look at', () => {
    // `init --ide cursor` evaluates Cursor only: the Claude commands stay.
    const selected = selectSurfaces({
      chosen: [{ id: 'cursor-skills' }],
      recorded: [claude],
      evaluatedEditors: ['cursor'],
    });
    assert.deepEqual(selected, [
      { id: 'cursor-skills' },
      {
        id: 'claude-code-commands',
        server: 'slm-gate',
        domains: ['eng', 'pm', 'hr'],
      },
    ]);
  });

  test('drops a recorded surface whose editor was evaluated and not chosen', () => {
    const selected = selectSurfaces({
      chosen: [],
      recorded: [claude],
      evaluatedEditors: ['claude-code'],
    });
    assert.deepEqual(selected, []);
  });

  test('this run’s choice replaces the recorded options', () => {
    const selected = selectSurfaces({
      chosen: [{ id: 'claude-code-commands', server: 'tech-lead-stack' }],
      recorded: [claude],
      evaluatedEditors: [],
    });
    assert.deepEqual(selected, [
      { id: 'claude-code-commands', server: 'tech-lead-stack' },
    ]);
  });
});

describe('the refresh path never blocks the event loop', () => {
  // Everything the MCP server runs at start lives in these files; a *Sync call
  // in any of them would stall the server while it answers requests.
  const files = [
    'ide-commands.mjs',
    'surfaces.mjs',
    'reconcile.mjs',
    'refresh.mjs',
    'lock.mjs',
    'version.mjs',
  ];
  for (const file of files) {
    test(`${file} uses no synchronous fs call`, (t) => {
      const full = path.join(installDir, file);
      if (!fs.existsSync(full)) return t.skip('not written yet');
      assert.doesNotMatch(fs.readFileSync(full, 'utf8'), /\b\w+Sync\(/);
    });
  }
});
