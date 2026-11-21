import React from 'react';
import { ArrowRight, CalendarDays, Check, CreditCard, Loader2, Lock, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CountryConfig } from '@/lib/countryConfig';
import { calculateCountryPricing } from '@/lib/countryConfig';
import type { SubscriptionPlan } from '@/lib/subscriptionPlans';
import { cn } from '@/lib/utils';
import { AssistantNote } from './SignupShell';

interface PlanStepProps {
  firstName: string;
  /** every plan; the one that is priced by talking to us is shown as a line of text */
  plans: SubscriptionPlan[];
  selected: string;
  onSelect: (tier: string) => void;
  /** prices are always charged in rupees, so the country is India's whatever the visitor's own */
  country: CountryConfig;
  formatPrice: (amount: number) => string;
  busy: boolean;
  /** false when the person is paying before their business profile exists */
  profileReady?: boolean;
  onPay: (plan: SubscriptionPlan, total: number) => void;
  onSkip: () => void;
}

const FEATURES_SHOWN = 6;

function Line({ label, hint, value, strong }: { label: string; hint?: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex items-start justify-between gap-3', strong ? 'border-t border-border pt-2.5 text-sm font-bold' : 'text-xs text-muted-foreground')}>
      <div>
        <span className={strong ? 'text-foreground' : undefined}>{label}</span>
        {hint && <p className="text-[10px] text-muted-foreground/80">{hint}</p>}
      </div>
      <span className={strong ? 'text-base text-primary' : 'font-medium text-foreground'}>{value}</span>
    </div>
  );
}

/** Choose a plan and pay, with the whole price in front of the person before they press the button. */
export function PlanStep({ firstName, plans, selected, onSelect, country, formatPrice, busy, profileReady = true, onPay, onSkip }: PlanStepProps) {
  const buyable = plans.filter((plan) => !plan.enterprise && plan.basePrice !== null);
  const chosen = buyable.find((plan) => plan.tier === selected) ?? buyable[0];
  const pricing = chosen && chosen.basePrice !== null ? calculateCountryPricing(chosen.basePrice, country) : null;

  return (
    <section aria-labelledby="plan-title" className="space-y-5">
      <div>
        <h1 id="plan-title" tabIndex={-1} className="text-2xl font-extrabold leading-tight tracking-tight outline-none sm:text-3xl">
          {firstName ? `You are in, ${firstName}!` : 'You are in!'} Choose a plan
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {profileReady
            ? 'Your account and business profile are saved. One last step to start responding to buyers.'
            : 'You can pay now and finish your business profile afterwards. One last step to start responding to buyers.'}
        </p>
      </div>

      <AssistantNote>
        Until a plan is active, buyer contacts and RFQ quotes stay locked. You can still set up your profile and products. Pick the plan that fits and pay securely
        in a minute.
      </AssistantNote>

      <div role="radiogroup" aria-label="Choose a plan" className="space-y-3">
        {buyable.map((plan) => {
          const active = plan.tier === chosen?.tier;
          return (
            <button
              key={plan.tier}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(plan.tier)}
              className={cn(
                'block w-full rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5',
                active ? 'border-primary bg-primary/[0.06] shadow-[0_12px_30px_-18px_rgba(255,90,0,0.7)]' : 'border-border bg-card hover:border-primary/50',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-extrabold">{plan.label}</span>
                    {plan.popular && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">Recommended</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{plan.highlight}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-lg font-extrabold">{plan.priceDisplay}</span>
                  <p className="text-[11px] text-muted-foreground">per month + GST</p>
                </div>
              </div>
              {active && (
                <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-border pt-3 sm:grid-cols-2">
                  {plan.features.slice(0, FEATURES_SHOWN).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-foreground/90">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
        <p className="px-1 text-xs text-muted-foreground">
          Need more than Growth?{' '}
          <a href="mailto:info@bulkskart.com?subject=Enterprise Plan Inquiry" className="font-semibold text-primary underline-offset-2 hover:underline">
            Talk to us about Enterprise
          </a>
          .
        </p>
      </div>

      {chosen && pricing && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-label="Price breakdown">
          <h2 className="mb-3 text-sm font-bold">What you pay today</h2>
          <div className="space-y-2">
            <Line label={`${chosen.label} plan, 30 days`} value={formatPrice(pricing.basePrice)} />
            <Line label={pricing.taxLabel} value={`+${formatPrice(pricing.taxAmount)}`} />
            <Line label="Payment gateway fee" hint={country.feeDescription} value={`+${formatPrice(pricing.feeAmount)}`} />
            <Line strong label="Total payable today" value={formatPrice(pricing.totalPayable)} />
          </div>

          <ul className="mt-4 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              You pay securely with Razorpay. BulkSkart never sees your card details.
            </li>
            <li className="flex items-start gap-2">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Your plan is active as soon as the payment is confirmed.
            </li>
            <li className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              One payment gives you 30 days on the plan.
            </li>
          </ul>
        </div>
      )}

      {/* stays in reach on a phone while the plans scroll by */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button
          type="button"
          disabled={busy || !chosen || !pricing}
          onClick={() => chosen && pricing && onPay(chosen, pricing.totalPayable)}
          className="h-12 w-full rounded-xl text-base font-bold shadow-[0_10px_26px_-12px_rgba(255,90,0,0.85)]"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Opening secure payment…
            </>
          ) : chosen && pricing ? (
            <>
              <CreditCard className="h-4 w-4" /> Pay {formatPrice(pricing.totalPayable)} and activate {chosen.label} <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            'Choose a plan'
          )}
        </Button>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" /> Secure payment by Razorpay
        </p>
      </div>

      <div className="text-center">
        <button type="button" onClick={onSkip} disabled={busy} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Skip for now and explore my dashboard
        </button>
      </div>
    </section>
  );
}
