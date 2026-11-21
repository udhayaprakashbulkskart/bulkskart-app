import { describe, expect, it } from 'vitest';
import { withoutOutsideOrDemoRfqs } from '@/lib/rfqSources';
import { isSeededRequirement } from '@/lib/seedData';

describe('Live RFQ: tender imports and feed-filler rows are left out in the database query', () => {
  it('adds a GeM filter and a feed-filler filter, both keeping rows without a description', () => {
    const calls: string[] = [];
    const query = { or(filters: string) { calls.push(filters); return query; } };
    expect(withoutOutsideOrDemoRfqs(query)).toBe(query);
    expect(calls).toEqual([
      'description.is.null,description.not.like.*GeM*',
      'description.is.null,description.not.ilike.*seeded for BulkSkart production RFQ feed*',
    ]);
  });

  it('treats feed-filler RFQs as demo data on the page too', () => {
    expect(isSeededRequirement({
      title: 'Fe 550D TMT Steel Rebar (8mm to 32mm Assorted) — Lot 4',
      description: 'Live buying requirement seeded for BulkSkart production RFQ feed. Looking for verified manufacturers with competitive bulk pricing and reliable lead times.',
    })).toBe(true);
    expect(isSeededRequirement({ title: 'Texiles', description: 'Dear Sir, We are interested to buy your products in large quantity.' })).toBe(false);
  });
});
