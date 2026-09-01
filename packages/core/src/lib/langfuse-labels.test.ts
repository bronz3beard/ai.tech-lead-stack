import { langfuseLabel } from '../langfuse-labels';

describe('langfuseLabel', () => {
  it('returns trimmed string for non-empty input', () => {
    expect(langfuseLabel('  gpt-4o  ')).toBe('gpt-4o');
  });

  it('returns unknown for undefined, empty, or whitespace', () => {
    expect(langfuseLabel(undefined)).toBe('unknown');
    expect(langfuseLabel('')).toBe('unknown');
    expect(langfuseLabel('   ')).toBe('unknown');
  });

  it('returns unknown for non-string values', () => {
    expect(langfuseLabel(42)).toBe('unknown');
    expect(langfuseLabel({})).toBe('unknown');
  });
});
