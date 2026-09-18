#!/usr/bin/env node
/**
 * @file resolve-critic.mjs
 * @description Resolves the cross-vendor critic for subscription-tier loops
 * (reflexion-loop-sub-*, dev-team-sub-*). Single source of truth for the CLI
 * rungs of the Critic Resolution Ladder:
 *   1. enterprise-gemini — standalone `gemini` CLI. Since 2026-06-18 it only
 *      serves enterprise Gemini Code Assist, which needs GOOGLE_CLOUD_PROJECT.
 *   2. agy — Antigravity CLI, the consumer replacement.
 *   3. harness — no CLI critic; the agent picks another harness model, else the
 *      same model with a STRONG criticAdvisory (see reflexion-loop-sub-max).
 * Prints the resolution as JSON on stdout. Usage:
 *   node scripts/resolve-critic.mjs --writer <anthropic|google|openai>
 */

import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';

const WRITER_VENDORS = ['anthropic', 'google', 'openai'];
const SMOKE_PROMPT = 'Reply with exactly: OK';
// A measured `agy -p` smoke call took ~28 s; shorter timeouts cause false skips.
const SMOKE_TIMEOUT_MS = 45_000;

export function vendorOf(modelId) {
  if (/^gemini/.test(modelId)) return 'google';
  if (/^claude/.test(modelId)) return 'anthropic';
  if (/^gpt/.test(modelId)) return 'openai';
  return 'unknown';
}

/** Picks a critic model from `agy models` output (`id<TAB>label` lines). */
export function pickAgyModel({ modelList, writerVendor }) {
  const candidates = modelList
    .split('\n')
    .map((line) => line.split('\t')[0].trim())
    .filter((id) => /^[\w.-]+$/.test(id))
    .filter((id) => !['unknown', writerVendor].includes(vendorOf(id)));
  return candidates.find((id) => id.includes('pro')) ?? candidates[0] ?? null;
}

function enterpriseGeminiSkipReason({ env, probe, writerVendor }) {
  if (writerVendor === 'google') return 'same-vendor-as-writer';
  if (!probe.which('gemini')) return 'not-installed';
  if (!env.GOOGLE_CLOUD_PROJECT) {
    return 'no-GOOGLE_CLOUD_PROJECT: personal Google accounts are unsupported by the gemini CLI since 2026-06-18 (enterprise Code Assist only)';
  }
  const version = probe.run('gemini', ['--version']);
  if (!version.ok) return `cannot-start: ${version.detail}`;
  const smoke = probe.run('gemini', ['-p', SMOKE_PROMPT]);
  if (!smoke.ok) return `smoke-failed: ${smoke.detail}`;
  return null;
}

/** Pure ladder walk; `probe` is injected so tests need no network or binaries. */
export function resolveCritic({ env, probe, writerVendor }) {
  const skipped = [];

  const geminiSkip = enterpriseGeminiSkipReason({ env, probe, writerVendor });
  if (!geminiSkip) {
    return {
      rung: 'enterprise-gemini',
      command: ['gemini', '-p'],
      model: null,
      isolation: 'L0',
      skipped,
    };
  }
  skipped.push({ rung: 'enterprise-gemini', reason: geminiSkip });

  if (!probe.which('agy')) {
    skipped.push({ rung: 'agy', reason: 'not-installed' });
    return {
      rung: 'harness',
      command: null,
      model: null,
      isolation: null,
      skipped,
    };
  }
  const model =
    env.TLS_CRITIC_MODEL ||
    pickAgyModel({
      modelList: probe.run('agy', ['models']).stdout,
      writerVendor,
    });
  const smoke =
    model && probe.run('agy', ['-p', SMOKE_PROMPT, '--model', model]);
  if (!model || !smoke.ok) {
    const reason = model
      ? `smoke-failed: ${smoke.detail}`
      : 'no-cross-vendor-model';
    skipped.push({ rung: 'agy', reason });
    return {
      rung: 'harness',
      command: null,
      model: null,
      isolation: null,
      skipped,
    };
  }
  const isolation = vendorOf(model) === writerVendor ? 'L1' : 'L0';
  const command = ['agy', '-p', '--model', model, '--mode', 'plan'];
  return { rung: 'agy', command, model, isolation, skipped };
}

const firstLine = (text) => String(text).trim().split('\n')[0];

const systemProbe = {
  which: (bin) => spawnSync('which', [bin], { encoding: 'utf-8' }).status === 0,
  run: (bin, args) => {
    const r = spawnSync(bin, args, {
      encoding: 'utf-8',
      timeout: SMOKE_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const ok = !r.error && r.status === 0;
    return {
      ok,
      stdout: r.stdout ?? '',
      detail: firstLine(r.error?.message || r.stderr || `exit ${r.status}`),
    };
  },
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const writerVendor = process.argv[process.argv.indexOf('--writer') + 1];
  if (
    !process.argv.includes('--writer') ||
    !WRITER_VENDORS.includes(writerVendor)
  ) {
    process.stderr.write(
      `Usage: resolve-critic.mjs --writer <${WRITER_VENDORS.join('|')}>\n`
    );
    process.exit(2);
  }
  const result = resolveCritic({
    env: process.env,
    probe: systemProbe,
    writerVendor,
  });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
