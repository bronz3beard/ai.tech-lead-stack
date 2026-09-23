import { describeDateRange, parseDateRange } from '../date-range';

describe('parseDateRange', () => {
  it('spans whole UTC days with an inclusive end', () => {
    const range = parseDateRange({ from: '2026-09-01', to: '2026-09-23' });

    expect(range.from?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(range.to?.toISOString()).toBe('2026-09-23T23:59:59.999Z');
  });

  it('leaves the range open when params are missing', () => {
    expect(parseDateRange({})).toEqual({ from: undefined, to: undefined });
  });

  it('drops malformed and impossible days instead of rolling them over', () => {
    const range = parseDateRange({ from: '01/09/2026', to: '2026-02-31' });

    expect(range).toEqual({ from: undefined, to: undefined });
  });
});

describe('describeDateRange', () => {
  it('labels a closed range in the picker display format', () => {
    const range = parseDateRange({ from: '2026-09-01', to: '2026-09-23' });

    expect(describeDateRange(range)).toBe('01/09/2026 – 23/09/2026 (UTC)');
  });

  it('labels an open-ended range', () => {
    expect(describeDateRange(parseDateRange({ from: '2026-09-01' }))).toBe(
      'from 01/09/2026 (UTC)'
    );
    expect(describeDateRange(parseDateRange({ to: '2026-09-23' }))).toBe(
      'until 23/09/2026 (UTC)'
    );
  });

  it('returns undefined when no range is set', () => {
    expect(describeDateRange({})).toBeUndefined();
  });
});
