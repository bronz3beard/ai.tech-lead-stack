#!/usr/bin/env node
/**
 * @file resolve-critic.mjs
 * @description Resolves the cross-vendor critic for subscription-tier loops
 * (reflexion-loop-sub-*, dev-team-sub-*). Single source of truth for the
 * Critic Resolution Ladder. Every CLI rung works on a subscription login or a
 * pay-as-you-go API key, and is smoke-tested before it is chosen:
 *   1. gemini-cli — standalone `gemini` CLI (GEMINI_API_KEY, Vertex AI or
 *      enterprise Code Assist; personal Google logins are unsupported since
 *      2026-06-18).
 *   2. agy — Antigravity CLI with a Gemini model (consumer Google plans).
 *   3. codex — OpenAI Codex CLI (ChatGPT plans or an OpenAI API key).
 *   4. claude-subagent — a Claude Code sub-agent on a different Claude model,
 *      when running inside Claude Code; otherwise claude-cli — `claude -p`
 *      (Claude plans or ANTHROPIC_API_KEY).
 *   5. harness — no CLI critic; the agent picks another harness model, else the
 *      same model with a STRONG criticAdvisory (see reflexion-loop-sub-max).
 * Gemini rungs are skipped for a Google writer and codex for an OpenAI writer.
 * `command` is an argv array: append the critic prompt as its final argument
 * (agy ignores stdin, so stdin is not a portable way to pass it).
 * Prints the resolution as JSON on stdout. Usage:
 *   node scripts/resolve-critic.mjs --writer <anthropic|google|openai> [--writer-model <id>]
 * --writer-model is required for an anthropic writer, so the Claude critic differs.
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

/** Picks a Gemini critic model from `agy models` output (`id<TAB>label` lines). */
export function pickAgyModel(modelList) {
  const candidates = modelList
    .split('\n')
    .map((line) => line.split('\t')[0].trim())
    .filter((id) => /^[\w.-]+$/.test(id) && vendorOf(id) === 'google');
  return candidates.find((id) => id.includes('pro')) ?? candidates[0] ?? null;
}

/** A Claude critic must differ from a Claude writer: Opus writers get Sonnet, all others Opus. */
export function claudeCriticModel(writerModel) {
  return /opus/i.test(writerModel ?? '') ? 'sonnet' : 'opus';
}

function smokeSkipReason({ probe, command }) {
  const smoke = probe.run(command[0], [...command.slice(1), SMOKE_PROMPT]);
  if (smoke.ok) return null;
  if (/GOOGLE_CLOUD_PROJECT/.test(smoke.stderr)) {
    return 'personal-google-login-unsupported: set GEMINI_API_KEY or sign in to agy';
  }
  return `smoke-failed: ${smoke.detail}`;
}

/** Pure ladder walk; `probe` is injected so tests need no network or binaries. */
export function resolveCritic({ env, probe, writerVendor, writerModel }) {
  const skipped = [];

  function attempt({ rung, command, model = null, vendor }) {
    const reason = probe.which(command[0])
      ? smokeSkipReason({ probe, command })
      : 'not-installed';
    if (reason) {
      skipped.push({ rung, reason });
      return null;
    }
    const isolation = vendor === writerVendor ? 'L1' : 'L0';
    return { rung, command, model, isolation, skipped };
  }

  function attemptAgy() {
    if (!probe.which('agy')) {
      skipped.push({ rung: 'agy', reason: 'not-installed' });
      return null;
    }
    const model =
      env.TLS_CRITIC_MODEL || pickAgyModel(probe.run('agy', ['models']).stdout);
    if (!model) {
      skipped.push({ rung: 'agy', reason: 'no-gemini-model' });
      return null;
    }
    const command = ['agy', '--model', model, '--mode', 'plan', '-p'];
    return attempt({ rung: 'agy', command, model, vendor: vendorOf(model) });
  }

  if (writerVendor === 'google') {
    skipped.push(
      { rung: 'gemini-cli', reason: 'same-vendor-as-writer' },
      { rung: 'agy', reason: 'same-vendor-as-writer' }
    );
  } else {
    const gemini =
      attempt({
        rung: 'gemini-cli',
        command: ['gemini', '--skip-trust', '-p'],
        vendor: 'google',
      }) ?? attemptAgy();
    if (gemini) return gemini;
  }

  if (writerVendor === 'openai') {
    skipped.push({ rung: 'codex', reason: 'same-vendor-as-writer' });
  } else {
    const codex = attempt({
      rung: 'codex',
      command: [
        'codex',
        'exec',
        '--sandbox',
        'read-only',
        '--skip-git-repo-check',
        '--ephemeral',
      ],
      vendor: 'openai',
    });
    if (codex) return codex;
  }

  const claudeModel = claudeCriticModel(writerModel);
  if (env.CLAUDECODE === '1') {
    const isolation = writerVendor === 'anthropic' ? 'L1' : 'L0';
    return {
      rung: 'claude-subagent',
      command: null,
      model: claudeModel,
      isolation,
      skipped,
    };
  }
  skipped.push({ rung: 'claude-subagent', reason: 'not-inside-claude-code' });
  const claude = attempt({
    rung: 'claude-cli',
    command: [
      'claude',
      '--model',
      claudeModel,
      '--permission-mode',
      'plan',
      '--no-session-persistence',
      '-p',
    ],
    model: claudeModel,
    vendor: 'anthropic',
  });
  if (claude) return claude;

  return {
    rung: 'harness',
    command: null,
    model: null,
    isolation: null,
    skipped,
  };
}

/** First line that is not a CLI warning (e.g. gemini's terminal-colour notice). */
const firstErrorLine = (text) =>
  String(text)
    .trim()
    .split('\n')
    .find((line) => !/^warning\b/i.test(line.trim())) ?? '';

const systemProbe = {
  which: (bin) => spawnSync('which', [bin], { encoding: 'utf-8' }).status === 0,
  run: (bin, args) => {
    const r = spawnSync(bin, args, {
      encoding: 'utf-8',
      timeout: SMOKE_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const ok = !r.error && r.status === 0;
    const stderr = r.stderr ?? '';
    return {
      ok,
      stdout: r.stdout ?? '',
      stderr,
      detail: firstErrorLine(r.error?.message || stderr || `exit ${r.status}`),
    };
  },
};

const argValue = (flag) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const writerVendor = argValue('--writer');
  const writerModel = argValue('--writer-model');
  if (
    !WRITER_VENDORS.includes(writerVendor) ||
    (writerVendor === 'anthropic' && !writerModel)
  ) {
    process.stderr.write(
      `Usage: resolve-critic.mjs --writer <${WRITER_VENDORS.join('|')}> [--writer-model <id>]\n` +
        '--writer-model is required for an anthropic writer so the Claude critic differs from it.\n'
    );
    process.exit(2);
  }
  const result = resolveCritic({
    env: process.env,
    probe: systemProbe,
    writerVendor,
    writerModel,
  });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
