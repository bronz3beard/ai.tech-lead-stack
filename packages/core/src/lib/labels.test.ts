import { displayLabel } from './labels';

describe('displayLabel', () => {
  it('returns trimmed string for non-empty input', () => {
    expect(displayLabel('  gpt-5.6-terra  ')).toBe('gpt-5.6-terra');
  });

  it('returns unknown for undefined, empty, or whitespace', () => {
    expect(displayLabel(undefined)).toBe('unknown');
    expect(displayLabel('')).toBe('unknown');
    expect(displayLabel('   ')).toBe('unknown');
  });

  it('returns unknown for non-string values', () => {
    expect(displayLabel(42)).toBe('unknown');
    expect(displayLabel({})).toBe('unknown');
  });
});
