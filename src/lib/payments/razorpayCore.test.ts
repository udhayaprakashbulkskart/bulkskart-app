// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { COUNTRIES, calculateCountryPricing } from '@/lib/countryConfig';
import { readFunctionFailure, shouldRetryOrder } from '@/lib/payments/checkoutClient';
import {
  buildRazorpayOrderBody,
  isActivationEvent,
  parseWebhookEvent,
  paymentMatchesOrder,
  quoteAddon,
  quoteAuctionFee,
  quotePlan,
  quotePromotion,
  signCheckoutSignature,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from '@/lib/payments/razorpayCore';

describe('catalog prices', () => {
  it('charges the India pricing-page total for starter, business, and growth', () => {
    const cases = [
      ['starter', 2500],
      ['business', 7500],
      ['growth', 15000],
    ] as const;
    for (const [tier, base] of cases) {
      const quote = quotePlan(tier, 'monthly');
      const ui = calculateCountryPricing(base, COUNTRIES.IN);
      expect(quote?.totalInr).toBe(ui.totalPayable);
      expect(quote?.amountPaise).toBe(Math.round(ui.totalPayable * 100));
    }
  });

  it('does not let a caller choose the amount', () => {
    const quote = quotePlan('starter', 'monthly');
    expect(quote?.amountPaise).toBe(300900);
    const body = buildRazorpayOrderBody(quote!, 'sub_1', { sku: 'starter' });
    expect(body.amount).toBe(300900);
    expect(body.currency).toBe('INR');
    expect(quotePlan('enterprise', 'monthly')).toBeNull();
    expect(quotePlan('starter', 'weekly')).toBeNull();
  });

  it('prices add-ons, promotions, and the auction fee from the catalog', () => {
    expect(quoteAddon('ai_accessibility')?.totalInr).toBe(calculateCountryPricing(7500, COUNTRIES.IN).totalPayable);
    expect(quoteAddon('flash_sell_24h')?.amountPaise).toBe(601800);
    expect(quotePromotion('featured', 7)?.totalInr).toBe(999 + Math.round(999 * 0.18));
    expect(quotePromotion('boost', 14)).toBeNull();
    expect(quoteAuctionFee().totalInr).toBe(5900);
    expect(quoteAuctionFee().amountPaise).toBe(590000);
  });
});

describe('signatures', () => {
  it('verifies Razorpay checkout and webhook signatures and rejects tampering', async () => {
    const checkout = await signCheckoutSignature('key_secret_example', 'order_TEST', 'pay_TEST');
    expect(checkout).toBe('385afd832d2ab9d1170917085d60b4257de133f903bab06387b2dddd38badca9');
    expect(await verifyCheckoutSignature('key_secret_example', 'order_TEST', 'pay_TEST', checkout)).toBe(true);
    expect(await verifyCheckoutSignature('key_secret_example', 'order_TEST', 'pay_OTHER', checkout)).toBe(false);
    expect(await verifyCheckoutSignature('other_secret', 'order_TEST', 'pay_TEST', checkout)).toBe(false);

    const raw = '{"event":"payment.captured"}';
    const webhook = 'fc8f4fc49e03523aef269496dbe549174e12573e0178163d82d8982d7f95d43e';
    expect(await verifyWebhookSignature('whsec_example', raw, webhook)).toBe(true);
    expect(await verifyWebhookSignature('whsec_example', `${raw} `, webhook)).toBe(false);
    expect(await verifyWebhookSignature('', raw, webhook)).toBe(false);
  });
});

describe('webhook events', () => {
  it('reads captured, paid, and failed payloads', () => {
    expect(isActivationEvent('payment.captured')).toBe(true);
    expect(isActivationEvent('order.paid')).toBe(true);
    expect(isActivationEvent('subscription.charged')).toBe(false);

    const captured = parseWebhookEvent({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', amount: 300900, status: 'captured' } } },
    });
    expect(captured).toMatchObject({ orderId: 'order_1', paymentId: 'pay_1', amountPaise: 300900, failed: false });
    expect(paymentMatchesOrder({
      id: 'pay_1',
      orderId: 'order_1',
      amountPaise: 300900,
      currency: 'INR',
      status: 'captured',
    }, 'order_1', 300900)).toBe(true);
    expect(paymentMatchesOrder({
      id: 'pay_1',
      orderId: 'order_1',
      amountPaise: 100,
      currency: 'INR',
      status: 'captured',
    }, 'order_1', 300900)).toBe(false);

    const failed = parseWebhookEvent({
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_2', order_id: 'order_2', amount: 590000, status: 'failed' } } },
    });
    expect(failed?.failed).toBe(true);
  });
});

describe('checkout errors', () => {
  it('reads the edge function error body and does not retry a missing-key response', async () => {
    const response = new Response(JSON.stringify({
      error: 'Payment gateway is not configured. Please contact support.',
      code: 'RAZORPAY_KEYS_MISSING',
    }), { status: 503 });
    const failure = await readFunctionFailure({ message: 'Edge Function returned a non-2xx status code', context: response }, null);
    expect(failure.code).toBe('RAZORPAY_KEYS_MISSING');
    expect(failure.message).toContain('not configured');
    expect(shouldRetryOrder(failure)).toBe(false);
    expect(shouldRetryOrder({ message: 'bad gateway', status: 502 })).toBe(true);
    expect(shouldRetryOrder({ message: 'unauthorized', status: 401 })).toBe(false);
  });
});
