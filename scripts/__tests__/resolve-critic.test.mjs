import { describe, it } from 'node:test';
import assert from 'node:assert';
import { pickAgyModel, resolveCritic } from '../resolve-critic.mjs';

const AGY_MODELS = [
  'Fetching available models...',
  'gemini-3.8-flash-high\tGemini 3.8 Flash (High)',
  'gemini-3.1-pro-high\tGemini 3.1 Pro (High)',
  'claude-opus-4-6-thinking\tClaude Opus 4.6 (Thinking)',
].join('\n');

/** `failing` holds "<bin> <first-arg>" keys whose run() should fail. */
const fakeProbe = ({
  installed = [],
  failing = [],
  models = AGY_MODELS,
} = {}) => ({
  which: (bin) => installed.includes(bin),
  run: (bin, args) => {
    if (bin === 'agy' && args[0] === 'models')
      return { ok: true, stdout: models, detail: '' };
    const ok = !failing.includes(`${bin} ${args[0]}`);
    return { ok, stdout: ok ? 'OK' : '', detail: ok ? '' : 'boom' };
  },
});

const ENTERPRISE_ENV = { GOOGLE_CLOUD_PROJECT: 'acme-prod' };

describe('resolveCritic', () => {
  it('uses the enterprise gemini CLI when installed, configured and responsive', () => {
    const result = resolveCritic({
      env: ENTERPRISE_ENV,
      probe: fakeProbe({ installed: ['gemini', 'agy'] }),
      writerVendor: 'anthropic',
    });
    assert.strictEqual(result.rung, 'enterprise-gemini');
    assert.strictEqual(result.isolation, 'L0');
  });

  it('falls back to agy and explains the personal-account cause when GOOGLE_CLOUD_PROJECT is unset', () => {
    const result = resolveCritic({
      env: {},
      probe: fakeProbe({ installed: ['gemini', 'agy'] }),
      writerVendor: 'anthropic',
    });
    assert.strictEqual(result.rung, 'agy');
    assert.match(
      result.skipped[0].reason,
      /^no-GOOGLE_CLOUD_PROJECT: personal Google accounts/
    );
  });

  it('falls back to agy with a cannot-start reason when gemini is installed but broken', () => {
    const result = resolveCritic({
      env: ENTERPRISE_ENV,
      probe: fakeProbe({
        installed: ['gemini', 'agy'],
        failing: ['gemini --version'],
      }),
      writerVendor: 'anthropic',
    });
    assert.strictEqual(result.rung, 'agy');
    assert.strictEqual(result.skipped[0].reason, 'cannot-start: boom');
  });

  it('skips enterprise gemini for a Google writer because it would not be cross-vendor', () => {
    const result = resolveCritic({
      env: ENTERPRISE_ENV,
      probe: fakeProbe({ installed: ['gemini', 'agy'] }),
      writerVendor: 'google',
    });
    assert.strictEqual(result.skipped[0].reason, 'same-vendor-as-writer');
    assert.strictEqual(result.model, 'claude-opus-4-6-thinking');
  });

  it('hands off to the harness rungs when neither CLI is available', () => {
    const result = resolveCritic({
      env: {},
      probe: fakeProbe(),
      writerVendor: 'anthropic',
    });
    assert.strictEqual(result.rung, 'harness');
    assert.strictEqual(result.command, null);
    assert.deepStrictEqual(
      result.skipped.map((s) => s.rung),
      ['enterprise-gemini', 'agy']
    );
  });

  it('hands off to the harness rungs when the agy smoke call fails', () => {
    const result = resolveCritic({
      env: {},
      probe: fakeProbe({ installed: ['agy'], failing: ['agy -p'] }),
      writerVendor: 'anthropic',
    });
    assert.strictEqual(result.rung, 'harness');
    assert.strictEqual(result.skipped[1].reason, 'smoke-failed: boom');
  });

  it('honours TLS_CRITIC_MODEL and reports L1 when it shares the writer vendor', () => {
    const result = resolveCritic({
      env: { TLS_CRITIC_MODEL: 'claude-sonnet-4-6' },
      probe: fakeProbe({ installed: ['agy'] }),
      writerVendor: 'anthropic',
    });
    assert.strictEqual(result.model, 'claude-sonnet-4-6');
    assert.strictEqual(result.isolation, 'L1');
  });
});

describe('pickAgyModel', () => {
  it('prefers a pro model from a vendor other than the writer and ignores non-model lines', () => {
    assert.strictEqual(
      pickAgyModel({ modelList: AGY_MODELS, writerVendor: 'anthropic' }),
      'gemini-3.1-pro-high'
    );
  });

  it('returns null when every listed model shares the writer vendor', () => {
    assert.strictEqual(
      pickAgyModel({
        modelList: 'claude-sonnet-4-6\tSonnet',
        writerVendor: 'anthropic',
      }),
      null
    );
  });
});
