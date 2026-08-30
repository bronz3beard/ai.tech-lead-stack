import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { LocalOllamaBackend } from './backends.js';

describe('LocalOllamaBackend', () => {
  let backend: LocalOllamaBackend;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    backend = new LocalOllamaBackend();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restoreAll();
  });

  it('passes Ollama stats through to result.raw natively (non-streaming)', async () => {
    const fakeResponse = {
      model: 'qwen3:14b',
      created_at: '2026-08-28T00:00:00Z',
      message: {
        role: 'assistant',
        content: '<spoken>Hello</spoken>\n<markdown>Hello World</markdown>',
      },
      done: true,
      done_reason: 'stop',
      total_duration: 5000000000,
      load_duration: 1000000000,
      prompt_eval_count: 10,
      prompt_eval_duration: 500000000,
      eval_count: 5,
      eval_duration: 4500000000,
    };

    globalThis.fetch = mock.fn(async () => {
      return {
        ok: true,
        json: async () => fakeResponse,
      } as Response;
    });

    const result = await backend.ask({ prompt: 'Test prompt', cwd: '/test/cwd' });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.text, 'Hello World');
    assert.strictEqual(result.spokenText, 'Hello');
    
    // Check raw passthrough
    assert.deepStrictEqual(result.raw, fakeResponse);
    
    const raw = result.raw as any;
    assert.strictEqual(raw.message.content, '<spoken>Hello</spoken>\n<markdown>Hello World</markdown>');
    assert.strictEqual(raw.eval_count, 5);
    assert.strictEqual(raw.prompt_eval_count, 10);
    assert.strictEqual(raw.eval_duration, 4500000000);
    assert.strictEqual(raw.total_duration, 5000000000);
  });

  it('parses JSON format natively without XML fallback', async () => {
    const fakeResponse = {
      model: 'qwen3:14b',
      created_at: '2026-08-28T00:00:00Z',
      message: {
        role: 'assistant',
        content: JSON.stringify({ spoken: 'Hello JSON', markdown: 'Hello World JSON' }),
      },
      done: true,
    };

    globalThis.fetch = mock.fn(async () => {
      return {
        ok: true,
        json: async () => fakeResponse,
      } as Response;
    });

    const result = await backend.ask({ prompt: 'Test prompt JSON', cwd: '/test/cwd' });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.text, 'Hello World JSON');
    assert.strictEqual(result.spokenText, 'Hello JSON');
  });

  it('succeeds safely if stats are omitted from Ollama response (fallback path)', async () => {
    const fakeResponse = {
      model: 'qwen3:14b',
      created_at: '2026-08-28T00:00:00Z',
      message: {
        role: 'assistant',
        content: 'No stats here',
      },
      done: true,
    };

    globalThis.fetch = mock.fn(async () => {
      return {
        ok: true,
        json: async () => fakeResponse,
      } as Response;
    });

    const result = await backend.ask({ prompt: 'Test prompt 2', cwd: '/test/cwd' });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.text, 'No stats here');
    assert.strictEqual(result.spokenText, 'No stats here');
    
    // Check raw passthrough still works
    assert.deepStrictEqual(result.raw, fakeResponse);
    
    const raw = result.raw as any;
    assert.strictEqual(raw.message.content, 'No stats here');
    assert.strictEqual(raw.eval_count, undefined);
  });
});
