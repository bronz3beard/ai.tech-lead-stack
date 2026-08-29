import * as assert from 'node:assert';
import { test } from 'node:test';
import { sanitizeSpoken, validateSpoken } from '../src/spoken-guard.js';

test('Spoken Guard - True Negatives (flags and sanitizes failure modes)', () => {
  const failureModes = [
    {
      raw: 'Note: The output is an alternative format.\n```\nconsole.log(1);\n```',
      expectFlag: true,
      expectSanitized: 'The output is an alternative format.',
    },
    {
      raw: 'Output:\nThis is the result.',
      expectFlag: true,
      expectSanitized: 'This is the result.',
    },
    {
      raw: 'Alternative Formats: JSON\n- item 1\n- item 2',
      expectFlag: true,
      expectSanitized: 'JSON\nitem 1\nitem 2',
    },
    {
      raw: 'Sure, here is the answer: 42. Hope this helps!',
      expectFlag: true,
      expectSanitized: '42.',
    },
    {
      raw: '```python\ndef foo(): pass\n```',
      expectFlag: true,
      expectSanitized: '',
    },
    {
      raw: '6, 5, 4, 3, 2, 1, 0 (or stop at one). You can stop at 0 if you wish to include zero as well.',
      expectFlag: true,
      expectSanitized: '6, 5, 4, 3, 2, 1, 0.',
    },
    {
      raw: "Here's the countdown sequence:\n10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0\nDone! Let me know if you need to count backwards from a different starting number.",
      expectFlag: true,
      expectSanitized: '10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0',
    },
  ];

  for (const tc of failureModes) {
    const val = validateSpoken(tc.raw);
    assert.strictEqual(
      !val.ok || val.issues.length > 0,
      tc.expectFlag,
      `Expected flag for: ${tc.raw}`
    );
    const cleaned = sanitizeSpoken(tc.raw);
    assert.strictEqual(
      cleaned,
      tc.expectSanitized,
      `Expected sanitized: "${tc.expectSanitized}", but got: "${cleaned}"`
    );
  }
});

test('Spoken Guard - True Positives (passes clean speech)', () => {
  const cleanSpeech = [
    'The square root of 144 is 12.',
    'A sequence of numbers: two, four, six, eight.',
    'A binary search tree is a data structure where each node has at most two children.',
  ];

  for (const tc of cleanSpeech) {
    const val = validateSpoken(tc);
    assert.strictEqual(val.ok, true, `Expected pass for clean speech: ${tc}`);
    assert.strictEqual(val.issues.length, 0);
  }
});
