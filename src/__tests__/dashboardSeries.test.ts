import { describe, expect, it, vi } from 'vitest';
import { bucketByMonth, compact, fetchMonthly, lastMonths, niceCeil, percentChange, sum } from '@/components/dashboard/series';

// 15 November 2026, midday, so no date below sits close to a month boundary in any time zone
const NOW = new Date(2026, 10, 15, 12);

describe('Dashboard charts: the months', () => {
  it('gives twelve months, oldest first, ending with the month it is now', () => {
    const slots = lastMonths(12, NOW);
    expect(slots).toHaveLength(12);
    expect(slots[0].key).toBe('2025-12');
    expect(slots[11].key).toBe('2026-11');
    expect(slots.map((slot) => slot.label)).toEqual(['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']);
  });

  it('counts back across the new year', () => {
    const slots = lastMonths(12, new Date(2026, 0, 20, 12));
    expect(slots[0].key).toBe('2025-02');
    expect(slots[10].key).toBe('2025-12');
    expect(slots[11].key).toBe('2026-01');
  });

  it('starts each month on its first day', () => {
    const [first] = lastMonths(12, NOW);
    expect(first.start.getDate()).toBe(1);
    expect(first.start.getMonth()).toBe(11);
  });
});

describe('Dashboard charts: counting rows per month', () => {
  const slots = lastMonths(12, NOW);

  it('counts the dates that fall in each month', () => {
    const counts = bucketByMonth(['2026-11-10T10:00:00Z', '2026-11-12T10:00:00Z', '2026-10-09T10:00:00Z', '2026-01-20T10:00:00Z'], slots);
    expect(counts).toHaveLength(12);
    expect(counts[11]).toBe(2);
    expect(counts[10]).toBe(1);
    expect(counts[1]).toBe(1);
    expect(sum(counts)).toBe(4);
  });

  it('leaves out dates that are empty, invalid or outside the twelve months', () => {
    const counts = bucketByMonth([null, undefined, '', 'not a date', '2024-03-10T10:00:00Z', '2027-03-10T10:00:00Z'], slots);
    expect(sum(counts)).toBe(0);
  });

  it('shows a month with no rows as a zero, never as a guess', () => {
    expect(bucketByMonth([], slots)).toEqual(Array(12).fill(0));
  });
});

describe('Dashboard charts: asking the database', () => {
  const slots = lastMonths(12, NOW);

  it('asks for the rows created since the first month and counts them', async () => {
    const run = vi.fn(async () => ({ data: [{ created_at: '2026-11-03T10:00:00Z' }, { created_at: '2026-09-03T10:00:00Z' }] }));
    const counts = await fetchMonthly(slots, run);
    expect(run).toHaveBeenCalledWith(slots[0].start.toISOString());
    expect(counts[11]).toBe(1);
    expect(counts[9]).toBe(1);
  });

  it('treats a query that fails as an empty chart', async () => {
    const counts = await fetchMonthly(slots, async () => {
      throw new Error('network');
    });
    expect(counts).toEqual(Array(12).fill(0));
  });

  it('treats no rows at all as an empty chart', async () => {
    expect(await fetchMonthly(slots, async () => ({ data: null }))).toEqual(Array(12).fill(0));
  });
});

describe('Dashboard charts: changes and axis numbers', () => {
  it('works out the change in percent, to one decimal', () => {
    expect(percentChange(12, 8)).toBe(50);
    expect(percentChange(3, 4)).toBe(-25);
    expect(percentChange(1, 3)).toBe(-66.7);
    expect(percentChange(4, 4)).toBe(0);
  });

  it('gives no change when there is nothing to compare with', () => {
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });

  it('rounds the top of an axis up to a round number', () => {
    expect(niceCeil(0)).toBe(4);
    expect(niceCeil(3)).toBe(4);
    expect(niceCeil(7)).toBe(10);
    expect(niceCeil(12)).toBe(20);
    expect(niceCeil(23)).toBe(25);
    expect(niceCeil(41)).toBe(50);
    expect(niceCeil(87)).toBe(100);
    expect(niceCeil(1234)).toBe(2000);
  });

  it('writes big numbers short', () => {
    expect(compact(999)).toBe('999');
    expect(compact(1000)).toBe('1k');
    expect(compact(1200)).toBe('1.2k');
    expect(compact(3_400_000)).toBe('3.4M');
  });
});
