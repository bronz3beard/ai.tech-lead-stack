import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Cross-platform installer coverage.
 *
 * This codebase is agent-agnostic by design, but for a while only Claude Code
 * had installer tests. Every adapter here writes to a different file in a
 * different format, so a regression in one was invisible until someone hit it
 * by hand. These tests drive install.sh against a scratch HOME once per
 * platform, plus the cross-cutting invariants that must hold for all of them.
 *
 * Claude Code's own deeper tests live in install-claude-code.test.mjs; it
 * appears here only in the shared invariants.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const installer = path.join(repoRoot, 'install.sh');

const isMac = process.platform === 'darwin';
const vscodeBase = isMac ? 'Library/Application Support' : '.config';
const clineRelative = path.join(
  vscodeBase,
  'Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'
);
const claudeDesktopRelative = isMac
  ? 'Library/Application Support/Claude/claude_desktop_config.json'
  : '.config/Claude/claude_desktop_config.json';

function scratch(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function install(home, target, args = []) {
  return execFileSync('bash', [installer, '--link', target, '--ide-only', ...args], {
    env: { ...process.env, HOME: home },
    encoding: 'utf8',
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Assert an mcpServers map holds exactly one entry pointing at this checkout. */
function assertRegistered(file, serverName = 'tech-lead-stack') {
  assert.ok(fs.existsSync(file), `expected ${file} to exist`);
  const config = readJson(file);
  const server = config.mcpServers?.[serverName];
  assert.ok(server, `expected an mcpServers entry named ${serverName}`);
  assert.ok(
    JSON.stringify(server).includes(repoRoot),
    'the registration must carry the real repo path, not an unexpanded variable'
  );
  assert.ok(
    !JSON.stringify(server).includes('$SOURCE_DIR'),
    'SOURCE_DIR must be expanded'
  );
}

/**
 * Each platform: how to prepare a scratch HOME so the adapter has something to
 * write into, and where to look afterwards. Adding an adapter means adding a
 * row here, which is what keeps this suite honest as the installer grows.
 */
const PLATFORMS = [
  {
    ide: 'cursor',
    label: 'Cursor',
    prepare: () => {},
    configFile: '.cursor/mcp.json',
    // Cursor also symlinks skills; asserted separately.
  },
  {
    ide: 'cline',
    label: 'Cline',
    // Cline is only configured when its VS Code extension directory exists.
    prepare: (home) =>
      fs.mkdirSync(path.dirname(path.join(home, clineRelative)), { recursive: true }),
    configFile: clineRelative,
  },
  {
    ide: 'gemini',
    label: 'Gemini CLI/Desktop',
    prepare: (home) => {
      fs.mkdirSync(path.join(home, '.gemini'), { recursive: true });
      fs.writeFileSync(
        path.join(home, '.gemini/settings.json'),
        JSON.stringify({ security: { auth: { selectedType: 'oauth-personal' } } })
      );
    },
    configFile: '.gemini/settings.json',
  },
];

describe('IDE adapters: MCP registration', () => {
  for (const platform of PLATFORMS) {
    test(`${platform.label} registers the MCP server`, () => {
      const home = scratch(`tls-${platform.ide}-`);
      const target = scratch('tls-target-');
      try {
        platform.prepare(home);
        install(home, target, ['--ide', platform.ide]);
        assertRegistered(path.join(home, platform.configFile));
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
        fs.rmSync(target, { recursive: true, force: true });
      }
    });

    test(`${platform.label} honours --mcp-name`, () => {
      const home = scratch(`tls-${platform.ide}-name-`);
      const target = scratch('tls-target-');
      try {
        platform.prepare(home);
        install(home, target, ['--ide', platform.ide, '--mcp-name', 'slm-gate']);

        const config = readJson(path.join(home, platform.configFile));
        assert.ok(config.mcpServers['slm-gate'], 'custom server name was ignored');
        assert.ok(
          !config.mcpServers['tech-lead-stack'],
          'the default name must not be registered as well'
        );
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
        fs.rmSync(target, { recursive: true, force: true });
      }
    });

    test(`${platform.label} is idempotent`, () => {
      const home = scratch(`tls-${platform.ide}-idem-`);
      const target = scratch('tls-target-');
      try {
        platform.prepare(home);
        install(home, target, ['--ide', platform.ide]);
        const first = fs.readFileSync(path.join(home, platform.configFile), 'utf8');

        install(home, target, ['--ide', platform.ide]);
        const second = fs.readFileSync(path.join(home, platform.configFile), 'utf8');

        assert.equal(first, second, 're-running changed the config');
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
        fs.rmSync(target, { recursive: true, force: true });
      }
    });

    test(`${platform.label} writes nothing into the project`, () => {
      const home = scratch(`tls-${platform.ide}-proj-`);
      const target = scratch('tls-target-');
      try {
        platform.prepare(home);
        install(home, target, ['--ide', platform.ide]);
        assert.deepEqual(fs.readdirSync(target), [], 'project directory was modified');
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
        fs.rmSync(target, { recursive: true, force: true });
      }
    });
  }
});

describe('Gemini adapter', () => {
  test('preserves an existing auth block', () => {
    const home = scratch('tls-gemini-auth-');
    const target = scratch('tls-target-');
    try {
      fs.mkdirSync(path.join(home, '.gemini'), { recursive: true });
      fs.writeFileSync(
        path.join(home, '.gemini/settings.json'),
        JSON.stringify({ security: { auth: { selectedType: 'oauth-personal' } } })
      );

      install(home, target, ['--ide', 'gemini']);

      const config = readJson(path.join(home, '.gemini/settings.json'));
      assert.equal(
        config.security?.auth?.selectedType,
        'oauth-personal',
        'the user auth block must survive the merge'
      );
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
});

describe('Cursor adapter', () => {
  test('symlinks skills into the user skills directory', () => {
    const home = scratch('tls-cursor-skills-');
    const target = scratch('tls-target-');
    try {
      install(home, target, ['--ide', 'cursor']);

      const skillsDir = path.join(home, '.cursor/skills');
      const entries = fs.readdirSync(skillsDir);
      assert.ok(entries.length > 0, 'no skills were linked');

      const sample = path.join(skillsDir, entries[0], 'SKILL.md');
      assert.ok(fs.lstatSync(sample).isSymbolicLink(), 'skills must be symlinks');
      assert.ok(
        fs.readlinkSync(sample).startsWith(repoRoot),
        'the symlink must point into this checkout'
      );
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
});

describe('Continue adapter', () => {
  test('registers the MCP server and links prompts', () => {
    const home = scratch('tls-continue-');
    const target = scratch('tls-target-');
    try {
      install(home, target, ['--ide', 'continue']);

      const config = fs.readFileSync(path.join(home, '.continue/config.yaml'), 'utf8');
      assert.match(config, /mcpServers:/);
      assert.match(config, /tech-lead-stack:/);
      assert.ok(config.includes(repoRoot), 'config must carry the real repo path');

      const prompts = fs.readdirSync(path.join(home, '.continue/prompts'));
      assert.ok(prompts.length > 0, 'no prompts were linked');
      assert.ok(
        prompts.every((f) => f.endsWith('.prompt')),
        'Continue prompts must use the .prompt extension'
      );
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
});

describe('Claude Desktop adapter', () => {
  test('configures an existing Claude Desktop config', () => {
    const home = scratch('tls-desktop-');
    const target = scratch('tls-target-');
    try {
      const configFile = path.join(home, claudeDesktopRelative);
      fs.mkdirSync(path.dirname(configFile), { recursive: true });
      fs.writeFileSync(configFile, JSON.stringify({ mcpServers: {} }));

      // Claude Desktop is auto-detected rather than flag-driven.
      install(home, target, ['--ide', 'none']);

      assertRegistered(configFile);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });

  test('does not create a config for an uninstalled Claude Desktop', () => {
    const home = scratch('tls-desktop-absent-');
    const target = scratch('tls-target-');
    try {
      install(home, target, ['--ide', 'none']);
      assert.ok(
        !fs.existsSync(path.join(home, claudeDesktopRelative)),
        'must not fabricate a config for an app that is not installed'
      );
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
});

describe('cross-adapter invariants', () => {
  test('--ide none writes nothing at all', () => {
    const home = scratch('tls-none-');
    const target = scratch('tls-target-');
    try {
      install(home, target, ['--ide', 'none']);
      assert.deepEqual(fs.readdirSync(home), [], 'HOME was modified');
      assert.deepEqual(fs.readdirSync(target), [], 'project was modified');
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });

  test('each --ide value configures only its own platform', () => {
    // The detectors share a `case` shape where a missing default branch made
    // every one of them return true for unrelated --ide values.
    const footprints = {
      cursor: ['.cursor'],
      continue: ['.continue'],
      'claude-code': ['.claude', '.claude.json'],
    };

    for (const [ide, owned] of Object.entries(footprints)) {
      const home = scratch(`tls-iso-${ide.replace(/\W/g, '')}-`);
      const target = scratch('tls-target-');
      try {
        install(home, target, ['--ide', ide]);

        const foreign = Object.entries(footprints)
          .filter(([other]) => other !== ide)
          .flatMap(([, paths]) => paths)
          .filter((p) => !owned.includes(p))
          .filter((p) => fs.existsSync(path.join(home, p)));

        assert.deepEqual(
          foreign,
          [],
          `--ide ${ide} also configured: ${foreign.join(', ')}`
        );
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  test('rejects an unknown --ide value', () => {
    const home = scratch('tls-bad-ide-');
    const target = scratch('tls-target-');
    try {
      assert.throws(() => install(home, target, ['--ide', 'notepad']), /./);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });

  test('every documented --ide value is accepted', () => {
    const home = scratch('tls-all-ide-');
    const target = scratch('tls-target-');
    try {
      for (const ide of ['auto', 'cursor', 'continue', 'claude-code', 'cline', 'gemini', 'none']) {
        assert.doesNotThrow(
          () => install(home, target, ['--ide', ide]),
          `--ide ${ide} is documented but was rejected`
        );
      }
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });

  test('prints a report naming what it configured', () => {
    const home = scratch('tls-report-');
    const target = scratch('tls-target-');
    try {
      fs.mkdirSync(path.join(home, '.gemini'), { recursive: true });
      fs.writeFileSync(path.join(home, '.gemini/settings.json'), '{}');

      const out = install(home, target, ['--ide', 'gemini']);

      assert.match(out, /INSTALL REPORT/);
      assert.match(out, /Configured:/);
      assert.match(out, /Gemini/);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
});
