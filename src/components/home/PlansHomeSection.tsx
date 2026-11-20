import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle, ArrowRight, Shield, Zap, Sparkles,
  Building2, Users, Star, BarChart3, Check
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCountry } from '@/contexts/CurrencyContext';
import { useRazorpay } from '@/hooks/useRazorpay';
import { toast } from 'sonner';
import SectionHeader from '@/components/home/SectionHeader';

const MONTHLY_PLANS = [
  {
    tier: 'Starter',
    tierKey: 'starter',
    price: '₹2,500',
    price_inr: 2500,
    period: '/month',
    billed: 'Billed monthly • Cancel anytime',
    tagline: 'Ideal for emerging suppliers and specialized factories seeking verified leads.',
    popular: false,
    features: [
      'Verified factory profile & trust badge',
      'Up to 10 product listings in catalog',
      '5 direct buyer RFQ responses per month',
      'Encrypted buyer-supplier direct chat',
      'Standard search directory placement',
      'Basic analytics & inquiry alerts',
    ],
    cta: 'Get Starter Plan',
  },
  {
    tier: 'Professional',
    tierKey: 'business',
    price: '₹7,500',
    price_inr: 7500,
    period: '/month',
    billed: 'Billed monthly • Cancel anytime',
    tagline: 'High-growth plan for manufacturers seeking maximum trade visibility and lead velocity.',
    popular: true,
    features: [
      'Everything in Starter included',
      '50 high-value buyer RFQ responses / mo',
      'Priority top placement in category searches',
      'Unmasked verified buyer phone & email access',
      'Sell in 24 Hours fast-track event access',
      'Dedicated lead alerts on WhatsApp/SMS',
      'Export inquiry transcripts & quote generation',
    ],
    cta: 'Get Professional Plan',
  },
  {
    tier: 'Enterprise',
    tierKey: 'growth',
    price: '₹15,000',
    price_inr: 15000,
    period: '/month',
    billed: 'Billed monthly • Cancel anytime',
    tagline: 'For high-volume exporters, OEMs and global trading corporations.',
    popular: false,
    features: [
      'Everything in Professional included',
      'Unlimited buyer RFQ quotes & responses',
      'Featured top banner placement on category hubs',
      'Dedicated relationship account manager',
      'Custom cross-border shipping SLA support',
      'Multi-team seat access & quote management',
      'Priority verification badge with D&B sync',
    ],
    cta: 'Get Enterprise Plan',
  },
];

export default function PlansHomeSection() {
  const navigate = useNavigate();
  const { user, profile, company } = useAuth();
  const { countryConfig } = useCountry();
  const { startCheckout, loading: paying } = useRazorpay();

  const handleSelectPlan = async (plan: typeof MONTHLY_PLANS[0]) => {
    if (!user || !profile || !company) {
      toast.info('Please sign in as a supplier or register your company to activate this plan');
      navigate('/auth?tab=supplier');
      return;
    }

    try {
      startCheckout({
        plan_tier: plan.tierKey,
        plan_label: `${plan.tier} Plan`,
        price_inr: plan.price_inr,
        billing_cycle: 'monthly',
        company_id: company.id,
        user_name: profile.full_name ?? '',
        user_email: user.email ?? '',
        onSuccess: () => {
          toast.success(`Welcome to BulkSkart ${plan.tier}! Your supplier privileges are active.`);
          navigate('/dashboard/supplier');
        },
      });
    } catch {
      navigate('/pricing');
    }
  };

  return (
    <section className="relative z-20 pt-2 pb-12 md:pt-4 md:pb-16 bg-[#121212] border-t-0">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-5 md:px-6">

        {/* Section Header */}
        <div className="mb-10">
          <SectionHeader
            align="center"
            eyebrow="Supplier Growth Memberships"
            icon={<Zap className="h-3.5 w-3.5" />}
            title="Transparent Monthly Supplier Plans"
            subtitle="Simple, transparent monthly pricing. Zero lock-in contracts, zero annual billing commitments. Cancel or upgrade whenever you want."
          />
        </div>

        {/* Plans Grid (3 Monthly Columns) */}
        <div className="mx-auto grid max-w-5xl grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
          {MONTHLY_PLANS.map((plan) => (
            <div
              key={plan.tier}
              className={`relative flex flex-col justify-between rounded-2xl p-3 transition-all sm:p-6 lg:p-7 ${
                plan.popular
                  ? 'bg-gradient-to-b from-card to-background border-2 border-primary shadow-[0_0_30px_rgba(249,115,22,0.15)] ring-1 ring-primary/40'
                  : 'bg-card border border-border/80 hover:border-border'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground font-bold px-3 py-0.5 text-xs uppercase tracking-wider shadow-md">
                    Most Popular
                  </Badge>
                </div>
              )}

              <div>
                {/* Plan Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-lg font-bold text-foreground">{plan.tier}</h3>
                  <Badge variant="outline" className="text-[11px] border-border text-muted-foreground bg-muted/30">
                    Monthly
                  </Badge>
                </div>

                <p className="mb-4 text-sm text-pretty text-muted-foreground">
                  {plan.tagline}
                </p>

                {/* Price Display */}
                <div className="mb-4 pb-4 border-b border-border/60">
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-extrabold text-foreground sm:text-3xl lg:text-4xl">{plan.price}</span>
                    <span className="text-sm text-muted-foreground font-medium">{plan.period}</span>
                  </div>
                  <p className="text-[11px] text-orange-400 font-medium mt-1">
                    {plan.billed}
                  </p>
                </div>

                {/* Features List */}
                <div className="space-y-2.5 mb-6">
                  <p className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Included with {plan.tier}:
                  </p>
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-foreground/90 sm:gap-2 sm:text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="leading-snug">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={paying}
                  className={`h-11 w-full gap-1 px-1 text-[10px] font-bold transition-all sm:h-12 sm:px-3 sm:text-sm ${
                    plan.popular
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md'
                      : 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                  }`}
                >
                  <span>{plan.cta}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
                <p className="text-[10px] text-center text-muted-foreground mt-2">
                  Instant activation via Razorpay • GST invoice issued
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Guarantee Banner */}
        <div className="mt-10 max-w-4xl mx-auto rounded-xl bg-card border border-border/80 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-foreground">100% Monthly Flexibility Guarantee</p>
              <p className="text-[11px]">No locked commitments. Upgrade, downgrade, or pause your supplier subscription at any time.</p>
            </div>
          </div>
          <Link
            to="/pricing"
            className="text-primary font-semibold hover:underline flex items-center gap-1 shrink-0 text-xs"
          >
            <span>Compare Full Plan Features</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

      </div>
    </section>
  );
}
