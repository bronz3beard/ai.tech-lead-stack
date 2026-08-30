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
      raw: '```python\ndef foo(): pass\n```',
      expectFlag: true,
      expectSanitized: '',
    },
    {
      raw: 'Sure, here is the answer: 42. Hope this helps!',
      expectFlag: true,
      expectSanitized: '42.',
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
    {
      raw: 'Here is a list:\n- One\n- Two',
      expectFlag: true,
      expectSanitized: 'One\nTwo',
    },
    {
      raw: 'Sure, here is the definition: A dog is an animal.',
      expectFlag: true,
      expectSanitized: 'A dog is an animal.',
    },
    {
      raw: '# Header\nThis is the text',
      expectFlag: true,
      expectSanitized: 'This is the text',
    },
    {
      raw: '```markdown\n12, 11\n```',
      expectFlag: true,
      expectSanitized: '12, 11',
    },
    {
      raw: '*This sequence counts downward from seven to one.*\n\n```markdown\n# Counting Backwards From Seven\n\n- 7  \n- 6  \n- 5  \n- 4  \n- 3  \n- 2  \n- 1  \n\n*This sequence counts downward from seven to one.*\n```',
      expectFlag: true,
      expectSanitized: '7\n6\n5\n4\n3\n2\n1',
    },
    // --- Conversational Meta-talk & Epilogues ---
    {
      raw: 'Here are the definitions you requested:\nApple is a fruit.',
      expectFlag: true,
      expectSanitized: 'Apple is a fruit.',
    },
    {
      raw: 'Sure, I can summarize that for you:\nThe sky is blue.',
      expectFlag: true,
      expectSanitized: 'The sky is blue.',
    },
    {
      raw: 'Apple is a fruit.\nLet me know if you need any other definitions!',
      expectFlag: true,
      expectSanitized: 'Apple is a fruit.',
    },
    {
      raw: 'Apple is a fruit.\nDone! Have a great day.',
      expectFlag: true,
      expectSanitized: 'Apple is a fruit.',
    },
    // --- Improper Markdown Wrappers ---
    {
      raw: '```text\nA dog is an animal.\n```',
      expectFlag: true,
      expectSanitized: 'A dog is an animal.',
    },
    {
      raw: '**Important**: The *key* is to __focus__.',
      expectFlag: true,
      expectSanitized: 'Important: The key is to focus.',
    },
    // --- Unwanted List Formatting ---
    {
      raw: '- Item A\n- Item B\n- Item C',
      expectFlag: true,
      expectSanitized: 'Item A\nItem B\nItem C',
    },
    {
      raw: '1. First point\n2. Second point',
      expectFlag: true,
      expectSanitized: 'First point\nSecond point',
    },
    // --- Markdown Table Formatting ---
    {
      raw: '| Name | Age |\n| --- | --- |\n| Alice | 30 |',
      expectFlag: true,
      expectSanitized: '',
    },
    // --- Verbose Countdown with Full Document & Table ---
    {
      raw: '# Countdown from 17 to Zero\n\nWe begin at the integer **seventeen** and decrement by one until we reach zero. Below is the complete list of integers in descending order within that range.\n\n```markdown\n- 17\n- 16\n- 15\n- 14\n- 13\n- 12\n- 11\n- 10\n- 9\n- 8\n- 7\n- 6\n- 5\n- 4\n- 3\n- 2\n- 1\n```\n\n### Summary Table\n\n| Start | End (Inclusive) | Total Steps |\n| :---: | :----: | ---: |\n| **17** | **0** | **-9** *(-1)* |\n\n*Count includes both start and end points. To reach zero from 17 is a total count of 18 numbers in the sequence (including 0).',
      expectFlag: true,
      expectSanitized: '17\n16\n15\n14\n13\n12\n11\n10\n9\n8\n7\n6\n5\n4\n3\n2\n1',
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
    'Ten, nine, eight, seven.',
    'The result of ten plus ten is twenty.',
  ];

  for (const tc of cleanSpeech) {
    const val = validateSpoken(tc);
    assert.strictEqual(val.ok, true, `Expected pass for clean speech: ${tc}`);
    assert.strictEqual(val.issues.length, 0);
  }
});
