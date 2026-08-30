import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { guardSpoken, __clearGuardCache } from './guard-client.js';

describe('guardSpoken cascade', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalFetch = globalThis.fetch;
    __clearGuardCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    mock.restoreAll();
  });

  it('Tier A (Local Ollama): uses local guard when set and returns valid JSON', async () => {
    process.env.OLLAMA_GUARD_MODEL = 'llama3:8b';
    delete process.env.GEMINI_API_KEY; // Ensure no Gemini fallback

    const mockResponse = {
      spoken_ok: false,
      markdown_consistent: true,
      repaired_spoken: 'Repaired by local guard',
      reason: 'Stripped markdown',
    };

    globalThis.fetch = mock.fn(async (url, init: any) => {
      assert.ok(url.toString().includes('/api/chat'));
      const body = JSON.parse(init.body);
      assert.strictEqual(body.model, 'llama3:8b');
      return {
        ok: true,
        json: async () => ({
          message: { content: JSON.stringify(mockResponse) },
        }),
      } as Response;
    });

    const result = await guardSpoken('test prompt', 'raw **spoken**', 'raw **markdown**');
    assert.strictEqual(result.source, 'local-ollama');
    assert.strictEqual(result.repaired_spoken, 'Repaired by local guard');
  });

  it('Tier B (Gemini): falls back to Gemini if local guard missing', async () => {
    delete process.env.OLLAMA_GUARD_MODEL;
    process.env.GEMINI_API_KEY = 'fake-key';

    const mockResponse = {
      spoken_ok: false,
      markdown_consistent: true,
      repaired_spoken: 'Repaired by gemini',
      reason: 'Stripped formatting',
    };

    globalThis.fetch = mock.fn(async (url, init: any) => {
      assert.ok(url.toString().includes('generativelanguage.googleapis.com'));
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockResponse) }] } }],
        }),
      } as Response;
    });

    const result = await guardSpoken('test', 'spoken', 'markdown');
    assert.strictEqual(result.source, 'gemini-cloud');
    assert.strictEqual(result.repaired_spoken, 'Repaired by gemini');
  });

  it('Tier B (Gemini): falls back to Gemini if local guard fails', async () => {
    process.env.OLLAMA_GUARD_MODEL = 'llama3:8b';
    process.env.GEMINI_API_KEY = 'fake-key';

    const geminiMockResponse = {
      spoken_ok: true,
      markdown_consistent: true,
      repaired_spoken: 'Saved by gemini',
      reason: 'All good',
    };

    let fetchCount = 0;
    globalThis.fetch = mock.fn(async (url) => {
      fetchCount++;
      if (url.toString().includes('/api/chat')) {
        // Simulate local failure
        return { ok: false, status: 500 } as Response;
      }
      // Gemini success
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(geminiMockResponse) }] } }],
        }),
      } as Response;
    });

    const result = await guardSpoken('test', 'spoken', 'markdown');
    assert.strictEqual(result.source, 'gemini-cloud');
    assert.strictEqual(result.repaired_spoken, 'Saved by gemini');
    assert.strictEqual(fetchCount, 2); // Tried local, then gemini
  });

  it('Tier C (Regex): falls back to regex if both LLM guards fail', async () => {
    process.env.OLLAMA_GUARD_MODEL = 'llama3:8b';
    process.env.GEMINI_API_KEY = 'fake-key';

    // Both fail
    globalThis.fetch = mock.fn(async () => {
      throw new Error('Network timeout');
    });

    const result = await guardSpoken('test', 'Here is **bold**', 'markdown');
    
    // The sanitizeSpoken regex should strip "Here is " and "**"
    assert.strictEqual(result.source, 'regex-sanitizer');
    assert.strictEqual(result.repaired_spoken, 'bold');
  });

  it('Tier C (Regex): used immediately if no guards configured', async () => {
    delete process.env.OLLAMA_GUARD_MODEL;
    delete process.env.GEMINI_API_KEY;

    let calledFetch = false;
    globalThis.fetch = mock.fn(async () => {
      calledFetch = true;
      return {} as Response;
    });

    const result = await guardSpoken('test', 'Here is **bold**', 'markdown');
    
    assert.strictEqual(result.source, 'regex-sanitizer');
    assert.strictEqual(result.repaired_spoken, 'bold');
    assert.strictEqual(calledFetch, false); // No network calls made
  });

  it('Cache: returns cached result for identical input', async () => {
    delete process.env.OLLAMA_GUARD_MODEL;
    process.env.GEMINI_API_KEY = 'fake-key';

    let fetchCount = 0;
    globalThis.fetch = mock.fn(async () => {
      fetchCount++;
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ repaired_spoken: 'cached' }) }] } }],
        }),
      } as Response;
    });

    // First call
    await guardSpoken('test', 'spoken', 'markdown');
    assert.strictEqual(fetchCount, 1);

    // Second call with same prompt and spoken
    const result2 = await guardSpoken('test', 'spoken', 'different markdown');
    assert.strictEqual(fetchCount, 1); // Not called again
    assert.strictEqual(result2.repaired_spoken, 'cached');
  });
});
