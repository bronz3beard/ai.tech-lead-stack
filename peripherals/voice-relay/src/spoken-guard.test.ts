import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateSpoken,
  validateByTaskClass,
  detectTaskClass,
  sanitizeSpoken,
  hasAscendingRun,
  scoreNoListIndexLeak,
  scoreNoPreamble,
  scoreNoCodeLeak,
  scoreNoTableLeak,
} from './spoken-guard.js';

/* ------------------------------------------------------------------ */
/* detectTaskClass                                                     */
/* ------------------------------------------------------------------ */

describe('detectTaskClass', () => {
  it('detects sequence tasks', () => {
    assert.strictEqual(detectTaskClass('Count backwards from 25'), 'sequence');
    assert.strictEqual(detectTaskClass('List the first 5 primes'), 'sequence');
    assert.strictEqual(detectTaskClass('Name the planets'), 'sequence');
    assert.strictEqual(detectTaskClass('Enumerate the colors'), 'sequence');
  });

  it('detects arithmetic tasks', () => {
    assert.strictEqual(detectTaskClass('What is 2 + 2?'), 'arithmetic');
    assert.strictEqual(detectTaskClass('Calculate 10 * 5'), 'arithmetic');
    assert.strictEqual(detectTaskClass('What is the square root of 144?'), 'arithmetic');
  });

  it('detects definition tasks', () => {
    assert.strictEqual(detectTaskClass('What is a monad?'), 'definition');
    assert.strictEqual(detectTaskClass('Explain polymorphism'), 'definition');
    assert.strictEqual(detectTaskClass('How many days in August?'), 'definition');
    assert.strictEqual(detectTaskClass('What is the difference between TCP and UDP?'), 'definition');
  });

  it('detects code tasks', () => {
    assert.strictEqual(detectTaskClass('Write a hello world script'), 'code');
    assert.strictEqual(detectTaskClass('Implement a linked list'), 'code');
    assert.strictEqual(detectTaskClass('Write a function to sort an array'), 'code');
  });

  it('returns freeform for unclassified prompts', () => {
    assert.strictEqual(detectTaskClass('Tell me a joke'), 'freeform');
    assert.strictEqual(detectTaskClass('What do you think about AI?'), 'freeform');
  });
});

/* ------------------------------------------------------------------ */
/* validateSpoken — universal rules                                    */
/* ------------------------------------------------------------------ */

describe('validateSpoken', () => {
  it('passes clean spoken text', () => {
    const r = validateSpoken('There are 31 days in August.');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.issues.length, 0);
    assert.strictEqual(r.confidence, 'high');
  });

  it('rejects empty text', () => {
    const r = validateSpoken('');
    assert.strictEqual(r.ok, false);
    assert.ok(r.issues.some((i) => i.includes('empty')));
  });

  it('rejects markdown bold', () => {
    const r = validateSpoken('This is **bold** text');
    assert.strictEqual(r.ok, false);
    assert.ok(r.issues.some((i) => i.includes('markdown')));
  });

  it('rejects markdown headers', () => {
    const r = validateSpoken('# Header\nSome text');
    assert.strictEqual(r.ok, false);
    assert.ok(r.issues.some((i) => i.includes('markdown')));
  });

  it('rejects backtick code spans', () => {
    const r = validateSpoken('Use the `print()` function');
    assert.strictEqual(r.ok, false);
    assert.ok(r.issues.some((i) => i.includes('markdown')));
  });

  it('rejects markdown links', () => {
    const r = validateSpoken('See [docs](https://example.com)');
    assert.strictEqual(r.ok, false);
    assert.ok(r.issues.some((i) => i.includes('markdown')));
  });

  it('rejects bullet points', () => {
    const r = validateSpoken('Features:\n- Fast\n- Simple');
    assert.strictEqual(r.ok, false);
    assert.ok(r.issues.some((i) => i.includes('list formatting')));
  });

  it('rejects ordered list indices', () => {
    const r = validateSpoken('1. First item\n2. Second item');
    assert.strictEqual(r.ok, false);
    assert.ok(r.issues.some((i) => i.includes('list formatting')));
  });

  it('rejects preamble phrases', () => {
    const cases = [
      'Here is the answer: 42',
      'Sure, the answer is 42',
      'Certainly, it is 42',
      'Great question! The answer is 42',
    ];
    for (const text of cases) {
      const r = validateSpoken(text);
      assert.strictEqual(r.ok, false, `Expected fail for: "${text}"`);
      assert.ok(r.issues.some((i) => i.includes('preamble')), `Missing preamble issue for: "${text}"`);
    }
  });

  it('rejects epilogue phrases', () => {
    const cases = [
      'The answer is 42. Let me know if you need more.',
      'It is 42. Hope this helps!',
      'The result is 42. Feel free to ask.',
    ];
    for (const text of cases) {
      const r = validateSpoken(text);
      assert.strictEqual(r.ok, false, `Expected fail for: "${text}"`);
      assert.ok(r.issues.some((i) => i.includes('epilogue')), `Missing epilogue issue for: "${text}"`);
    }
  });

  it('rejects raw code syntax', () => {
    const r = validateSpoken('You can use function add(a, b) { return a + b; }');
    assert.strictEqual(r.ok, false);
    assert.ok(r.issues.some((i) => i.includes('code syntax')));
  });

  it('rejects conversational meta-talk and epilogues', () => {
    const cases = [
      'Here are the definitions you requested:\nApple is a fruit.',
      'Sure, I can summarize that for you:\nThe sky is blue.',
      'Apple is a fruit.\nLet me know if you need any other definitions!',
      'Apple is a fruit.\nDone! Have a great day.',
    ];
    for (const text of cases) {
      const r = validateSpoken(text);
      assert.strictEqual(r.ok, false, `Expected fail for: "${text}"`);
    }
  });

  it('rejects improper markdown wrappers', () => {
    const cases = [
      '```text\nA dog is an animal.\n```',
      '**Important**: The *key* is to __focus__.',
    ];
    for (const text of cases) {
      const r = validateSpoken(text);
      assert.strictEqual(r.ok, false, `Expected fail for: "${text}"`);
      assert.ok(r.issues.some((i) => i.includes('markdown')), `Missing markdown issue for: "${text}"`);
    }
  });

  it('rejects unwanted list formatting', () => {
    const cases = [
      '- Item A\n- Item B\n- Item C',
      '1. First point\n2. Second point',
    ];
    for (const text of cases) {
      const r = validateSpoken(text);
      assert.strictEqual(r.ok, false, `Expected fail for: "${text}"`);
      assert.ok(r.issues.some((i) => i.includes('list formatting')), `Missing list formatting issue for: "${text}"`);
    }
  });

  it('rejects markdown tables', () => {
    const r = validateSpoken('| Name | Age |\n| --- | --- |\n| Alice | 30 |');
    assert.strictEqual(r.ok, false);
    assert.ok(r.issues.some((i) => i.includes('table')));
  });

  it('flags low confidence for verbose but clean text', () => {
    const longText = Array(60).fill('word').join(' ');
    const r = validateSpoken(longText);
    assert.strictEqual(r.ok, true); // no hard violations
    assert.strictEqual(r.confidence, 'low'); // over budget
  });

  it('passes concise text with high confidence', () => {
    const r = validateSpoken('The answer is forty-two.');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.confidence, 'high');
  });
});

/* ------------------------------------------------------------------ */
/* validateByTaskClass                                                 */
/* ------------------------------------------------------------------ */

describe('validateByTaskClass', () => {
  it('catches ascending run in sequence tasks', () => {
    const spoken = '1 2 3 4 5 6 7 8 9 10';
    const r = validateByTaskClass(spoken, 'Count backwards from 10', 'sequence');
    assert.strictEqual(r.ok, false);
    assert.ok(r.issues.some((i) => i.includes('ascending')));
  });

  it('passes descending sequence', () => {
    const spoken = '25 24 23 22 21 20 19 18 17 16 15 14 13 12 11 10 9 8 7 6 5 4 3 2 1';
    const r = validateByTaskClass(spoken, 'Count backwards from 25', 'sequence');
    assert.strictEqual(r.ok, true);
  });

  it('catches code syntax in code tasks', () => {
    const spoken = 'Use console.log to print; then add a return statement';
    const r = validateByTaskClass(spoken, 'Write a hello world', 'code');
    assert.strictEqual(r.ok, false);
  });

  it('catches verbose definitions', () => {
    const spoken = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
    const r = validateByTaskClass(spoken, 'What is a monad?', 'definition');
    assert.strictEqual(r.ok, false);
    assert.ok(r.issues.some((i) => i.includes('3 sentences')));
  });

  it('passes a brief definition', () => {
    const spoken = 'A monad is a design pattern for chaining operations.';
    const r = validateByTaskClass(spoken, 'What is a monad?', 'definition');
    assert.strictEqual(r.ok, true);
  });
});

/* ------------------------------------------------------------------ */
/* hasAscendingRun                                                     */
/* ------------------------------------------------------------------ */

describe('hasAscendingRun', () => {
  it('detects ascending 1,2,3', () => {
    assert.strictEqual(hasAscendingRun('Item 1. Item 2. Item 3.'), true);
  });

  it('does not flag descending sequences', () => {
    assert.strictEqual(hasAscendingRun('10 9 8 7 6 5 4 3 2 1'), false);
  });

  it('does not flag isolated numbers', () => {
    assert.strictEqual(hasAscendingRun('There are 52 weeks and 12 months'), false);
  });

  it('does not flag short sequences (< 3)', () => {
    assert.strictEqual(hasAscendingRun('1 2'), false);
  });

  it('detects ascending run in the middle of text', () => {
    assert.strictEqual(hasAscendingRun('values: 10, 20, 5, 6, 7, 100'), true);
  });
});

/* ------------------------------------------------------------------ */
/* sanitizeSpoken                                                      */
/* ------------------------------------------------------------------ */

describe('sanitizeSpoken', () => {
  it('strips ordered list indices', () => {
    const result = sanitizeSpoken('1. Apple\n2. Banana\n3. Cherry');
    assert.ok(!result.match(/\d+\.\s/));
    assert.ok(result.includes('Apple'));
    assert.ok(result.includes('Banana'));
  });

  it('strips bullet points', () => {
    const result = sanitizeSpoken('- Fast\n- Simple\n- Clean');
    assert.ok(!result.includes('- '));
    assert.ok(result.includes('Fast'));
  });

  it('strips markdown bold', () => {
    const result = sanitizeSpoken('This is **bold** and ***extra bold***');
    assert.ok(!result.includes('*'));
    assert.ok(result.includes('bold'));
  });

  it('strips markdown headers', () => {
    const result = sanitizeSpoken('## Section\nSome text');
    assert.ok(!result.includes('#'));
    assert.ok(!result.includes('Section'));
    assert.ok(result.includes('Some text'));
  });

  it('strips backtick code spans', () => {
    const result = sanitizeSpoken('Use `console.log` to print');
    assert.ok(!result.includes('`'));
    assert.ok(result.includes('console.log'));
  });

  it('strips markdown links', () => {
    const result = sanitizeSpoken('See [the docs](https://example.com) here');
    assert.ok(!result.includes('['));
    assert.ok(!result.includes('(http'));
    assert.ok(result.includes('the docs'));
  });

  it('strips preamble phrases', () => {
    const result = sanitizeSpoken('Here is the answer: 42');
    assert.ok(!result.toLowerCase().startsWith('here is'));
    assert.ok(result.includes('42'));
  });

  it('strips epilogue phrases', () => {
    const result = sanitizeSpoken('The answer is 42. Let me know if you need more.');
    assert.ok(!result.toLowerCase().includes('let me know'));
    assert.ok(result.includes('42'));
  });

  it('collapses excessive whitespace', () => {
    const result = sanitizeSpoken('word1    word2\n\n\nword3');
    assert.ok(!result.includes('    '));
    assert.ok(!result.includes('\n\n\n'));
  });

  it('handles already-clean text unchanged', () => {
    const clean = 'There are 31 days in August.';
    assert.strictEqual(sanitizeSpoken(clean), clean);
  });

  it('strips conversational meta-talk (prologue)', () => {
    const result = sanitizeSpoken('Here are the definitions you requested:\nApple is a fruit.');
    assert.strictEqual(result, 'Apple is a fruit.');
  });
  
  it('strips conversational meta-talk (epilogue)', () => {
    const result = sanitizeSpoken('Apple is a fruit.\nDone! Have a great day.');
    assert.strictEqual(result, 'Apple is a fruit.');
  });

  it('strips improper markdown wrappers (text block)', () => {
    const result = sanitizeSpoken('```text\nA dog is an animal.\n```');
    assert.strictEqual(result, 'A dog is an animal.');
  });

  it('strips aggressive inline formatting', () => {
    const result = sanitizeSpoken('**Important**: The *key* is to __focus__.');
    assert.strictEqual(result, 'Important: The key is to focus.');
  });

  it('flattens unordered lists', () => {
    const result = sanitizeSpoken('- Item A\n- Item B\n- Item C');
    assert.strictEqual(result, 'Item A\nItem B\nItem C');
  });

  it('flattens ordered lists gracefully', () => {
    const result = sanitizeSpoken('1. First point\n2. Second point');
    assert.strictEqual(result, 'First point\nSecond point');
  });

  it('strips markdown tables entirely', () => {
    const result = sanitizeSpoken('Answer:\n| Name | Age |\n| --- | --- |\n| Alice | 30 |');
    assert.ok(!result.includes('|'));
    assert.ok(!result.includes('---'));
  });

  it('strips verbose countdown with full markdown structure', () => {
    const raw = '# Countdown from 17 to Zero\n\nWe begin at the integer **seventeen** and decrement by one until we reach zero. Below is the complete list of integers in descending order within that range.\n\n```markdown\n- 17\n- 16\n- 15\n- 14\n- 13\n- 12\n- 11\n- 10\n- 9\n- 8\n- 7\n- 6\n- 5\n- 4\n- 3\n- 2\n- 1\n```\n\n### Summary Table\n\n| Start | End (Inclusive) | Total Steps |\n| :---: | :----: | ---: |\n| **17** | **0** | **-9** *(-1)* |\n\n*Count includes both start and end points. To reach zero from 17 is a total count of 18 numbers in the sequence (including 0).';
    const result = sanitizeSpoken(raw);
    assert.strictEqual(result, '17\n16\n15\n14\n13\n12\n11\n10\n9\n8\n7\n6\n5\n4\n3\n2\n1');
  });

  it('strips verbose countdown from 10 with code block and epilogue', () => {
    const raw = '# Counting Backwards from 10\n\nHere is the sequence counting backwards:\n\n```text\n10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, ...\n```\n\n### Number List (Down to Zero)\n\n- 10\n- 9\n- 8\n- 7\n- 6\n- 5\n- 4\n- 3\n- 2\n- 1\n- 0\n\nIf you\'d like me to continue further into negative numbers, just let me know!';
    const result = sanitizeSpoken(raw);
    assert.strictEqual(result, '10\n9\n8\n7\n6\n5\n4\n3\n2\n1\n0');
  });

  it('strips verbose countdown from nine with word items and continuation epilogue', () => {
    const raw = '# Count Backwards from Nine\n\nThis sequence displays integers decreasing by one starting at nine down to zero:\n\n- **Nine**\n- Eight\n- Seven\n- Six\n- Five\n- Four\n- Three\n- Two\n- One\n- Zero\n\nYou may continue past this point into negative integers.';
    const result = sanitizeSpoken(raw);
    assert.strictEqual(result, 'Nine\nEight\nSeven\nSix\nFive\nFour\nThree\nTwo\nOne\nZero');
  });

  it('strips verbose countdown from nine to negative five with code block, blockquotes, and visual fluff', () => {
    const raw = '# Countdown from Nine\n\nHere is a sequence counting backwards starting at nine using integers until negative five. This format preserves spacing in both Markdown viewers and screen readers by utilizing monospaced text within code fences.\n\n### The Sequence\n```text\n9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5\n```\n\n---\n\nIf you prefer a visual vertical representation:\n\n> **9**\n> *   ... counting down by one unit per step.\n> \n> **8**  \n> **7**  \n> **6**  \n> **5**  \n> **4**  \n> **3**  \n> **2**  \n> **1**  \n> **0** (Zero reached)\n> \n> Continuing into negative numbers: -1, -2...\n\nThis structure ensures clarity regardless of whether the content is processed visually as Markdown or stripped to plain text for audio reading.';
    const result = sanitizeSpoken(raw);
    assert.strictEqual(result, '9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5');
  });

  it('strips deeply nested styles', () => {
    const result = sanitizeSpoken('This is **_italic inside bold_** text');
    console.log('DEEPLY NESTED RESULT:', result);
    assert.ok(!result.includes('*'));
    assert.ok(!result.includes('_'));
    assert.ok(result.includes('italic inside bold'));
  });

  it('strips links inside formatting', () => {
    const result = sanitizeSpoken('Check **[this link](https://example.com)** out');
    assert.ok(!result.includes('*'));
    assert.ok(!result.includes('['));
    assert.ok(!result.includes('(http'));
    assert.strictEqual(result, 'Check this link out');
  });

  it('strips triple emphasis', () => {
    const result = sanitizeSpoken('There is a ***triple*** emphasis');
    assert.ok(!result.includes('*'));
    assert.strictEqual(result, 'There is a triple emphasis');
  });

  it('strips lists with nested markdown', () => {
    const result = sanitizeSpoken('- **Bold item**\n- _Italic item_');
    assert.ok(!result.includes('- '));
    assert.ok(!result.includes('*'));
    assert.ok(!result.includes('_'));
    assert.strictEqual(result, 'Bold item\nItalic item');
  });

  it('safely breaks out of infinite loops via max depth limit', () => {
    // A string maliciously designed to trick regex replacements by creating new markdown
    // (though our regex isn't particularly vulnerable to this, it proves the max-depth logic works)
    let dirty = '';
    for (let i = 0; i < 10; i++) {
      dirty += '*';
    }
    dirty += 'too many stars';
    for (let i = 0; i < 10; i++) {
      dirty += '*';
    }
    
    // It should strip up to 5 pairs of stars (if they matched 1-3 at a time)
    // The important thing is that it returns and doesn't hang.
    const start = Date.now();
    const result = sanitizeSpoken(dirty);
    const duration = Date.now() - start;
    
    assert.ok(duration < 200, `Took too long: ${duration}ms`);
    // It will probably strip most of them since the regex handles 1-3 stars.
    assert.ok(result.includes('too many stars'));
  });
});

/* ------------------------------------------------------------------ */
/* Score helpers                                                        */
/* ------------------------------------------------------------------ */

describe('scoreNoListIndexLeak', () => {
  it('returns 1.0 for clean text', () => {
    assert.strictEqual(scoreNoListIndexLeak('Twenty-five, twenty-four'), 1.0);
  });

  it('returns 0.0 for ordinal-indexed text', () => {
    assert.strictEqual(scoreNoListIndexLeak('1. First\n2. Second'), 0.0);
  });
});

describe('scoreNoPreamble', () => {
  it('returns 1.0 for no preamble', () => {
    assert.strictEqual(scoreNoPreamble('The answer is 42.'), 1.0);
  });

  it('returns 0.0 for preamble', () => {
    assert.strictEqual(scoreNoPreamble('Here is the answer: 42'), 0.0);
  });
});

describe('scoreNoCodeLeak', () => {
  it('returns 1.0 for no code', () => {
    assert.strictEqual(scoreNoCodeLeak('The answer is 42.'), 1.0);
  });

  it('returns 0.0 for code syntax', () => {
    assert.strictEqual(scoreNoCodeLeak('Use function add(a, b) to sum'), 0.0);
  });
});

describe('scoreNoTableLeak', () => {
  it('returns 1.0 for clean text', () => {
    assert.strictEqual(scoreNoTableLeak('The answer is 42.'), 1.0);
  });

  it('returns 0.0 for table content', () => {
    assert.strictEqual(scoreNoTableLeak('| A | B |\n| --- | --- |'), 0.0);
  });
});
