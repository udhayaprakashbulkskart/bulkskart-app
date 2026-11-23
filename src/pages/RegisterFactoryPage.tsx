/**
 * Register your factory (/register-factory): the shortest way for a manufacturer to join.
 * One screen (business, name, mobile, email, password, city, country, and optionally what they make), then the plan
 * step, then the Supplier Map listing page. Uses the same account and business-saving code as the full manufacturer
 * signup (/signup/manufacturer), so both create the same kind of account.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, BadgeCheck, Eye, EyeOff, Factory, Globe2, Loader2, MapPin, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import PageMeta from '@/components/common/PageMeta';
import BrandLogo from '@/components/common/BrandLogo';
import { PlanStep } from '@/components/signup/PlanStep';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { useRazorpay } from '@/hooks/useRazorpay';
import { triggerMatchNewManufacturer } from '@/lib/api';
import { trackEvent, trackSignUp } from '@/lib/analytics';
import { COUNTRIES } from '@/lib/countryConfig';
import { checkMobile } from '@/lib/signup';
import { draftFromForm, type FactoryForm, validateFactoryForm } from '@/lib/supplierMap/registerFactory';
import { saveManufacturerCompany } from '@/lib/signup/saveCompany';
import { buildPlans } from '@/lib/subscriptionPlans';
import { COUNTRY_NAMES } from '@/lib/supplierMap/places';
import { WHATSAPP_CHAT_URL, WHATSAPP_DISPLAY } from '@/lib/supportContact';
import { cn } from '@/lib/utils';

const PRICING_COUNTRY = COUNTRIES.IN;
const formatRupees = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
/** after signing up (and choosing a plan or not): where the factory gets on the map */
export const AFTER_REGISTER = '/dashboard/supplier/map-listing';

const FIELD_ORDER: (keyof FactoryForm)[] = ['companyName', 'fullName', 'phone', 'email', 'password', 'city', 'agreed'];
const input =
  'h-12 w-full rounded-xl border border-white/12 bg-[#151517] px-3.5 text-[15px] text-white outline-none transition-colors placeholder:text-white/35 focus:border-[#FF5A00] aria-[invalid=true]:border-red-500';

export default function RegisterFactoryPage() {
  const { user, profile, company, loading, resolvedRole, isPaidSubscriber, signUp, signOut, refreshProfile } = useAuth();
  const { startCheckout, loading: paying } = useRazorpay();
  const navigate = useNavigate();
  const [f, setF] = useState<FactoryForm>({ companyName: '', fullName: '', phone: '', email: '', password: '', city: '', country: 'India', makes: '', agreed: false });
  const [errors, setErrors] = useState<Partial<Record<keyof FactoryForm, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const [step, setStep] = useState<'form' | 'plan'>('form');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [owner, setOwner] = useState<{ id: string; email: string } | null>(null);
  const [tier, setTier] = useState('business');
  const refs = useRef<Partial<Record<keyof FactoryForm, HTMLElement | null>>>({});
  const plans = useMemo(() => buildPlans(PRICING_COUNTRY, formatRupees), []);

  // a manufacturer who is already signed in only needs the plan, or goes straight to the map listing
  useEffect(() => {
    if (loading || !user) return;
    if (resolvedRole === 'supplier' && isPaidSubscriber) navigate(AFTER_REGISTER, { replace: true });
    else if (resolvedRole === 'supplier' && company?.id && step === 'form') {
      setCompanyId(company.id);
      setOwner({ id: user.id, email: user.email ?? '' });
      setStep('plan');
    }
  }, [loading, user, resolvedRole, isPaidSubscriber, company?.id, step, navigate]);

  const set = <K extends keyof FactoryForm>(k: K, v: FactoryForm[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateFactoryForm(f);
    setErrors(errs);
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (first) {
      refs.current[first]?.focus();
      return;
    }
    setBusy(true);
    setServerError('');
    try {
      const { error, user: made } = await signUp(f.email.trim(), f.password, f.fullName.trim(), 'supplier');
      if (error) {
        setServerError(/already (exists|registered)/i.test(error) ? 'This email already has an account. Sign in instead, then open this page again.' : error);
        return;
      }
      const signedIn = made ?? (await supabase.auth.getUser()).data.user;
      if (!signedIn) {
        setServerError('Your login was created, but we could not sign you in. Please sign in, then open this page again.');
        return;
      }
      trackSignUp('supplier');
      trackEvent('register_factory_submitted', { country: f.country });
      const saved = await saveManufacturerCompany(draftFromForm(f), signedIn.id);
      if (!saved.companyId) {
        setServerError('Your account is ready, but we could not save the factory details. Please sign in and finish them in your dashboard, or chat with us on WhatsApp.');
        return;
      }
      if (!saved.reused) void triggerMatchNewManufacturer(saved.companyId);
      setCompanyId(saved.companyId);
      setOwner({ id: signedIn.id, email: signedIn.email ?? f.email.trim() });
      await refreshProfile(signedIn.id);
      setStep('plan');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setServerError(err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const pay = (plan: (typeof plans)[number], total: number) => {
    if (!companyId || !owner) {
      toast.error('Please register first.');
      return;
    }
    trackEvent('register_factory_checkout', { plan: plan.tier, amount: total });
    startCheckout({
      plan_tier: plan.tier,
      plan_label: `${plan.label} Plan`,
      price_inr: total,
      billing_cycle: 'monthly',
      company_id: companyId,
      user_name: f.fullName || profile?.full_name || '',
      user_email: owner.email,
      user_phone: checkMobile(f.phone).e164 ?? profile?.phone ?? '',
      onSuccess: () => {
        void refreshProfile(owner.id);
        navigate(AFTER_REGISTER);
      },
    });
  };

  const err = (k: keyof FactoryForm) =>
    errors[k] ? <span id={`rf-${k}-error`} className="mt-1 block text-[12.5px] font-semibold text-red-400">{errors[k]}</span> : null;
  const field = (k: keyof FactoryForm, label: string, extra: React.InputHTMLAttributes<HTMLInputElement>, optional = false) => (
    <label className="block">
      <span className="mb-1 block text-[13.5px] font-bold text-white/90">{label}{optional && <span className="font-normal text-white/45"> (optional)</span>}</span>
      <input
        ref={(el) => { refs.current[k] = el; }}
        className={input}
        value={f[k] as string}
        onChange={(e) => set(k, e.target.value as never)}
        aria-invalid={Boolean(errors[k])}
        aria-describedby={errors[k] ? `rf-${k}-error` : undefined}
        {...extra}
      />
      {err(k)}
    </label>
  );

  let body: React.ReactNode;
  if (loading) {
    body = <div className="grid place-items-center py-24"><Loader2 className="h-7 w-7 animate-spin text-[#FF5A00]" /></div>;
  } else if (user && resolvedRole === 'buyer' && step === 'form') {
    body = (
      <div className="rounded-3xl border border-white/10 bg-[#0f0f11] p-6 text-center">
        <h1 className="text-[22px] font-black">You are signed in as a buyer</h1>
        <p className="mt-2 text-[14px] text-white/65">A factory needs its own manufacturer account. Sign out, then register your factory.</p>
        <button type="button" onClick={() => void signOut()} className="mt-4 min-h-[48px] w-full rounded-2xl bg-[#FF5A00] font-black text-white">Sign out and register my factory</button>
      </div>
    );
  } else if (step === 'plan') {
    body = (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-[#FF5A00]/40 bg-[#FF5A00]/10 p-4">
          <BadgeCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#FF8A3D]" aria-hidden="true" />
          <div>
            <p className="text-[16px] font-black">Your factory is registered</p>
            <p className="text-[13px] text-white/70">Choose a plan to show it on the Supplier Map. You can also do this later from your dashboard.</p>
          </div>
        </div>
        <div className="rounded-3xl bg-background p-1 text-foreground">
          <PlanStep
            firstName={(f.fullName || profile?.full_name || '').trim().split(/\s+/)[0] ?? ''}
            plans={plans}
            selected={tier}
            onSelect={setTier}
            country={PRICING_COUNTRY}
            formatPrice={formatRupees}
            busy={paying}
            onPay={pay}
            onSkip={() => navigate(AFTER_REGISTER)}
          />
        </div>
      </div>
    );
  } else {
    body = (
      <form onSubmit={submit} noValidate className="space-y-4 rounded-3xl border border-white/10 bg-[#0f0f11] p-5 shadow-[0_30px_80px_-30px_rgba(255,90,0,0.5)] sm:p-7">
        <div>
          <h1 className="text-[26px] font-black leading-tight sm:text-[30px]">Register your <span className="text-[#FF5A00]">factory</span></h1>
          <p className="mt-1.5 text-[14px] text-white/65">A few details and you are in. Add the rest later from your dashboard.</p>
        </div>

        {field('companyName', 'Factory / business name', { placeholder: 'e.g. Kovai Cotton Mills', autoComplete: 'organization' })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field('fullName', 'Your name', { placeholder: 'e.g. Ravi Kumar', autoComplete: 'name' })}
          {field('phone', 'Mobile number', { placeholder: '98765 43210', inputMode: 'tel', autoComplete: 'tel' })}
        </div>
        {field('email', 'Email', { type: 'email', placeholder: 'you@company.com', autoComplete: 'email' })}
        <label className="block">
          <span className="mb-1 block text-[13.5px] font-bold text-white/90">Create a password</span>
          <span className="relative block">
            <input
              ref={(el) => { refs.current.password = el; }}
              type={showPassword ? 'text' : 'password'}
              className={cn(input, 'pr-12')}
              value={f.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'rf-password-error' : undefined}
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-white/60 hover:text-white">
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </span>
          {err('password')}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('city', 'Factory city', { placeholder: 'e.g. Tiruppur', autoComplete: 'address-level2' })}
          <label className="block">
            <span className="mb-1 block text-[13.5px] font-bold text-white/90">Country</span>
            <select className={input} value={f.country} onChange={(e) => set('country', e.target.value)} autoComplete="country-name">
              {COUNTRY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        {field('makes', 'What do you make?', { placeholder: 'e.g. Cotton t-shirts, polo shirts' }, true)}

        <label className="flex cursor-pointer items-start gap-3 text-[13px] text-white/70">
          <input
            ref={(el) => { refs.current.agreed = el; }}
            type="checkbox"
            checked={f.agreed}
            onChange={(e) => set('agreed', e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#FF5A00]"
            aria-invalid={Boolean(errors.agreed)}
            aria-describedby={errors.agreed ? 'rf-agreed-error' : undefined}
          />
          <span>
            I agree to the BulkSkart <Link to="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#FF8A3D] underline">User Agreement</Link> and{' '}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#FF8A3D] underline">Privacy Policy</Link>.
          </span>
        </label>
        {err('agreed')}

        {serverError && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[13px] text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {serverError}
          </p>
        )}

        <button type="submit" disabled={busy}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#FF5A00] px-4 text-[16px] font-black text-white shadow-[0_14px_34px_-14px_rgba(255,90,0,0.95)] hover:bg-[#E04E00] disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Register my factory <ArrowRight className="h-5 w-5" aria-hidden="true" /></>}
        </button>
        <p className="text-center text-[13px] text-white/55">
          Already registered? <Link to={`/auth?tab=login&redirect=${encodeURIComponent(AFTER_REGISTER)}`} className="font-bold text-[#FF8A3D]">Sign in</Link>
        </p>
      </form>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <PageMeta
        title="Register Your Factory | BulkSkart"
        description="Register your factory on BulkSkart in one short form and get found by bulk buyers on the Supplier Map."
        canonical="/register-factory"
      />
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,90,0,0.22),transparent_72%)]" />
      <header className="relative mx-auto flex max-w-xl items-center justify-between px-4 py-4">
        <BrandLogo size="md" variant="dark" linkTo="/" />
        <Link to="/supplier-map" className="text-[13px] font-semibold text-white/70 hover:text-white">Back to the map</Link>
      </header>
      <main className="relative mx-auto w-full max-w-xl px-4 pb-16">
        {step === 'form' && (
          <ul className="mb-4 grid grid-cols-3 gap-2 text-center text-[11.5px] font-semibold text-white/75">
            <li className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5"><Factory className="mx-auto mb-1 h-5 w-5 text-[#FF5A00]" aria-hidden="true" />One short form</li>
            <li className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5"><MapPin className="mx-auto mb-1 h-5 w-5 text-[#FF5A00]" aria-hidden="true" />On the Supplier Map</li>
            <li className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5"><Globe2 className="mx-auto mb-1 h-5 w-5 text-[#FF5A00]" aria-hidden="true" />Buyers worldwide</li>
          </ul>
        )}
        {body}
        <p className="mt-6 text-center text-[12.5px] text-white/55">
          <a href={WHATSAPP_CHAT_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-white">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Need help? WhatsApp us on {WHATSAPP_DISPLAY}
          </a>
        </p>
      </main>
    </div>
  );
}
