import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round-trip tests: install into a scratch HOME, then clean, then assert what
 * survived. This is the only thing that keeps install.sh and cleanup.sh in
 * sync as adapters are added — cleanup had silently fallen four adapters
 * behind before these existed.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const installer = path.join(repoRoot, 'install.sh');
const cleaner = path.join(repoRoot, 'scripts/cleanup.sh');

function scratch(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Recreate the project-side artifacts a full install leaves behind. */
function seedProject(target) {
  fs.symlinkSync(path.join(repoRoot, '.ai'), path.join(target, '.ai'));
  fs.symlinkSync(path.join(repoRoot, '.agents'), path.join(target, '.agents'));
  fs.symlinkSync(path.join(repoRoot, '.ai/agents.md'), path.join(target, 'AGENTS.md'));
  fs.mkdirSync(path.join(target, '.github/workflows'), { recursive: true });
  fs.copyFileSync(
    path.join(repoRoot, 'templates/PULL_REQUEST_TEMPLATE.md'),
    path.join(target, '.github/PULL_REQUEST_TEMPLATE.md')
  );
  fs.copyFileSync(
    path.join(repoRoot, 'docs/github-action-example.yml'),
    path.join(target, '.github/workflows/design-review-trigger.yml')
  );
}

function runClean(target, home, extraArgs = []) {
  return execFileSync('bash', [cleaner, target, ...extraArgs], {
    env: { ...process.env, HOME: home },
    encoding: 'utf8',
  });
}

describe('cleanup.sh safety rails', () => {
  test('refuses to clean a home directory', () => {
    const home = scratch('tls-home-guard-');
    try {
      assert.throws(() =>
        execFileSync('bash', [cleaner, home], {
          env: { ...process.env, HOME: home },
          encoding: 'utf8',
          stdio: 'pipe',
        })
      );
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('refuses to clean the tech-lead-stack repo itself', () => {
    assert.throws(
      () => execFileSync('bash', [cleaner, repoRoot], { encoding: 'utf8', stdio: 'pipe' }),
      /./,
      'cleaning the stack repo would delete its own tracked files'
    );
  });
});

describe('cleanup.sh project scope', () => {
  test('removes every project artifact an install creates', () => {
    const target = scratch('tls-target-');
    const home = scratch('tls-home-');
    try {
      seedProject(target);
      runClean(target, home);
      assert.deepEqual(
        fs.readdirSync(target),
        [],
        'project directory should be empty after unlinking'
      );
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('removes AGENTS.md, which the old cleanup left dangling', () => {
    const target = scratch('tls-target-agents-');
    const home = scratch('tls-home-');
    try {
      seedProject(target);
      runClean(target, home);
      assert.ok(!fs.existsSync(path.join(target, 'AGENTS.md')));
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('keeps a locally modified template instead of destroying it', () => {
    const target = scratch('tls-target-mod-');
    const home = scratch('tls-home-');
    try {
      seedProject(target);
      const template = path.join(target, '.github/PULL_REQUEST_TEMPLATE.md');
      fs.appendFileSync(template, '\n## Team-specific section\n');

      runClean(target, home);

      assert.ok(fs.existsSync(template), 'an edited template must survive');
      assert.match(fs.readFileSync(template, 'utf8'), /Team-specific section/);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('leaves a real directory that is not our symlink', () => {
    const target = scratch('tls-target-real-');
    const home = scratch('tls-home-');
    try {
      fs.mkdirSync(path.join(target, '.ai'));
      fs.writeFileSync(path.join(target, '.ai/mine.md'), 'local content');

      runClean(target, home);

      assert.ok(fs.existsSync(path.join(target, '.ai/mine.md')), 'real .ai must survive');
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('does not touch machine-wide state by default', () => {
    const target = scratch('tls-target-global-');
    const home = scratch('tls-home-global-');
    try {
      execFileSync(
        'bash',
        [installer, '--link', target, '--ide', 'claude-code', '--ide-only'],
        { env: { ...process.env, HOME: home }, encoding: 'utf8' }
      );
      const commandsDir = path.join(home, '.claude/commands/tls');
      const before = fs.readdirSync(commandsDir).length;

      seedProject(target);
      runClean(target, home);

      assert.equal(
        fs.readdirSync(commandsDir).length,
        before,
        'a project-only clean must leave the global install serving other projects'
      );
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});

describe('cleanup.sh --global', () => {
  test('previews without deleting unless --apply is given', () => {
    const target = scratch('tls-target-dry-');
    const home = scratch('tls-home-dry-');
    try {
      execFileSync(
        'bash',
        [installer, '--link', target, '--ide', 'claude-code', '--ide-only'],
        { env: { ...process.env, HOME: home }, encoding: 'utf8' }
      );
      const commandsDir = path.join(home, '.claude/commands/tls');
      const before = fs.readdirSync(commandsDir).length;

      const out = runClean(target, home, ['--global']);

      assert.match(out, /Would remove/);
      assert.equal(fs.readdirSync(commandsDir).length, before, 'dry run deleted files');
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('--apply removes our state and nothing else', () => {
    const target = scratch('tls-target-apply-');
    const home = scratch('tls-home-apply-');
    try {
      execFileSync(
        'bash',
        [installer, '--link', target, '--ide', 'claude-code', '--ide-only'],
        { env: { ...process.env, HOME: home }, encoding: 'utf8' }
      );

      // Seed unrelated state that must survive.
      const configPath = path.join(home, '.claude.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config.mcpServers['someone-elses'] = { command: 'node', args: ['/opt/other.js'] };
      config.oauthAccount = { keepMe: true };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      runClean(target, home, ['--global', '--apply']);

      const after = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      assert.ok(!fs.existsSync(path.join(home, '.claude/commands/tls')), 'commands remain');
      assert.ok(!after.mcpServers['tech-lead-stack'], 'our MCP entry remains');
      assert.ok(after.mcpServers['someone-elses'], 'an unrelated MCP server was destroyed');
      assert.ok(after.oauthAccount?.keepMe, 'account state was destroyed');
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('leaves an unrelated shell rc file untouched', () => {
    const target = scratch('tls-target-rc-');
    const home = scratch('tls-home-rc-');
    try {
      const rc = path.join(home, '.zshrc');
      fs.writeFileSync(rc, 'export EDITOR=vim\nalias ll="ls -la"\n');

      runClean(target, home, ['--global', '--apply']);

      assert.equal(
        fs.readFileSync(rc, 'utf8'),
        'export EDITOR=vim\nalias ll="ls -la"\n',
        'an rc file with no tech-lead-stack alias must be byte-identical afterwards'
      );
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
