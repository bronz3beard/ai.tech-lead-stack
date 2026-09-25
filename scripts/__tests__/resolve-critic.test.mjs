import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  claudeCriticModel,
  pickAgyModel,
  resolveCritic,
} from '../resolve-critic.mjs';

const AGY_MODELS = [
  'Fetching available models...',
  'claude-opus-4-6-thinking\tClaude Opus 4.6 (Thinking)',
  'gemini-3.8-flash-high\tGemini 3.8 Flash (High)',
  'gemini-3.1-pro-high\tGemini 3.1 Pro (High)',
].join('\n');

const ALL_CLIS = ['gemini', 'agy', 'codex', 'claude'];

/** `failing` maps a binary to the stderr its smoke call fails with. */
const fakeProbe = ({
  installed = [],
  failing = {},
  models = AGY_MODELS,
} = {}) => ({
  which: (bin) => installed.includes(bin),
  run: (bin, args) => {
    if (bin === 'agy' && args[0] === 'models')
      return { ok: true, stdout: models, stderr: '', detail: '' };
    const stderr = failing[bin];
    return stderr === undefined
      ? { ok: true, stdout: 'OK', stderr: '', detail: '' }
      : { ok: false, stdout: '', stderr, detail: stderr };
  },
});

const skippedRungs = (result) => result.skipped.map((s) => s.rung);

describe('resolveCritic', () => {
  it('uses the gemini CLI first when it answers (API key, Vertex or enterprise)', () => {
    const result = resolveCritic({
      env: {},
      probe: fakeProbe({ installed: ALL_CLIS }),
      writerVendor: 'anthropic',
      writerModel: 'claude-opus-5-5',
    });
    assert.strictEqual(result.rung, 'gemini-cli');
    assert.strictEqual(result.isolation, 'L0');
    assert.deepStrictEqual(result.command, ['gemini', '--skip-trust', '-p']);
  });

  it('falls back to agy with a Gemini model when the gemini CLI rejects a personal login', () => {
    const result = resolveCritic({
      env: {},
      probe: fakeProbe({
        installed: ALL_CLIS,
        failing: { gemini: 'Error: set GOOGLE_CLOUD_PROJECT to continue' },
      }),
      writerVendor: 'anthropic',
      writerModel: 'claude-opus-5-5',
    });
    assert.strictEqual(result.rung, 'agy');
    assert.strictEqual(result.model, 'gemini-3.1-pro-high');
    assert.match(result.skipped[0].reason, /^personal-google-login-unsupported/);
  });

  it('puts -p last in the agy command so the appended prompt is not swallowed by --model', () => {
    const result = resolveCritic({
      env: {},
      probe: fakeProbe({ installed: ['agy'] }),
      writerVendor: 'anthropic',
      writerModel: 'claude-opus-5-5',
    });
    assert.deepStrictEqual(result.command, [
      'agy',
      '--model',
      'gemini-3.1-pro-high',
      '--mode',
      'plan',
      '-p',
    ]);
  });

  it('falls back to codex when no Gemini rung answers', () => {
    const result = resolveCritic({
      env: {},
      probe: fakeProbe({ installed: ['agy', 'codex'], failing: { agy: 'boom' } }),
      writerVendor: 'anthropic',
      writerModel: 'claude-opus-5-5',
    });
    assert.strictEqual(result.rung, 'codex');
    assert.strictEqual(result.isolation, 'L0');
    assert.deepStrictEqual(result.skipped, [
      { rung: 'gemini-cli', reason: 'not-installed' },
      { rung: 'agy', reason: 'smoke-failed: boom' },
    ]);
  });

  it('skips both Gemini rungs for a Google writer', () => {
    const result = resolveCritic({
      env: {},
      probe: fakeProbe({ installed: ALL_CLIS }),
      writerVendor: 'google',
    });
    assert.strictEqual(result.rung, 'codex');
    assert.deepStrictEqual(
      result.skipped.map((s) => s.reason),
      ['same-vendor-as-writer', 'same-vendor-as-writer']
    );
  });

  it('skips codex for an OpenAI writer and falls through to the claude CLI', () => {
    const result = resolveCritic({
      env: {},
      probe: fakeProbe({ installed: ['codex', 'claude'] }),
      writerVendor: 'openai',
    });
    assert.strictEqual(result.rung, 'claude-cli');
    assert.strictEqual(result.model, 'opus');
    assert.strictEqual(result.isolation, 'L0');
    assert.deepStrictEqual(skippedRungs(result), [
      'gemini-cli',
      'agy',
      'codex',
      'claude-subagent',
    ]);
  });

  it('spins up a Claude Code sub-agent on a different Claude model when running inside Claude Code', () => {
    const result = resolveCritic({
      env: { CLAUDECODE: '1' },
      probe: fakeProbe(),
      writerVendor: 'anthropic',
      writerModel: 'claude-opus-5-5',
    });
    assert.strictEqual(result.rung, 'claude-subagent');
    assert.strictEqual(result.command, null);
    assert.strictEqual(result.model, 'sonnet');
    assert.strictEqual(result.isolation, 'L1');
  });

  it('uses the claude CLI with a different Claude model outside Claude Code', () => {
    const result = resolveCritic({
      env: {},
      probe: fakeProbe({ installed: ['claude'] }),
      writerVendor: 'anthropic',
      writerModel: 'claude-fable-5-1',
    });
    assert.strictEqual(result.rung, 'claude-cli');
    assert.strictEqual(result.model, 'opus');
    assert.strictEqual(result.isolation, 'L1');
    assert.strictEqual(result.command.at(-1), '-p');
  });

  it('hands off to the harness rungs when no critic is available', () => {
    const result = resolveCritic({
      env: {},
      probe: fakeProbe(),
      writerVendor: 'anthropic',
      writerModel: 'claude-opus-5-5',
    });
    assert.strictEqual(result.rung, 'harness');
    assert.strictEqual(result.command, null);
    assert.deepStrictEqual(skippedRungs(result), [
      'gemini-cli',
      'agy',
      'codex',
      'claude-subagent',
      'claude-cli',
    ]);
  });

  it('honours TLS_CRITIC_MODEL for agy and reports L1 when it shares the writer vendor', () => {
    const result = resolveCritic({
      env: { TLS_CRITIC_MODEL: 'claude-sonnet-4-6' },
      probe: fakeProbe({ installed: ['agy'] }),
      writerVendor: 'anthropic',
      writerModel: 'claude-opus-5-5',
    });
    assert.strictEqual(result.model, 'claude-sonnet-4-6');
    assert.strictEqual(result.isolation, 'L1');
  });
});

describe('pickAgyModel', () => {
  it('prefers a Gemini pro model and ignores other vendors and non-model lines', () => {
    assert.strictEqual(pickAgyModel(AGY_MODELS), 'gemini-3.1-pro-high');
  });

  it('returns null when no Gemini model is listed', () => {
    assert.strictEqual(pickAgyModel('claude-sonnet-4-6\tSonnet'), null);
  });
});

describe('claudeCriticModel', () => {
  it('gives an Opus writer a Sonnet critic and every other writer Opus', () => {
    assert.strictEqual(claudeCriticModel('claude-opus-5-5'), 'sonnet');
    assert.strictEqual(claudeCriticModel('claude-fable-5-1'), 'opus');
    assert.strictEqual(claudeCriticModel(undefined), 'opus');
  });
});
