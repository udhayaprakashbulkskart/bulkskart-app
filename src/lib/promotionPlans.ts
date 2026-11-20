/**
 * Product promotion prices (rupees before GST). The payment server keeps the same table in
 * supabase/functions/razorpay-create-order/pricing.ts and charges from it; serverPricing.test.ts checks they agree.
 */
export type PromotionType = 'featured' | 'boost' | 'campaign';
export type DurationDays = 7 | 15 | 30;

export interface PlanOption {
  days: DurationDays;
  label: string;
  /** INR, before GST */
  basePrice: number;
}

export const PROMOTION_PLANS: Record<PromotionType, PlanOption[]> = {
  featured: [
    { days: 7, label: '7 Days', basePrice: 999 },
    { days: 15, label: '15 Days', basePrice: 1799 },
    { days: 30, label: '30 Days', basePrice: 2999 },
  ],
  boost: [
    { days: 7, label: '7 Days', basePrice: 799 },
    { days: 15, label: '15 Days', basePrice: 1399 },
    { days: 30, label: '30 Days', basePrice: 2299 },
  ],
  campaign: [
    { days: 7, label: '7 Days', basePrice: 1499 },
    { days: 15, label: '15 Days', basePrice: 2499 },
    { days: 30, label: '30 Days', basePrice: 3999 },
  ],
};

/** GST on a promotion, rounded to the rupee, and the total to pay. */
export function promotionTotal(basePrice: number): { gst: number; total: number } {
  const gst = Math.round(basePrice * 0.18);
  return { gst, total: basePrice + gst };
}
