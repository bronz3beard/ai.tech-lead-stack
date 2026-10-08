/** Pure, client-safe time bucketing for dashboard series. All buckets are UTC and year-qualified. */

export interface CountPoint {
  /** ISO date (YYYY-MM-DD, UTC) of the day or of the week's Monday. */
  name: string;
  total: number;
}

export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday (UTC) of the ISO week containing `d`. */
export function utcWeekStart(d: Date): string {
  const day = d.getUTCDay(); // 0 = Sunday
  const offset = day === 0 ? -6 : 1 - day;
  return utcDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offset)));
}

/** Sums values into sorted, year-qualified buckets. */
export function bucketSum(
  rows: { at: Date; value: number }[],
  keyOf: (d: Date) => string
): CountPoint[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const key = keyOf(r.at);
    totals.set(key, (totals.get(key) ?? 0) + r.value);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, total]) => ({ name, total }));
}
