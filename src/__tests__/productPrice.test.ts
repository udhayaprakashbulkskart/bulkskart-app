import { describe, expect, it } from 'vitest';
import { convertAmount, formatMoney, formatPriceRange, priceInCurrency, productCurrency } from '@/lib/productPrice';

const RATES = { INR: 83.5, EUR: 0.92 };

describe('product prices', () => {
  it('reads a stored currency, and treats a missing one as rupees (the database default)', () => {
    expect(productCurrency('inr')).toBe('INR');
    expect(productCurrency('₹')).toBe('INR');
    expect(productCurrency(null)).toBe('INR');
    expect(productCurrency('$')).toBe('USD');
    expect(productCurrency('EUR')).toBe('EUR');
  });

  it('never treats a small rupee price as dollars', () => {
    expect(priceInCurrency(450, 'INR', 'INR', RATES)).toEqual({ amount: 450, currency: 'INR', approximate: false });
    expect(formatPriceRange(450, 600, 'INR', 'INR', RATES)).toBe('₹450 – ₹600');
  });

  it('converts between known currencies and marks the result as approximate', () => {
    expect(convertAmount(10, 'USD', 'INR', RATES)).toBeCloseTo(835);
    const shown = priceInCurrency(10, 'USD', 'INR', RATES);
    expect(shown).toMatchObject({ currency: 'INR', approximate: true });
    expect(formatMoney(shown as NonNullable<typeof shown>)).toBe('≈ ₹835');
    expect(formatPriceRange(450, null, 'INR', 'USD', RATES)).toBe('≈ $5.39+');
  });

  it('keeps a price in its own currency when a rate is unknown', () => {
    expect(priceInCurrency(12, 'XYZ', 'INR', RATES)).toEqual({ amount: 12, currency: 'XYZ', approximate: false });
  });

  it('says "Price on request" rather than inventing a price', () => {
    expect(formatPriceRange(null, null, 'INR', 'INR')).toBe('Price on request');
    expect(formatPriceRange(0, undefined, 'USD', 'INR')).toBe('Price on request');
  });

  it('writes large rupee amounts compactly when asked', () => {
    expect(formatMoney({ amount: 1377750, currency: 'INR', approximate: false })).toBe('₹13,77,750');
    expect(formatMoney({ amount: 1377750, currency: 'INR', approximate: false }, { compact: true })).toBe('₹13.8L');
    expect(formatMoney({ amount: 25000000, currency: 'INR', approximate: false }, { compact: true })).toBe('₹2.5Cr');
    expect(formatMoney({ amount: 12000, currency: 'INR', approximate: false }, { compact: true })).toBe('₹12K');
  });
});
