import { bucketSum, utcDay, utcWeekStart } from '../time-buckets';

describe('time buckets', () => {
  it('names days by UTC ISO date, so the same day in two years never collides', () => {
    expect(utcDay(new Date('2025-10-08T23:30:00Z'))).toBe('2025-10-08');
    expect(utcDay(new Date('2026-10-08T00:10:00Z'))).toBe('2026-10-08');
  });

  it('starts weeks on the UTC Monday', () => {
    expect(utcWeekStart(new Date('2026-10-08T12:00:00Z'))).toBe('2026-10-05'); // Thursday
    expect(utcWeekStart(new Date('2026-10-11T23:59:00Z'))).toBe('2026-10-05'); // Sunday
    expect(utcWeekStart(new Date('2026-10-05T00:00:00Z'))).toBe('2026-10-05'); // Monday
    expect(utcWeekStart(new Date('2027-01-01T00:00:00Z'))).toBe('2026-12-28'); // across a year
  });

  it('sums into chronologically sorted buckets regardless of input order', () => {
    const points = bucketSum(
      [
        { at: new Date('2026-10-08T10:00:00Z'), value: 1 },
        { at: new Date('2025-10-08T10:00:00Z'), value: 2 },
        { at: new Date('2026-10-08T11:00:00Z'), value: 3 },
      ],
      utcDay
    );

    expect(points).toEqual([
      { name: '2025-10-08', total: 2 },
      { name: '2026-10-08', total: 4 },
    ]);
  });
});
