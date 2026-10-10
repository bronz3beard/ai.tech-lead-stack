/**
 * Per-PR guard for the MCP server's stdio contract. The server speaks
 * newline-delimited JSON-RPC on stdout, so any dependency that writes to stdout
 * (dotenv's injection notice did from v17, Prisma, the MCP SDK...) corrupts the
 * stream for every editor. scripts/smoke-npm-package.mjs checks the packed
 * tarball, but only at release time; this runs the bundle `pnpm install`
 * builds (packages/core `prepare`) on every pull request.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
const serverBundle = path.join(repoRoot, 'packages', 'core', 'dist', 'mcp-server.mjs');
const packageVersion = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'packages', 'core', 'package.json'), 'utf8')
).version;
const TIMEOUT_MS = 30_000;

// Set empty rather than deleted: the server loads the repo .env, and dotenv
// never overrides a variable that is already set, so this keeps the test off
// any real database, telemetry backend or model API.
const BLANKED = [
  'DATABASE_URL',
  'DIRECT_URL',
  'ANTHROPIC_API_KEY',
  'CLAUDE_API_KEY',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'JULES_API_KEY',
  'LANGFUSE_PUBLIC_KEY',
  'LANGFUSE_SECRET_KEY',
  'LANGFUSE_HOST',
  'LANGFUSE_BASEURL',
];

/**
 * Starts the built server and returns helpers to talk JSON-RPC to it.
 * `extraEnv` is applied over the blanked environment.
 */
function startServer(t, extraEnv) {
  assert.ok(
    fs.existsSync(serverBundle),
    `${serverBundle} is missing; run pnpm install (it builds the bundle).`
  );

  const env = { ...process.env };
  for (const key of BLANKED) env[key] = '';
  Object.assign(env, extraEnv);
  const child = spawn(process.execPath, [serverBundle], { cwd: repoRoot, env });
  t.after(() => child.kill());

  const stdoutLines = [];
  const waiting = new Map();
  let buffer = '';
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      stdoutLines.push(line);
      try {
        const message = JSON.parse(line);
        waiting.get(message.id)?.(message);
      } catch {
        // Recorded in stdoutLines; asserted below with the offending text.
      }
    }
  });

  let nextId = 1;
  const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(
        () =>
          reject(
            new Error(`No response to ${method}. stderr:\n${stderr.slice(-1500)}`)
          ),
        TIMEOUT_MS
      );
      waiting.set(id, (message) => {
        clearTimeout(timer);
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result);
      });
      send({ jsonrpc: '2.0', id, method, params });
    });

  const initialize = async () => {
    const init = await request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'mcp-stdio-test', version: '1' },
    });
    assert.ok(init.serverInfo?.name, 'initialize returned no serverInfo');
    assert.equal(
      init.serverInfo.version,
      packageVersion,
      'the server advertises the package version'
    );
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  };

  const pollution = () =>
    stdoutLines.filter((line) => {
      if (!line.trim()) return false;
      try {
        return JSON.parse(line).jsonrpc !== '2.0';
      } catch {
        return true;
      }
    });

  return { request, initialize, pollution, stderr: () => stderr };
}

test('the MCP server answers over stdio and writes nothing but JSON-RPC to stdout', async (t) => {
  // This test runs against the real home folder; keep the editor-file
  // refresh out of it (the next test covers the refresh with a scratch home).
  const { request, initialize, pollution } = startServer(t, {
    TLS_AUTO_REFRESH: '0',
  });
  await initialize();

  const { tools } = await request('tools/list', {});
  const names = tools.map((tool) => tool.name);
  for (const expected of ['list_skills', 'get_skills', 'get_skill']) {
    assert.ok(names.includes(expected), `tools/list is missing ${expected}`);
  }

  const listed = await request('tools/call', { name: 'list_skills', arguments: {} });
  assert.notEqual(listed.isError, true, 'list_skills returned an error');
  assert.match(
    listed.content.map((part) => part.text).join('\n'),
    /^- ask /m,
    'list_skills does not include the "ask" skill'
  );

  // Keep reading briefly after the last response, so a dependency that logs
  // shortly after handling a request is caught too.
  await new Promise((resolve) => setTimeout(resolve, 500));

  assert.deepEqual(pollution(), [], 'non-JSON-RPC output reached stdout');
});

test('a refresh due at start updates editor files without disturbing the protocol', async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-stdio-home-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const recordFile = path.join(home, '.tech-lead-stack', 'installed.json');
  fs.mkdirSync(path.dirname(recordFile), { recursive: true });
  // As install.sh would record this clone, before any command was written.
  fs.writeFileSync(
    recordFile,
    JSON.stringify({
      version: '0.0.1',
      files: {},
      source: { kind: 'clone', root: fs.realpathSync(repoRoot) },
      surfaces: [
        {
          id: 'claude-code-commands',
          server: 'tech-lead-stack',
          domains: ['eng', 'pm', 'hr'],
          files: [],
        },
      ],
    })
  );

  const { request, initialize, pollution, stderr } = startServer(t, {
    HOME: home,
  });
  await initialize();
  const { tools } = await request('tools/list', {});
  assert.ok(tools.length > 0, 'tools/list answered while refreshing');

  const deadline = Date.now() + TIMEOUT_MS;
  while (!JSON.parse(fs.readFileSync(recordFile, 'utf8')).lastRefresh) {
    assert.ok(Date.now() < deadline, `no refresh. stderr:\n${stderr().slice(-1500)}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
  assert.equal(record.lastRefresh.error, null);
  assert.ok(
    fs.existsSync(path.join(home, '.claude', 'commands', 'tls', 'ask.md')),
    'the /tls:ask command was written'
  );
  assert.match(stderr(), /\[tls\] refreshed editor files/);
  assert.deepEqual(pollution(), [], 'non-JSON-RPC output reached stdout');
});
