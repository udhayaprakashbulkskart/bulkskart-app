/**
 * Month-by-month counts for the dashboard charts, worked out from the rows a page already has the right to read
 * (for example the dates on a buyer's own requirements). Nothing is estimated: a month with no rows is a zero.
 */

export interface MonthSlot {
  key: string;
  /** "Jan", "Feb" … */
  label: string;
  /** The first moment of the month. */
  start: Date;
}

/** The last `count` months, oldest first; the last slot is the month `now` is in. */
export function lastMonths(count = 12, now: Date = new Date()): MonthSlot[] {
  const slots: MonthSlot[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - back, 1);
    slots.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      label: start.toLocaleDateString('en-US', { month: 'short' }),
      start,
    });
  }
  return slots;
}

/** How many of the dates fall in each month slot. Dates outside the slots, and empty or invalid ones, are skipped. */
export function bucketByMonth(dates: ReadonlyArray<string | null | undefined>, slots: MonthSlot[]): number[] {
  const counts = slots.map(() => 0);
  const index = new Map(slots.map((slot, i) => [slot.key, i] as const));
  for (const value of dates) {
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    const i = index.get(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    if (i !== undefined) counts[i] += 1;
  }
  return counts;
}

type DatedRows = { data: ReadonlyArray<{ created_at: string | null }> | null };

/** Runs one query for the rows created since the first slot and counts them per month. A failed query is an empty chart. */
export async function fetchMonthly(slots: MonthSlot[], run: (sinceIso: string) => PromiseLike<DatedRows>): Promise<number[]> {
  try {
    const { data } = await run(slots[0].start.toISOString());
    return bucketByMonth((data ?? []).map((row) => row.created_at), slots);
  } catch {
    return slots.map(() => 0);
  }
}

export function sum(values: ReadonlyArray<number>): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * The change from `previous` to `current` in percent, rounded to one decimal.
 * Null when there is nothing to compare with (a previous month of zero), so the page shows no arrow rather than an invented one.
 */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** A round upper bound for an axis, such as 10, 20, 50, 100, 200 … */
export function niceCeil(value: number): number {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  const fraction = value / power;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return step * power;
}

/** 1200 → "1.2k", 3_400_000 → "3.4M" */
export function compact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${+(value / 1_000).toFixed(1)}k`;
  return String(value);
}
