/**
 * Product prices, shown honestly.
 *
 * A price is in the currency it was saved with. Every product row has one (the database fills in rupees when none is
 * given, and the supplier form starts in rupees), so a price without a currency is rupees. Nothing is guessed from
 * the size of the number. A price is converted to the visitor's currency only when both rates are known, and a
 * converted price is marked as approximate ("≈").
 */

/** Units per US dollar used until live rates arrive (the same fallbacks as the currency context). */
const FALLBACK_PER_USD: Record<string, number> = {
  USD: 1,
  INR: 83.5,
  GBP: 0.79,
  EUR: 0.92,
  AED: 3.67,
  JPY: 149,
  CNY: 7.2,
  AUD: 1.53,
  CAD: 1.36,
  SGD: 1.34,
};

/** The ISO code of a stored currency ("₹" and empty mean rupees). */
export function productCurrency(raw?: string | null): string {
  const code = (raw ?? '').trim().toUpperCase();
  if (!code || code === '₹' || code === 'RS' || code === 'RS.') return 'INR';
  if (code === '$' || code === 'US$') return 'USD';
  if (code === '€') return 'EUR';
  if (code === '£') return 'GBP';
  return code;
}

function perUsd(code: string, rates?: Record<string, number>): number | undefined {
  const live = rates?.[code];
  return live && live > 0 ? live : FALLBACK_PER_USD[code];
}

/** An amount in another currency, or null when a rate is unknown. `rates` are units per US dollar. */
export function convertAmount(amount: number, from: string, to: string, rates?: Record<string, number>): number | null {
  if (from === to) return amount;
  const fromRate = perUsd(from, rates);
  const toRate = perUsd(to, rates);
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}

export interface ShownPrice {
  amount: number;
  currency: string;
  /** converted from another currency, so only roughly the supplier's price */
  approximate: boolean;
}

/** A stored price as the visitor sees it: in their currency when it can be converted, otherwise in its own. */
export function priceInCurrency(
  amount: number | null | undefined,
  storedCurrency: string | null | undefined,
  visitorCurrency: string,
  rates?: Record<string, number>,
): ShownPrice | null {
  if (amount === null || amount === undefined) return null;
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return null;
  const from = productCurrency(storedCurrency);
  const to = productCurrency(visitorCurrency);
  const converted = convertAmount(value, from, to, rates);
  if (converted === null) return { amount: value, currency: from, approximate: false };
  return { amount: converted, currency: to, approximate: from !== to };
}

function compactRupees(amount: number): string {
  const short = (value: number, suffix: string) => `₹${Number.isInteger(Number(value.toFixed(1))) ? value.toFixed(0) : value.toFixed(1)}${suffix}`;
  if (amount >= 1e7) return short(amount / 1e7, 'Cr');
  if (amount >= 1e5) return short(amount / 1e5, 'L');
  return short(amount / 1e3, 'K');
}

/** "₹13,77,750", "$12.5", "≈ ₹1,044"; `compact` writes large rupee amounts as K, L and Cr. */
export function formatMoney(price: ShownPrice, { compact = false }: { compact?: boolean } = {}): string {
  const { amount, currency, approximate } = price;
  const prefix = approximate ? '≈ ' : '';
  if (compact && currency === 'INR' && amount >= 1000) return prefix + compactRupees(amount);
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const digits = amount >= 100 || currency === 'JPY' ? 0 : 2;
  try {
    return (
      prefix +
      new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: digits }).format(amount)
    );
  } catch {
    return `${prefix}${currency} ${amount.toLocaleString(locale, { maximumFractionDigits: digits })}`;
  }
}

/** "₹450 – ₹600", "$12+" (a starting price), or "Price on request" when the supplier gave none. */
export function formatPriceRange(
  min: number | null | undefined,
  max: number | null | undefined,
  storedCurrency: string | null | undefined,
  visitorCurrency: string,
  rates?: Record<string, number>,
  { compact = false, openEnded = true }: { compact?: boolean; openEnded?: boolean } = {},
): string {
  const low = priceInCurrency(min, storedCurrency, visitorCurrency, rates);
  const high = priceInCurrency(max, storedCurrency, visitorCurrency, rates);
  if (!low && !high) return 'Price on request';
  if (low && high && Math.round(high.amount) !== Math.round(low.amount)) {
    return `${formatMoney(low, { compact })} – ${formatMoney({ ...high, approximate: false }, { compact })}`;
  }
  const one = (low ?? high) as ShownPrice;
  return `${formatMoney(one, { compact })}${openEnded && low && !high ? '+' : ''}`;
}
