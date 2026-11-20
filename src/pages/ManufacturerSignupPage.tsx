import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import PageMeta from '@/components/common/PageMeta';
import { AboutStep, type AboutDetails } from '@/components/signup/AboutStep';
import { AccountStep, type AccountMode, type AccountValues } from '@/components/signup/AccountStep';
import { PlanStep } from '@/components/signup/PlanStep';
import { SignupShell, type SignupStep } from '@/components/signup/SignupShell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { useDebounce } from '@/hooks/use-debounce';
import { useRazorpay } from '@/hooks/useRazorpay';
import { triggerMatchNewManufacturer } from '@/lib/api';
import { trackEvent, trackSignUp } from '@/lib/analytics';
import { COUNTRIES } from '@/lib/countryConfig';
import { checkMobile, decodeGstin, gstinProgress, readBusiness, type SignupDraft } from '@/lib/signup';
import { saveManufacturerCompany } from '@/lib/signup/saveCompany';
import { buildPlans } from '@/lib/subscriptionPlans';
import { WHATSAPP_CHAT_URL, WHATSAPP_DISPLAY } from '@/lib/supportContact';

/** Plans are charged in rupees whatever country the visitor is in, so they are priced from India's settings. */
const PRICING_COUNTRY = COUNTRIES.IN;
const formatRupees = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);

/** A path on this site, or null: never an address that could take the person somewhere else. */
export function safeLocalPath(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

/** One line telling the person what was understood about their business. */
export function describeBusiness(details: AboutDetails): string {
  const type = details.businessType.toLowerCase();
  const made = details.products.slice(0, 2).join(' and ') || details.categories[0] || '';
  const where = [details.city, details.state].filter(Boolean).join(', ');
  return `You are ${/^[aeiou]/.test(type) ? 'an' : 'a'} ${type}${made ? ` of ${made}` : ''}${where ? ` in ${where}` : ''}.`;
}

export default function ManufacturerSignupPage() {
  const { user, profile, company, loading, resolvedRole, isPaidSubscriber, displayName, dashboardPath, signUp, signOut, refreshProfile } = useAuth();
  const { startCheckout, loading: paying } = useRazorpay();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const after = safeLocalPath(searchParams.get('redirect') || searchParams.get('returnUrl')) ?? '/dashboard/supplier';
  const carry = after === '/dashboard/supplier' ? '' : `&redirect=${encodeURIComponent(after)}`;

  const [step, setStep] = useState<SignupStep>('about');
  const [accountMode, setAccountMode] = useState<AccountMode>('new');
  const [text, setText] = useState('');
  const [gstin, setGstin] = useState('');
  const [edits, setEdits] = useState<Partial<AboutDetails>>({});
  const [account, setAccount] = useState({ companyName: '', fullName: '', phone: '', email: '' });
  const [tier, setTier] = useState('business');
  const [companyId, setCompanyId] = useState<string | null>(null);
  /** the login made here: the sign-in reaches the rest of the app a moment later, and payment must not wait for it */
  const [created, setCreated] = useState<{ id: string; email: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);

  // ── what the assistant understood ───────────────────────────────────────────────────────────────────────────────
  const words = useDebounce(text, 250);
  const reading = useMemo(() => readBusiness(words), [words]);
  const gst = decodeGstin(gstin) ?? reading.gstin;
  const gstBox = gstinProgress(gstin);
  const gstBlocked = gstBox.status === 'typing' || gstBox.status === 'invalid';

  const details: AboutDetails = {
    businessType: edits.businessType ?? reading.businessType ?? 'Manufacturer',
    categories: edits.categories ?? [...reading.categories],
    products: edits.products ?? reading.products,
    city: edits.city ?? reading.city ?? '',
    state: edits.state ?? reading.state ?? gst?.state ?? '',
  };

  const buildDraft = (values: AccountValues): SignupDraft => ({
    companyName: values.companyName,
    businessType: details.businessType,
    categories: details.categories,
    products: details.products,
    city: details.city,
    state: details.state,
    country: 'India',
    gstin: gst?.gstin ?? '',
    description: text.trim(),
    tradeType: reading.tradeType ?? 'domestic',
    yearEstablished: reading.yearEstablished,
    yearsInBusiness: reading.yearsInBusiness,
    fullName: values.fullName || profile?.full_name || displayName || '',
    phone: checkMobile(values.phone).e164 ?? values.phone.trim(),
  });

  // ── where the person starts, and who is not meant to be here ────────────────────────────────────────────────────
  const settled = useRef(false);
  useEffect(() => {
    if (loading || settled.current) return;
    settled.current = true;
    // a manufacturer who already has a company only needs the plan
    if (user && resolvedRole === 'supplier' && company?.id) {
      setCompanyId(company.id);
      setStep('plan');
    }
  }, [loading, user, resolvedRole, company?.id]);

  useEffect(() => {
    if (loading || !user) return;
    if (resolvedRole === 'admin') navigate('/dashboard/admin', { replace: true });
    else if (resolvedRole === 'supplier' && isPaidSubscriber) navigate(after, { replace: true });
  }, [loading, user, resolvedRole, isPaidSubscriber, navigate, after]);

  // each step starts at the top with its heading in focus
  const firstRender = useRef(true);
  useEffect(() => {
    trackEvent('manufacturer_signup_step', { step });
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelector<HTMLElement>('h1[tabindex="-1"]')?.focus({ preventScroll: true });
  }, [step]);

  // ── the steps ───────────────────────────────────────────────────────────────────────────────────────────────────
  const goToAccount = () => {
    setServerError('');
    setEmailTaken(false);
    setAccountMode(user && resolvedRole === 'supplier' ? 'existing' : 'new');
    setAccount((previous) => ({ ...previous, companyName: previous.companyName || reading.companyName || '' }));
    setStep('account');
  };

  const createAccount = async (values: AccountValues) => {
    setBusy(true);
    setServerError('');
    setEmailTaken(false);
    try {
      let userId = user?.id ?? created?.id ?? null;
      if (accountMode === 'new') {
        const { error, user: created } = await signUp(values.email, values.password, values.fullName, 'supplier');
        if (error) {
          setEmailTaken(/already (exists|registered)/i.test(error));
          setServerError(error);
          return;
        }
        const signedIn = created ?? (await supabase.auth.getUser()).data.user;
        if (!signedIn) {
          setServerError('Your login was created, but we could not sign you in. Please sign in, then open this page again.');
          return;
        }
        userId = signedIn.id;
        setCreated({ id: signedIn.id, email: signedIn.email ?? values.email });
        trackSignUp('supplier');
      }
      if (!userId) {
        setServerError('Please sign in first.');
        return;
      }

      const saved = await saveManufacturerCompany(buildDraft(values), userId);
      if (!saved.companyId) {
        // the login exists now, so a second try only has to save the business
        setAccountMode('existing');
        console.warn('Saving the business failed:', saved.error);
        setServerError('Your account is ready, but we could not save your business details. Please try once more. If it keeps happening, chat with us on WhatsApp (the link is at the bottom of this page).');
        return;
      }
      setCompanyId(saved.companyId);
      setAccount({ companyName: values.companyName, fullName: values.fullName, phone: values.phone, email: values.email });
      if (!saved.reused) void triggerMatchNewManufacturer(saved.companyId);
      await refreshProfile(userId);
      setStep('plan');
    } catch (error) {
      setServerError(error instanceof Error && error.message ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const plans = useMemo(() => buildPlans(PRICING_COUNTRY, formatRupees), []);

  const owner = user ? { id: user.id, email: user.email ?? account.email } : created;

  const pay = (plan: (typeof plans)[number], total: number) => {
    if (!owner) {
      toast.error('Please sign in before paying.');
      return;
    }
    trackEvent('manufacturer_signup_checkout', { plan: plan.tier, amount: total });
    startCheckout({
      plan_tier: plan.tier,
      plan_label: `${plan.label} Plan`,
      price_inr: total,
      billing_cycle: 'monthly',
      company_id: companyId ?? undefined,
      user_name: account.fullName || profile?.full_name || displayName,
      user_email: owner.email,
      user_phone: checkMobile(account.phone).e164 ?? profile?.phone ?? '',
      // the rest of the app only learns about a new plan when it is told to look again
      onSuccess: () => {
        void refreshProfile(owner.id);
      },
    });
  };

  const firstName = (account.fullName || profile?.full_name || displayName || '').trim().split(/\s+/)[0] ?? '';

  // ── what is shown ───────────────────────────────────────────────────────────────────────────────────────────────
  const headerAction = user ? (
    <Link to={dashboardPath} className="font-semibold text-primary hover:underline">
      Go to my dashboard
    </Link>
  ) : (
    <span>
      Already registered?{' '}
      <Link to={`/auth?tab=login${carry}`} className="font-semibold text-primary hover:underline">
        Sign in
      </Link>
    </span>
  );

  const footer = (
    <div className="space-y-1.5">
      <p>
        Prefer to fill in everything yourself?{' '}
        <Link to={`/auth?tab=supplier&form=full${carry}`} className="font-semibold text-primary hover:underline">
          Use the detailed form
        </Link>
      </p>
      <p>
        <a href={WHATSAPP_CHAT_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-foreground/80 hover:text-foreground">
          <MessageCircle className="h-3.5 w-3.5" /> Stuck? Chat with us on WhatsApp, {WHATSAPP_DISPLAY}
        </a>
      </p>
    </div>
  );

  let body: React.ReactNode;
  if (loading) {
    body = (
      <div role="status" aria-label="Loading" className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  } else if (user && resolvedRole === 'buyer') {
    body = (
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h1 className="text-xl font-extrabold">You are signed in as a buyer</h1>
        <p className="text-sm text-muted-foreground">A manufacturer account is separate from a buyer account. Sign out to register your factory, or carry on as a buyer.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={() => void signOut()} className="h-11 rounded-xl font-bold">
            Sign out and register as a manufacturer
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(dashboardPath)} className="h-11 rounded-xl">
            Go to my buyer dashboard
          </Button>
        </div>
      </section>
    );
  } else if (step === 'about') {
    body = (
      <AboutStep
        text={text}
        onText={setText}
        gstin={gstin}
        onGstin={setGstin}
        details={details}
        edited={Object.keys(edits).length > 0}
        onChange={(patch) => setEdits((previous) => ({ ...previous, ...patch }))}
        onResetEdits={() => setEdits({})}
        blocked={gstBlocked ? 'Finish the GST number (15 characters) or clear the box to continue.' : ''}
        onContinue={goToAccount}
        onPayNow={user ? () => setStep('plan') : undefined}
      />
    );
  } else if (step === 'account') {
    body = (
      <AccountStep
        mode={accountMode}
        initial={account}
        summary={`${describeBusiness(details)} ${accountMode === 'new' ? 'Now create your login.' : 'Now confirm your business name and mobile number.'}`}
        busy={busy}
        error={serverError}
        emailTaken={emailTaken}
        signInHref={`/auth?tab=login${carry}`}
        onBack={(values) => {
          setAccount({ companyName: values.companyName, fullName: values.fullName, phone: values.phone, email: values.email });
          setServerError('');
          setStep('about');
        }}
        onSubmit={createAccount}
        onPayNow={owner ? () => setStep('plan') : undefined}
      />
    );
  } else {
    body = (
      <PlanStep
        firstName={firstName}
        plans={plans}
        selected={tier}
        onSelect={setTier}
        country={PRICING_COUNTRY}
        formatPrice={formatRupees}
        busy={paying}
        profileReady={Boolean(companyId)}
        onPay={pay}
        onSkip={() => navigate(after)}
      />
    );
  }

  return (
    <SignupShell step={step} headerAction={headerAction} footer={footer}>
      <PageMeta
        title="Register as a Manufacturer — BulkSkart B2B Marketplace"
        description="Set up your manufacturer account on BulkSkart in about a minute: tell the signup assistant what you make, create your login and choose a plan."
        canonical="/signup/manufacturer"
        robots="noindex, nofollow"
      />
      {body}
    </SignupShell>
  );
}
