import type { CountryConfig } from '@/lib/countryConfig';

/**
 * The supplier plans, in one place: the Subscription page in the dashboard and the sign-up both show these, so a
 * plan is described, priced and paid for the same way wherever it is offered.
 */
export interface SubscriptionPlan {
  tier: string;
  label: string;
  /** the monthly fee in the country's own currency, before tax; null when the plan is priced by talking to us */
  basePrice: number | null;
  priceInr: number | null;
  priceDisplay: string;
  tagline: string;
  features: string[];
  highlight: string;
  popular: boolean;
  enterprise: boolean;
}

export function buildPlans(country: CountryConfig, formatPrice: (amount: number) => string): SubscriptionPlan[] {
  const inr = (base: number) => Math.round(base * (country.currency === 'INR' ? 1 : 83.5));
  return [
    {
      tier: 'starter',
      label: 'Starter',
      basePrice: country.plans.starter,
      priceInr: inr(country.plans.starter),
      priceDisplay: formatPrice(country.plans.starter),
      tagline: 'Perfect for new suppliers — allows only 5 post responses',
      highlight: '5 RFQ responses / month (Strict Limit)',
      features: ['5 product listings', '5 Post / RFQ responses / month (Strict)', 'Direct buyer messaging (within 5 quotes)', 'Standard directory visibility', 'Email support', 'Basic analytics'],
      popular: false,
      enterprise: false,
    },
    {
      tier: 'business',
      label: 'Business',
      basePrice: country.plans.business,
      priceInr: inr(country.plans.business),
      priceDisplay: formatPrice(country.plans.business),
      tagline: 'Most popular for growing businesses — 50 post responses + AI accessibility',
      highlight: '50 RFQ responses/mo + AI Accessibility',
      features: ['Full AI Accessibility Suite included', 'AI Product Matching (94%+ Spec Match)', '1-Click AI Quotation Generator', '50 Post / RFQ responses / month', 'Send Quotations to Live RFQs', '50 product listings', 'Priority visibility', 'Verified supplier badge', 'Priority chat support'],
      popular: true,
      enterprise: false,
    },
    {
      tier: 'growth',
      label: 'Growth',
      basePrice: country.plans.growth,
      priceInr: inr(country.plans.growth),
      priceDisplay: formatPrice(country.plans.growth),
      tagline: 'For high-volume exporters — UNLIMITED post responses',
      highlight: 'UNLIMITED responses (No lead limits)',
      features: ['UNLIMITED Post / RFQ responses', 'Full AI Accessibility Suite included', 'Unlimited product listings', 'Top visibility ranking', 'Featured in categories', 'Advanced analytics & export trends', '3 team members', 'VIP Phone & WhatsApp support', 'Priority badge'],
      popular: false,
      enterprise: false,
    },
    {
      tier: 'enterprise',
      label: 'Enterprise',
      basePrice: null,
      priceInr: null,
      priceDisplay: 'Custom',
      tagline: 'For large enterprises & OEMs',
      highlight: 'Unlimited leads & dedicated SLA',
      features: ['Unlimited product listings', 'Unlimited RFQ leads', 'Dedicated account manager', 'Custom branded storefront', 'API access', '10+ team members', 'SLA guarantee'],
      popular: false,
      enterprise: true,
    },
  ];
}
