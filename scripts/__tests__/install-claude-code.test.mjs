import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Exercises install.sh --ide claude-code against a scratch HOME.
 *
 * Everything the Claude Code adapter writes is global (~/.claude/...), so the
 * only way to test it safely is to move HOME. --ide-only keeps the run cheap:
 * no dependency installs, no gh auth wait, no writes inside the target project.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const installer = path.join(repoRoot, 'install.sh');

let scratchHome;
let targetDir;

function runInstaller(extraArgs = [], env = {}) {
  return execFileSync(
    'bash',
    [installer, '--link', targetDir, '--ide', 'claude-code', '--ide-only', ...extraArgs],
    { env: { ...process.env, HOME: scratchHome, ...env }, encoding: 'utf8' },
  );
}

const commandsDir = () => path.join(scratchHome, '.claude/commands/tls');
const listCommands = () =>
  fs.readdirSync(commandsDir()).filter((f) => f.endsWith('.md'));

describe('install.sh --ide claude-code', () => {
  before(() => {
    scratchHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-home-'));
    targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-target-'));
    runInstaller();
  });

  after(() => {
    fs.rmSync(scratchHome, { recursive: true, force: true });
    fs.rmSync(targetDir, { recursive: true, force: true });
  });

  test('generates slash commands under the tls namespace', () => {
    const commands = listCommands();
    assert.ok(commands.length > 0, 'expected at least one generated command');
    assert.ok(commands.includes('ask.md'));
  });

  test('writes nothing into the target project', () => {
    const entries = fs.readdirSync(targetDir);
    assert.deepEqual(entries, [], `target dir was modified: ${entries.join(', ')}`);
  });

  test('registers the MCP server with an expanded source path', () => {
    const config = JSON.parse(
      fs.readFileSync(path.join(scratchHome, '.claude.json'), 'utf8'),
    );
    const server = config.mcpServers['tech-lead-stack'];
    assert.ok(server, 'expected a tech-lead-stack MCP server entry');
    assert.ok(
      server.args.includes(repoRoot),
      `expected the real repo path in args, got: ${JSON.stringify(server.args)}`,
    );
    assert.ok(
      !server.args.some((a) => a.includes('$SOURCE_DIR')),
      'SOURCE_DIR must be expanded, not passed literally',
    );
  });

  test('gives every command parseable frontmatter and an $ARGUMENTS slot', () => {
    for (const file of listCommands()) {
      const body = fs.readFileSync(path.join(commandsDir(), file), 'utf8');
      assert.ok(body.startsWith('---\n'), `${file} has no frontmatter`);

      const end = body.indexOf('\n---\n', 3);
      assert.ok(end > 0, `${file} has an unterminated frontmatter block`);

      const frontmatter = body.slice(4, end);
      assert.match(frontmatter, /^description: ".+"$/m, `${file} description is unquoted or empty`);
      assert.ok(body.includes('$ARGUMENTS'), `${file} is missing $ARGUMENTS`);
    }
  });

  test('resolves tool names instead of leaving the client-prefix hedge', () => {
    for (const file of listCommands()) {
      const body = fs.readFileSync(path.join(commandsDir(), file), 'utf8');
      assert.ok(
        !body.includes('depending on client prefixing'),
        `${file} still carries the unresolved prefix hedge`,
      );
    }
  });

  test('preserves workflow instructions rather than replacing them with a stub', () => {
    // ask.md is workflow-backed and carries a distinctive read-only directive.
    const body = fs.readFileSync(path.join(commandsDir(), 'ask.md'), 'utf8');
    assert.ok(
      body.includes('READ-ONLY ADVISORY ORACLE'),
      'expected the workflow body to be carried through verbatim',
    );
    assert.ok(body.includes('mcp__tech-lead-stack__get_skill'));
  });

  test('is idempotent across repeated runs', () => {
    const before = listCommands();
    const config = fs.readFileSync(path.join(scratchHome, '.claude.json'), 'utf8');

    runInstaller();

    assert.deepEqual(listCommands(), before, 'command set changed on re-run');
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(scratchHome, '.claude.json'), 'utf8'))
        .mcpServers['tech-lead-stack'].args.join(' '),
      JSON.parse(config).mcpServers['tech-lead-stack'].args.join(' '),
      'MCP registration changed on re-run',
    );
  });

  test('--domains narrows the generated set', () => {
    const engHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-home-eng-'));
    try {
      execFileSync(
        'bash',
        [installer, '--link', targetDir, '--ide', 'claude-code', '--ide-only', '--domains', 'eng'],
        { env: { ...process.env, HOME: engHome }, encoding: 'utf8' },
      );
      const engOnly = fs
        .readdirSync(path.join(engHome, '.claude/commands/tls'))
        .filter((f) => f.endsWith('.md'));

      assert.ok(engOnly.length > 0);
      assert.ok(engOnly.length < listCommands().length, 'eng-only set should be smaller');
      assert.equal(
        engOnly.filter((f) => f.startsWith('pm-') || f.startsWith('hr-')).length,
        0,
        'eng-only set must not contain pm or hr commands',
      );
    } finally {
      fs.rmSync(engHome, { recursive: true, force: true });
    }
  });

  test('--mcp-name changes both the registration and the generated tool calls', () => {
    const altHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-home-alt-'));
    try {
      execFileSync(
        'bash',
        [installer, '--link', targetDir, '--ide', 'claude-code', '--ide-only', '--mcp-name', 'slm-gate'],
        { env: { ...process.env, HOME: altHome }, encoding: 'utf8' },
      );

      const config = JSON.parse(fs.readFileSync(path.join(altHome, '.claude.json'), 'utf8'));
      assert.ok(config.mcpServers['slm-gate'], 'expected registration under the custom name');

      const body = fs.readFileSync(path.join(altHome, '.claude/commands/tls/ask.md'), 'utf8');
      assert.ok(body.includes('mcp__slm-gate__get_skill'));
      assert.ok(!body.includes('mcp__tech-lead-stack__get_skill'));
    } finally {
      fs.rmSync(altHome, { recursive: true, force: true });
    }
  });

  test('--ide cursor does not configure Claude Code or Continue', () => {
    const cursorHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-home-cursor-'));
    try {
      execFileSync(
        'bash',
        [installer, '--link', targetDir, '--ide', 'cursor', '--ide-only'],
        { env: { ...process.env, HOME: cursorHome }, encoding: 'utf8' },
      );
      assert.ok(
        !fs.existsSync(path.join(cursorHome, '.claude')),
        '--ide cursor must not write Claude Code config',
      );
      assert.ok(
        !fs.existsSync(path.join(cursorHome, '.continue')),
        '--ide cursor must not write Continue config',
      );
    } finally {
      fs.rmSync(cursorHome, { recursive: true, force: true });
    }
  });

  test('--ide none writes nothing at all', () => {
    const noneHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-home-none-'));
    try {
      execFileSync(
        'bash',
        [installer, '--link', targetDir, '--ide', 'none', '--ide-only'],
        { env: { ...process.env, HOME: noneHome }, encoding: 'utf8' },
      );
      assert.deepEqual(fs.readdirSync(noneHome), []);
    } finally {
      fs.rmSync(noneHome, { recursive: true, force: true });
    }
  });

  test('does not duplicate a gate that already reaches this repo via env', () => {
    // A gate such as slm-gate points at the stack through DOWNSTREAM_MCP in its
    // env rather than in args. Registering a second server would duplicate
    // every tool, so detection scans the whole server object, not just .args.
    const gateHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-home-gate-'));
    try {
      fs.writeFileSync(
        path.join(gateHome, '.claude.json'),
        JSON.stringify({
          mcpServers: {
            'slm-gate': {
              command: 'node',
              args: ['/elsewhere/index.js'],
              env: {
                DOWNSTREAM_MCP: JSON.stringify({
                  command: 'node',
                  args: [`${repoRoot}/dist/mcp-server.mjs`],
                }),
              },
            },
          },
        }),
      );

      execFileSync(
        'bash',
        [installer, '--link', targetDir, '--ide', 'claude-code', '--ide-only'],
        { env: { ...process.env, HOME: gateHome }, encoding: 'utf8' },
      );

      const config = JSON.parse(
        fs.readFileSync(path.join(gateHome, '.claude.json'), 'utf8'),
      );
      assert.deepEqual(
        Object.keys(config.mcpServers),
        ['slm-gate'],
        'must not register a second server alongside an existing gate',
      );
    } finally {
      fs.rmSync(gateHome, { recursive: true, force: true });
    }
  });

  test('still registers when an unrelated MCP server is present', () => {
    const otherHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-home-other-'));
    try {
      fs.writeFileSync(
        path.join(otherHome, '.claude.json'),
        JSON.stringify({
          mcpServers: { 'something-else': { command: 'node', args: ['/opt/other.js'] } },
        }),
      );

      execFileSync(
        'bash',
        [installer, '--link', targetDir, '--ide', 'claude-code', '--ide-only'],
        { env: { ...process.env, HOME: otherHome }, encoding: 'utf8' },
      );

      const config = JSON.parse(
        fs.readFileSync(path.join(otherHome, '.claude.json'), 'utf8'),
      );
      assert.ok(config.mcpServers['something-else'], 'existing server was dropped');
      assert.ok(config.mcpServers['tech-lead-stack'], 'new server was not added');
    } finally {
      fs.rmSync(otherHome, { recursive: true, force: true });
    }
  });

  test('rejects an unknown domain', () => {
    assert.throws(
      () =>
        execFileSync(
          'bash',
          [installer, '--link', targetDir, '--ide', 'claude-code', '--ide-only', '--domains', 'marketing'],
          { env: { ...process.env, HOME: scratchHome }, encoding: 'utf8', stdio: 'pipe' },
        ),
      /./,
      'expected a non-zero exit for an unknown domain',
    );
  });
});
