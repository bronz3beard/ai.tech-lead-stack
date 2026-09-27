#!/usr/bin/env node
/**
 * @file smoke-npm-package.mjs
 * @description Proves a packed `tech-lead-stack` tarball works before it is
 * published: installs it into an empty folder, starts the MCP server through
 * `npx` with no database or API keys, and checks it completes the MCP
 * handshake and serves a bundled skill. Exits non-zero on any failure.
 * Usage: node scripts/smoke-npm-package.mjs <path/to/tech-lead-stack-x.y.z.tgz>
 */

import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const TIMEOUT_MS = 30_000;
const EXPECTED_SKILL = 'ask';

/** Minimal newline-delimited JSON-RPC client over the server's stdio. */
function connect(child) {
  const pending = new Map();
  let buffer = '';
  let nextId = 1;
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      pending.get(message.id)?.(message);
    }
  });
  const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(
        () => reject(new Error(`No response to ${method}`)),
        TIMEOUT_MS
      );
      pending.set(id, (message) => {
        clearTimeout(timer);
        if (message.error)
          reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result);
      });
      send({ jsonrpc: '2.0', id, method, params });
    });
  return { request, notify: (method) => send({ jsonrpc: '2.0', method }) };
}

const toolText = (result) => result.content.map((part) => part.text).join('\n');

async function smoke(tarball) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-smoke-'));
  const npm = (...args) =>
    execFileSync('npm', args, {
      cwd: dir,
      stdio: ['ignore', 'ignore', 'inherit'],
    });
  npm('init', '-y');
  npm('install', '--no-audit', '--no-fund', path.resolve(tarball));

  // A clean environment: no database, no model keys, no pointer back to a checkout.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/DATABASE_URL|API_KEY|LANGFUSE|TECH_LEAD_STACK_ROOT|REPO_ROOT/.test(
          key
        )
    )
  );
  const child = spawn('npx', ['--no-install', 'tech-lead-stack'], {
    cwd: dir,
    env,
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  const exited = new Promise((_, reject) =>
    child.on('exit', (code) =>
      reject(
        new Error(`Server exited with code ${code}:\n${stderr.slice(-2000)}`)
      )
    )
  );

  try {
    const { request, notify } = connect(child);
    const run = async () => {
      await request('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'smoke-npm-package', version: '1' },
      });
      notify('notifications/initialized');
      const listed = await request('tools/call', {
        name: 'list_skills',
        arguments: {},
      });
      if (!new RegExp(`^- ${EXPECTED_SKILL} `, 'm').test(toolText(listed))) {
        throw new Error(
          `list_skills does not include the bundled "${EXPECTED_SKILL}" skill.`
        );
      }
      const skill = await request('tools/call', {
        name: 'get_skills',
        arguments: {
          skillName: EXPECTED_SKILL,
          projectName: 'smoke',
          model: 'smoke',
          agent: 'smoke',
        },
      });
      if (
        skill.isError ||
        !toolText(skill).includes(`name: ${EXPECTED_SKILL}`)
      ) {
        throw new Error(
          `get_skills did not return the "${EXPECTED_SKILL}" skill.`
        );
      }
    };
    await Promise.race([run(), exited]);

    // The same command with a subcommand must run it instead of the server.
    const report = JSON.parse(
      execFileSync(
        'npx',
        ['--no-install', 'tech-lead-stack', 'doctor', '--json'],
        {
          cwd: dir,
          env,
          encoding: 'utf8',
        }
      )
    );
    if (!report.checks?.some((check) => check.id === 'node')) {
      throw new Error(
        '`tech-lead-stack doctor --json` did not report its checks.'
      );
    }
    console.log(
      `Smoke test passed: ${path.basename(tarball)} starts, serves bundled skills, and runs doctor.`
    );
  } finally {
    child.removeAllListeners('exit');
    child.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const tarball = process.argv[2];
if (!tarball || !fs.existsSync(tarball)) {
  console.error(
    'Usage: node scripts/smoke-npm-package.mjs <path/to/package.tgz>'
  );
  process.exit(2);
}
smoke(tarball).catch((err) => {
  console.error(`Smoke test failed: ${err.message}`);
  process.exit(1);
});
