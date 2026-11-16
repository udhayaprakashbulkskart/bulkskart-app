/**
 * What the server charges. The pages show the same figures, but only these decide what a Razorpay order costs:
 * an amount sent by the browser is never used.
 *
 * Keep in step with the pages: src/lib/countryConfig.ts (plans, India) with calculateCountryPricing,
 * src/lib/promotionPlans.ts (product promotions) and src/lib/countryTaxConfig.ts (auction posting fee).
 * src/__tests__/serverPricing.test.ts fails when they drift apart.
 *
 * No imports, so the same file runs in the edge function (Deno) and in the tests (Node).
 */

export const GST_RATE = 0.18;
/** the gateway fee the pricing pages add on top of plan prices for Indian billing */
export const GATEWAY_FEE_RATE = 0.02;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Plans and add-ons: base + 18% GST, plus the 2% gateway fee on that total. */
export function planTotalInr(base: number): number {
  const tax = round2(base * GST_RATE);
  const subtotal = base + tax;
  const fee = round2(subtotal * GATEWAY_FEE_RATE);
  return round2(subtotal + fee);
}

/** Monthly plan prices in rupees before tax. Enterprise is priced by talking to us, so it cannot be bought online. */
export const PLAN_BASE_INR: Record<string, number> = {
  starter: 2500,
  business: 7500,
  growth: 15000,
};

export const ADDON_BASE_INR: Record<string, number> = {
  ai_accessibility: 7500,
  flash_sell_24h: 5000,
};

const TIER_ALIASES: Record<string, string> = {
  ai_addon: 'ai_accessibility',
  addon_ai: 'ai_accessibility',
  flash_sell: 'flash_sell_24h',
};

export interface SubscriptionPrice {
  tier: string;
  label: string;
  billingCycle: 'monthly' | 'one_time';
  baseInr: number;
  totalInr: number;
}

/** The price of a plan or add-on, or null for anything that cannot be bought online. */
export function subscriptionPrice(rawTier: unknown): SubscriptionPrice | null {
  const asked = String(rawTier ?? '').trim().toLowerCase();
  const tier = TIER_ALIASES[asked] ?? asked;
  if (tier in PLAN_BASE_INR) {
    const base = PLAN_BASE_INR[tier];
    return { tier, label: `${tier[0].toUpperCase()}${tier.slice(1)} Plan`, billingCycle: 'monthly', baseInr: base, totalInr: planTotalInr(base) };
  }
  if (tier === 'ai_accessibility') {
    const base = ADDON_BASE_INR[tier];
    return { tier, label: 'AI Accessibility Add-on', billingCycle: 'monthly', baseInr: base, totalInr: planTotalInr(base) };
  }
  if (tier === 'flash_sell_24h') {
    const base = ADDON_BASE_INR[tier];
    return { tier, label: '24 Hours Sell Products', billingCycle: 'one_time', baseInr: base, totalInr: planTotalInr(base) };
  }
  return null;
}

/** Product promotion prices in rupees before GST, by type and number of days. */
export const PROMOTION_BASE_INR: Record<string, Record<number, number>> = {
  featured: { 7: 999, 15: 1799, 30: 2999 },
  boost: { 7: 799, 15: 1399, 30: 2299 },
  campaign: { 7: 1499, 15: 2499, 30: 3999 },
};

/** Promotions: base + 18% GST rounded to the rupee, as the promote dialog shows. */
export function promotionPrice(rawType: unknown, rawDays: unknown): { type: string; days: number; baseInr: number; gstInr: number; totalInr: number } | null {
  const type = String(rawType ?? '').trim().toLowerCase();
  const days = Number(rawDays);
  const base = PROMOTION_BASE_INR[type]?.[days];
  if (!base) return null;
  const gst = Math.round(base * GST_RATE);
  return { type, days, baseInr: base, gstInr: gst, totalInr: base + gst };
}

/** The auction posting fee for Indian billing: ₹5,000 + 18% GST. */
export const AUCTION_FEE_BASE_INR = 5000;

export function auctionFeeTotalInr(): number {
  return round2(AUCTION_FEE_BASE_INR + round2(AUCTION_FEE_BASE_INR * GST_RATE));
}
