/**
 *
 * Tests the deterministic ClickUp formatting module. This is the production-ethos
 * guarantee: formatting is verified, not re-derived per run.
 */
import {
  assembleDocument,
  bold,
  bullets,
  checklist,
  code,
  h2,
  renderTable,
  section,
  type Table,
} from '../clickup-format';

describe('clickup-format', () => {
  test('h2 renders a level-2 heading', () => {
    expect(h2('Architecture Overview')).toBe('## Architecture Overview');
  });

  test('bold and code wrap correctly', () => {
    expect(bold('important')).toBe('**important**');
    expect(code('useServerTable')).toBe('`useServerTable`');
  });

  test('bullets render one per line', () => {
    expect(bullets(['a', 'b'])).toBe('- a\n- b');
  });

  test('checklist renders interactive checkboxes', () => {
    const out = checklist([
      { text: 'Sort ascending updates URL' },
      { text: 'Pagination resets on tab change', checked: true },
    ]);
    expect(out).toBe(
      '- [ ] Sort ascending updates URL\n- [x] Pagination resets on tab change'
    );
  });

  describe('renderTable', () => {
    const table: Table = {
      headers: ['Interaction', 'Expected Result'],
      rows: [
        ['Click sort', 'URL gains orderBy param'],
        ['Switch tab', 'offset resets to 0'],
      ],
    };

    test('default mode is pipe (native ClickUp Doc table)', () => {
      const out = renderTable(table);
      expect(out).toContain('| Interaction | Expected Result |');
      expect(out).toContain('| --- | --- |');
      expect(out).toContain('| Click sort | URL gains orderBy param |');
    });

    test('list mode renders labelled bullets', () => {
      const out = renderTable(table, 'list');
      expect(out).toContain('- **Interaction:** Click sort');
      expect(out).toContain('- **Expected Result:** URL gains orderBy param');
      expect(out).toContain(
        '- **Expected Result:** URL gains orderBy param\n\n- **Interaction:** Switch tab'
      );
    });

    test('pipe mode escapes stray pipe characters in cells', () => {
      const t: Table = { headers: ['A'], rows: [['x | y']] };
      const out = renderTable(t, 'pipe');
      expect(out).toContain('x \\| y');
    });

    test('auto-falls back to list when columns exceed the doc limit (8)', () => {
      const wide: Table = {
        headers: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'],
        rows: [['1', '2', '3', '4', '5', '6', '7', '8', '9']],
      };
      const out = renderTable(wide, 'pipe', 'doc');
      // 9 > 8 → fell back to list, so no pipe-table divider row
      expect(out).not.toContain('| --- |');
      expect(out).toContain('- **c9:** 9');
    });

    test('task target enforces the 4-column limit', () => {
      const five: Table = {
        headers: ['c1', 'c2', 'c3', 'c4', 'c5'],
        rows: [['1', '2', '3', '4', '5']],
      };
      // 5 > 4 for a task → list fallback
      expect(renderTable(five, 'pipe', 'task')).not.toContain('| --- |');
      // but 4 columns is within the task limit → pipe renders
      const four: Table = {
        headers: ['c1', 'c2', 'c3', 'c4'],
        rows: [['1', '2', '3', '4']],
      };
      expect(renderTable(four, 'pipe', 'task')).toContain(
        '| --- | --- | --- | --- |'
      );
    });

    test('empty table renders nothing', () => {
      expect(renderTable({ headers: [], rows: [] }, 'list')).toBe('');
    });
  });

  test('section combines heading and body', () => {
    expect(section('Notes', '- one', 2)).toBe('## Notes\n\n- one');
  });

  test('assembleDocument joins blocks with single blank lines and a trailing newline', () => {
    const doc = assembleDocument([h2('A'), '- x', '', h2('B')]);
    expect(doc).toBe('## A\n\n- x\n\n## B\n');
  });
});
