/**
 * Pure Razorpay pricing and signature helpers.
 * Safe to import from the Vite app and from edge functions.
 * Amounts are catalog prices. Callers must not pass a client-supplied total.
 */

export const PLAN_BASE_INR = {
  starter: 2500,
  business: 7500,
  growth: 15000,
} as const;

export const ADDON_BASE_INR = {
  ai_accessibility: 7500,
  flash_sell_24h: 5000,
} as const;

export const AUCTION_FEE_BASE_INR = 5000;

export const PROMO_BASE_INR: Record<'featured' | 'boost' | 'campaign', Record<7 | 15 | 30, number>> = {
  featured: { 7: 999, 15: 1799, 30: 2999 },
  boost: { 7: 799, 15: 1399, 30: 2299 },
  campaign: { 7: 1499, 15: 2499, 30: 3999 },
};

export const PLAN_LIMITS: Record<string, { max_products: number; max_rfq_leads: number }> = {
  starter: { max_products: 5, max_rfq_leads: 5 },
  business: { max_products: 50, max_rfq_leads: 50 },
  growth: { max_products: 999999, max_rfq_leads: 999999 },
  enterprise: { max_products: 999999, max_rfq_leads: 999999 },
};

export type BillingCycle = 'monthly' | 'annual' | 'one_time';
export type QuoteKind = 'subscription' | 'addon' | 'auction_fee' | 'promotion';

export interface PriceQuote {
  kind: QuoteKind;
  sku: string;
  label: string;
  billingCycle: BillingCycle;
  months: number;
  baseInr: number;
  gstInr: number;
  feeInr: number;
  totalInr: number;
  amountPaise: number;
  durationDays?: number;
  promotionType?: 'featured' | 'boost' | 'campaign';
}

const PLAN_LABELS: Record<keyof typeof PLAN_BASE_INR, string> = {
  starter: 'Starter Plan',
  business: 'Business Plan',
  growth: 'Growth Plan',
};

const ADDON_LABELS: Record<keyof typeof ADDON_BASE_INR, string> = {
  ai_accessibility: 'AI Accessibility Add-on',
  flash_sell_24h: '24 Hours Sell Products',
};

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function inrToPaise(amountInr: number): number {
  return Math.round(roundMoney(amountInr) * 100);
}

/** India checkout total: base + 18% GST + 2% gateway fee on the tax-inclusive subtotal. */
export function indiaSubscriptionTotal(baseInr: number): { baseInr: number; gstInr: number; feeInr: number; totalInr: number } {
  const base = roundMoney(baseInr);
  const gstInr = roundMoney(base * 0.18);
  const taxable = base + gstInr;
  const feeInr = roundMoney(taxable * 0.02);
  const totalInr = roundMoney(taxable + feeInr);
  return { baseInr: base, gstInr, feeInr, totalInr };
}

function quoteFromParts(input: {
  kind: QuoteKind;
  sku: string;
  label: string;
  billingCycle: BillingCycle;
  months: number;
  baseInr: number;
  gstInr: number;
  feeInr: number;
  totalInr: number;
  durationDays?: number;
  promotionType?: 'featured' | 'boost' | 'campaign';
}): PriceQuote {
  return { ...input, amountPaise: inrToPaise(input.totalInr) };
}

export function quotePlan(tier: string, cycle: string): PriceQuote | null {
  const sku = tier.trim().toLowerCase();
  if (!(sku in PLAN_BASE_INR)) return null;
  if (cycle !== 'monthly' && cycle !== 'annual') return null;
  const plan = sku as keyof typeof PLAN_BASE_INR;
  const billingCycle: BillingCycle = cycle === 'annual' ? 'annual' : 'monthly';
  const months = billingCycle === 'annual' ? 12 : 1;
  const priced = indiaSubscriptionTotal(PLAN_BASE_INR[plan] * months);
  return quoteFromParts({
    kind: 'subscription',
    sku: plan,
    label: PLAN_LABELS[plan],
    billingCycle,
    months,
    ...priced,
  });
}

export function quoteAddon(tier: string): PriceQuote | null {
  const sku = tier.trim().toLowerCase();
  const normalized = sku === 'ai_addon' || sku === 'addon_ai'
    ? 'ai_accessibility'
    : sku === 'flash_sell'
      ? 'flash_sell_24h'
      : sku;
  if (normalized !== 'ai_accessibility' && normalized !== 'flash_sell_24h') return null;
  const addon = normalized as keyof typeof ADDON_BASE_INR;
  const priced = indiaSubscriptionTotal(ADDON_BASE_INR[addon]);
  return quoteFromParts({
    kind: 'addon',
    sku: addon,
    label: ADDON_LABELS[addon],
    billingCycle: addon === 'ai_accessibility' ? 'monthly' : 'one_time',
    months: addon === 'ai_accessibility' ? 1 : 0,
    ...priced,
  });
}

/** Auction participation fee: ₹5,000 + 18% GST, no gateway surcharge. */
export function quoteAuctionFee(): PriceQuote {
  const baseInr = AUCTION_FEE_BASE_INR;
  const gstInr = Number((baseInr * 0.18).toFixed(2));
  const totalInr = Number((baseInr + gstInr).toFixed(2));
  return quoteFromParts({
    kind: 'auction_fee',
    sku: 'auction_fee',
    label: '24-Hour Auction Participation Fee',
    billingCycle: 'one_time',
    months: 0,
    baseInr,
    gstInr,
    feeInr: 0,
    totalInr,
  });
}

export function quotePromotion(promotionType: string, durationDays: number): PriceQuote | null {
  const type = promotionType.trim().toLowerCase();
  if (type !== 'featured' && type !== 'boost' && type !== 'campaign') return null;
  const days = durationDays as 7 | 15 | 30;
  const base = PROMO_BASE_INR[type][days];
  if (!base) return null;
  const gstInr = Math.round(base * 0.18);
  return quoteFromParts({
    kind: 'promotion',
    sku: `${type}_${days}`,
    label: type === 'featured' ? 'Featured Product' : type === 'boost' ? 'Boost Product' : 'Promotion Campaign',
    billingCycle: 'one_time',
    months: 0,
    baseInr: base,
    gstInr,
    feeInr: 0,
    totalInr: base + gstInr,
    durationDays: days,
    promotionType: type,
  });
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function buildRazorpayOrderBody(quote: PriceQuote, receipt: string, notes: Record<string, string>) {
  return {
    amount: quote.amountPaise,
    currency: 'INR' as const,
    receipt: receipt.slice(0, 40),
    notes,
  };
}

export function paiseFromInr(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function timingSafeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  const length = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return mismatch === 0;
}

export async function signCheckoutSignature(secret: string, orderId: string, paymentId: string): Promise<string> {
  return hmacSha256Hex(secret, `${orderId}|${paymentId}`);
}

export async function verifyCheckoutSignature(
  secret: string,
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = await signCheckoutSignature(secret, orderId, paymentId);
  return timingSafeEqual(expected, signature.trim().toLowerCase());
}

export async function verifyWebhookSignature(secret: string, rawBody: string, signature: string): Promise<boolean> {
  if (!secret || !rawBody || !signature) return false;
  const expected = await hmacSha256Hex(secret, rawBody);
  return timingSafeEqual(expected, signature.trim().toLowerCase());
}

export interface RazorpayPaymentCheck {
  id: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  status: string;
}

export function paymentMatchesOrder(payment: RazorpayPaymentCheck, orderId: string, expectedPaise: number): boolean {
  const status = payment.status.toLowerCase();
  if (status !== 'captured' && status !== 'authorized') return false;
  if (payment.orderId !== orderId) return false;
  if (payment.currency.toUpperCase() !== 'INR') return false;
  return payment.amountPaise === expectedPaise;
}

export interface WebhookPaymentEvent {
  event: string;
  orderId: string;
  paymentId: string;
  amountPaise: number;
  status: string;
  failed: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

export function parseWebhookEvent(body: unknown): WebhookPaymentEvent | null {
  const root = asRecord(body);
  if (!root || typeof root.event !== 'string') return null;
  const payload = asRecord(root.payload);
  const paymentEntity = asRecord(asRecord(payload?.payment)?.entity);
  const orderEntity = asRecord(asRecord(payload?.order)?.entity);
  const paymentId = typeof paymentEntity?.id === 'string' ? paymentEntity.id : '';
  const orderId = typeof paymentEntity?.order_id === 'string'
    ? paymentEntity.order_id
    : typeof orderEntity?.id === 'string'
      ? orderEntity.id
      : '';
  const amountPaise = Number(paymentEntity?.amount ?? orderEntity?.amount ?? 0);
  const status = typeof paymentEntity?.status === 'string'
    ? paymentEntity.status
    : typeof orderEntity?.status === 'string'
      ? orderEntity.status
      : '';
  if (!orderId) return null;
  return {
    event: root.event,
    orderId,
    paymentId,
    amountPaise: Number.isFinite(amountPaise) ? amountPaise : 0,
    status,
    failed: root.event === 'payment.failed' || status === 'failed',
  };
}

export function isActivationEvent(event: string): boolean {
  return event === 'payment.captured' || event === 'order.paid';
}
