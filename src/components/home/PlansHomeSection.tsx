import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight, Shield, Zap, Check, Rocket, TrendingUp, Gem, ShieldCheck, CalendarCheck, Repeat, XCircle, FileText, Crown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCountry } from '@/contexts/CurrencyContext';
import { useRazorpay } from '@/hooks/useRazorpay';
import { toast } from 'sonner';


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
    icon: Rocket,
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
    icon: TrendingUp,
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
    icon: Gem,
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

const BENEFITS = [
  { icon: ShieldCheck, label: 'No Lock-in', sub: 'Contract' },
  { icon: CalendarCheck, label: 'Billed', sub: 'Monthly' },
  { icon: Repeat, label: 'Upgrade / Downgrade', sub: 'Anytime' },
  { icon: XCircle, label: 'Cancel', sub: 'Anytime' },
  { icon: FileText, label: 'GST', sub: 'Invoice' },
];

export default function PlansHomeSection() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
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
    <section className="relative isolate overflow-hidden bg-[#070707] py-10 text-white md:py-14">
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-[#FF5A00]/10 blur-[130px]" />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-5 md:px-6">
        {/* Header with photo */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0c]">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c0c0c] via-[#0c0c0c]/80 to-transparent" />
          <div className="relative max-w-xl p-6 md:p-10">
            <motion.span
              initial={reduce ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-[#FF5A00]/50 bg-[#FF5A00]/10 px-3.5 py-1.5 text-[12px] font-bold text-[#FF7A2E]"
            >
              <Zap className="h-4 w-4" /> Supplier Growth Memberships
            </motion.span>
            <motion.h2
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="mt-4 text-[32px] font-black leading-[1.05] tracking-tight sm:text-[42px]"
            >
              Transparent Monthly <span className="text-[#FF5A00]">Supplier Plans</span>
            </motion.h2>
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="mt-3 text-[14px] leading-relaxed text-slate-300 sm:text-[15px]"
            >
              Simple, transparent monthly pricing. Zero lock-in contracts, zero annual billing commitments. Cancel or upgrade whenever you want.
            </motion.p>
          </div>
        </div>

        {/* Benefit strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-[#0c0c0c] p-4 md:grid-cols-5 md:gap-0 md:divide-x md:divide-white/10">
          {BENEFITS.map(({ icon: Icon, label, sub }, i) => (
            <motion.div
              key={label}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="flex items-center gap-3 md:justify-center md:px-4"
            >
              <Icon className="h-6 w-6 shrink-0 text-[#FF5A00]" />
              <span className="text-[12px] font-semibold leading-tight text-slate-200">{label}<span className="block text-neutral-400">{sub}</span></span>
            </motion.div>
          ))}
        </div>

        {/* Plans */}
        <div className="mt-8 grid grid-cols-1 gap-5 pt-4 md:grid-cols-3">
          {MONTHLY_PLANS.map((plan, idx) => {
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.tier}
                initial={reduce ? false : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, delay: idx * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className={`group relative flex flex-col rounded-3xl border p-6 transition-all duration-300 sm:p-7 ${
                  plan.popular
                    ? 'z-10 border-[#FF5A00] bg-gradient-to-b from-[#1a0d05] via-[#0c0c0c] to-[#0a0a0a] shadow-[0_0_50px_-12px_rgba(255,90,0,0.7)] md:-my-3'
                    : 'border-white/10 bg-[#0c0c0c] hover:-translate-y-1 hover:border-[#FF5A00]/40'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] px-4 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-lg">
                    <Crown className="h-3.5 w-3.5" /> Most Popular
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${plan.popular ? 'bg-gradient-to-br from-[#FF7A2E] to-[#E84A00] shadow-[0_8px_24px_-8px_rgba(255,90,0,0.9)]' : 'bg-[#FF5A00]/12 text-[#FF5A00]'}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </span>
                  <div>
                    <h3 className="text-[20px] font-black">{plan.tier}</h3>
                    <p className="text-[12px] text-neutral-400">Monthly</p>
                  </div>
                </div>

                <p className="mt-4 min-h-[44px] text-[13px] leading-relaxed text-slate-300">{plan.tagline}</p>

                <div className="mt-5 border-t border-white/10 pt-5">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-[40px] font-black leading-none ${plan.popular ? 'text-[#FF7A2E]' : 'text-white'}`}>{plan.price}</span>
                    <span className="text-[14px] font-semibold text-neutral-400">{plan.period}</span>
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#FF5A00]/40 bg-[#FF5A00]/10 px-3 py-1 text-[11px] font-semibold text-[#FF7A2E]">
                    <CalendarCheck className="h-3.5 w-3.5" /> {plan.billed}
                  </span>
                </div>

                <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-300">Included with {plan.tier}</p>
                <ul className="mt-3 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-[13px] text-slate-200">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF5A00]/15">
                        <Check className="h-3.5 w-3.5 text-[#FF5A00]" strokeWidth={3} />
                      </span>
                      <span className="leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => handleSelectPlan(plan)}
                    disabled={paying}
                    className={`group/btn flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold transition-transform hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-60 ${
                      plan.popular
                        ? 'bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] text-white shadow-[0_12px_30px_-10px_rgba(255,90,0,0.9)]'
                        : 'border border-white/20 text-white hover:border-[#FF5A00] hover:text-[#FF7A2E]'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                  </button>
                  <p className="mt-2.5 text-center text-[11px] text-neutral-400">Instant activation via Razorpay • GST invoice issued</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Guarantee banner */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#FF5A00]/40 bg-gradient-to-r from-[#1a0d05] via-[#0c0c0c] to-[#0c0c0c] p-5 sm:flex-row sm:items-center sm:p-6"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FF5A00]/15">
              <Shield className="h-6 w-6 text-[#FF5A00]" />
            </span>
            <div>
              <p className="text-[17px] font-black">100% Monthly Flexibility Guarantee</p>
              <p className="text-[13px] text-neutral-400">No locked commitments. Upgrade, downgrade, or pause your supplier subscription at any time.</p>
            </div>
          </div>
          <Link
            to="/pricing"
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[#FF5A00]/60 px-5 text-[13px] font-bold text-[#FF7A2E] transition-colors hover:bg-[#B33D00]/10"
          >
            Compare Full Plan Features <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
