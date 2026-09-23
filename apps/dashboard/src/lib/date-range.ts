import { z } from 'zod';

/**
 * A "yyyy-MM-dd" day that exists. The round trip rejects days like 2026-02-31,
 * which Date otherwise rolls over into March.
 */
const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((day) => {
    const date = new Date(`${day}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day);
  });

export interface DateRange {
  from?: Date;
  to?: Date;
}

/**
 * Parses the dashboard's `from`/`to` URL params as whole UTC days. The server
 * cannot know the viewer's time zone, so the window is UTC and labelled as such.
 * `to` is inclusive. A missing or invalid value leaves that side of the range open.
 */
export function parseDateRange(params: {
  from?: string;
  to?: string;
}): DateRange {
  const from = isoDay.safeParse(params.from);
  const to = isoDay.safeParse(params.to);
  return {
    from: from.success ? new Date(`${from.data}T00:00:00.000Z`) : undefined,
    to: to.success ? new Date(`${to.data}T23:59:59.999Z`) : undefined,
  };
}

/** "dd/mm/yyyy", matching how the date picker displays days. */
function formatUtcDay(date: Date): string {
  const [y, m, d] = date.toISOString().slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Human label for a range, or undefined when neither side is set. */
export function describeDateRange(range: DateRange): string | undefined {
  if (range.from && range.to) {
    return `${formatUtcDay(range.from)} – ${formatUtcDay(range.to)} (UTC)`;
  }
  if (range.from) return `from ${formatUtcDay(range.from)} (UTC)`;
  if (range.to) return `until ${formatUtcDay(range.to)} (UTC)`;
  return undefined;
}
