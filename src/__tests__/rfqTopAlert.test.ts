import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CYCLE_MS, NO_RFQ_ALERT_PATHS, VISIBLE_MS, isNewRfq, rfqAlertsOff, rfqBudget, rfqQuantity, setRfqAlertsOff, singularUnit, usableLeads,
} from '@/lib/rfqAlerts';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('"New RFQ Posted!" popup', () => {
  it('shows one every 10 seconds, each for a few seconds', () => {
    expect(CYCLE_MS).toBe(10_000);
    expect(VISIBLE_MS).toBeLessThan(CYCLE_MS);
  });

  it('reads quantity and the per-unit budget from the RFQ, as in the design', () => {
    expect(rfqQuantity({ quantity: 50, quantity_unit: 'Pieces' })).toBe('50 Pieces');
    // no "/ Piece": a ₹30 lakh budget for 50,000 pipes is for the order, not per pipe
    expect(rfqBudget({ budget_min: 2250000, budget_max: 3000000, currency: 'INR' })).toBe('up to ₹30,00,000');
    expect(rfqBudget({ budget_min: 180, budget_max: null, currency: 'INR' })).toBe('up to ₹180');
    expect(rfqBudget({ budget_min: null, budget_max: null, currency: 'INR' })).toBeNull();
    expect(singularUnit('Kg')).toBe('Kg');
    expect(singularUnit('')).toBe('Unit');
  });

  it('says "New RFQ Posted!" only for RFQs from the last two days', () => {
    const now = Date.parse('2026-11-20T12:00:00Z');
    expect(isNewRfq('2026-11-20T10:00:00Z', now)).toBe(true);
    expect(isNewRfq('2026-11-17T10:00:00Z', now)).toBe(false);
  });

  it('never shows tender-portal listings, template rows or test titles', () => {
    const base = { description: null, specifications: null, quantity: 1, quantity_unit: 'Pieces', budget_min: null, budget_max: null, currency: 'INR', created_at: null };
    const kept = usableLeads([
      { ...base, id: '1', title: 'Commercial Deep Fryer' },
      { ...base, id: '2', title: 'Supply of LED lights (GeM tender)', description: 'Bid on https://gem.gov.in/bid/1' },
      { ...base, id: '3', title: 'Test RFQ please ignore' },
      { ...base, id: '4', title: 'Commercial deep fryer' },
    ]);
    expect(kept.map((r) => r.id)).toEqual(['1']);
  });

  it('can be hidden and turned back on, and stays off sign-in and payment pages', () => {
    setRfqAlertsOff(true);
    expect(rfqAlertsOff()).toBe(true);
    setRfqAlertsOff(false);
    expect(rfqAlertsOff()).toBe(false);
    for (const path of ['/auth', '/post-requirement', '/checkout/1', '/dashboard/supplier/settings', '/supplier-map']) expect(NO_RFQ_ALERT_PATHS.test(path), path).toBe(true);
    for (const path of ['/', '/products', '/requirements', '/dashboard/supplier']) expect(NO_RFQ_ALERT_PATHS.test(path), path).toBe(false);
    const feed = src('src/components/common/LiveRequirementsFeed.tsx');
    // hidden from the popup itself; the Live RFQ section offers to turn them back on
    expect(feed).toContain('{alertsOff && (');
    expect(feed).toContain('onClick={() => setRfqAlertsOff(false)}');
    expect(feed).toContain('Turn on RFQ alerts');
  });

  it('sits at the top of every page in place of the old bottom buyer alert', () => {
    const app = src('src/App.tsx');
    expect(app).toContain('<RfqTopAlert />');
    expect(app).not.toContain('<LiveBuyerOrderAlert />');
    const alert = src('src/components/common/RfqTopAlert.tsx');
    for (const text of ["'New RFQ Posted!'", 'View RFQ', 'Hide alerts', 'Qty: {quantity}', 'Budget:', 'aria-label="Close"']) expect(alert).toContain(text);
    expect(alert).toContain('navigate(`/requirement/${current.id}`)');
  });
});
