import { describe, expect, it } from 'vitest';
import {
  auctionFeeTotalInr,
  PLAN_BASE_INR,
  PROMOTION_BASE_INR,
  promotionPrice,
  subscriptionPrice,
} from '../../supabase/functions/razorpay-create-order/pricing';
import { COUNTRIES, calculateCountryPricing } from '@/lib/countryConfig';
import { calculateSubscriptionBill } from '@/lib/countryTaxConfig';
import { PROMOTION_PLANS, promotionTotal } from '@/lib/promotionPlans';

/** The payment server charges from its own table; these checks keep it equal to what the pages show (India). */
describe('server prices match the prices on the pages', () => {
  it('plans: base + GST + gateway fee, as the pricing and subscription pages show', () => {
    for (const tier of ['starter', 'business', 'growth'] as const) {
      expect(PLAN_BASE_INR[tier]).toBe(COUNTRIES.IN.plans[tier]);
      expect(subscriptionPrice(tier)?.totalInr).toBe(calculateCountryPricing(COUNTRIES.IN.plans[tier], COUNTRIES.IN).totalPayable);
    }
    expect(subscriptionPrice('starter')?.totalInr).toBe(3009);
  });

  it('add-ons are priced like the subscription page shows them', () => {
    expect(subscriptionPrice('ai_accessibility')?.totalInr).toBe(calculateCountryPricing(7500, COUNTRIES.IN).totalPayable);
    expect(subscriptionPrice('flash_sell_24h')).toMatchObject({ billingCycle: 'one_time', totalInr: calculateCountryPricing(5000, COUNTRIES.IN).totalPayable });
    expect(subscriptionPrice('ai_addon')?.tier).toBe('ai_accessibility');
  });

  it('refuses plans that cannot be bought online, whatever the browser asks', () => {
    expect(subscriptionPrice('enterprise')).toBeNull();
    expect(subscriptionPrice('free')).toBeNull();
    expect(subscriptionPrice(undefined)).toBeNull();
  });

  it('promotions: the same table and GST as the promote dialog', () => {
    for (const [type, plans] of Object.entries(PROMOTION_PLANS)) {
      for (const plan of plans) {
        expect(PROMOTION_BASE_INR[type][plan.days]).toBe(plan.basePrice);
        expect(promotionPrice(type, plan.days)?.totalInr).toBe(promotionTotal(plan.basePrice).total);
      }
    }
    expect(promotionPrice('featured', 7)?.totalInr).toBe(1179);
    expect(promotionPrice('featured', 3)).toBeNull();
    expect(promotionPrice('gold', 7)).toBeNull();
  });

  it('auction posting fee: ₹5,000 + 18% GST, as the auction dialog shows', () => {
    expect(auctionFeeTotalInr()).toBe(calculateSubscriptionBill('IN').totalAmount);
    expect(auctionFeeTotalInr()).toBe(5900);
  });
});
