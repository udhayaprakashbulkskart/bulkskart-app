import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// the checkbox measures itself, and jsdom has no ResizeObserver
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

// ── a fake database that records what is asked of it ───────────────────────────────────────────────────────────────
const db = vi.hoisted(() => {
  const calls: Array<{ table: string; op: string; args: unknown[] }> = [];
  const state = { existing: null as { id: string } | null, insertResult: { data: { id: 'new-company' } as { id: string } | null, error: null as { message: string } | null } };
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    const record = (op: string) => (...args: unknown[]) => {
      calls.push({ table, op, args });
      return chain;
    };
    chain.update = record('update');
    chain.select = record('select');
    chain.insert = record('insert');
    chain.eq = record('eq');
    chain.maybeSingle = () => {
      calls.push({ table, op: 'maybeSingle', args: [] });
      if (table === 'companies' && calls.some((call) => call.op === 'insert')) return Promise.resolve(state.insertResult);
      return Promise.resolve({ data: table === 'companies' ? state.existing : null, error: null });
    };
    // awaiting the profile update itself
    chain.then = (resolve: (value: unknown) => void) => resolve({ error: null });
    return chain;
  };
  return { calls, state, from };
});
vi.mock('@/db/supabase', () => ({ supabase: { from: db.from, auth: { getUser: vi.fn(), resetPasswordForEmail: vi.fn() } } }));

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth.value }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn(), trackSignUp: vi.fn(), trackPageView: vi.fn() }));
vi.mock('@/components/common/BrandLogo', () => ({ default: () => <img alt="BulkSkart" src="/logo.png" /> }));
vi.mock('@/components/common/PageMeta', () => ({ default: () => null }));

import AuthPage from '@/pages/AuthPage';
import { saveManufacturerCompany } from '@/lib/signup/saveCompany';
import { buildPlans } from '@/lib/subscriptionPlans';
import { planDisplayName } from '@/hooks/useRazorpay';
import { COUNTRIES, calculateCountryPricing } from '@/lib/countryConfig';
import type { SignupDraft } from '@/lib/signup';

const draft: SignupDraft = {
  companyName: 'Sunrise Polymers',
  businessType: 'Manufacturer',
  categories: ['Plastics & Rubber'],
  products: ['PVC pipes'],
  city: 'Rajkot',
  state: 'Gujarat',
  country: 'India',
  gstin: '',
  description: 'We make PVC pipes',
  tradeType: 'domestic',
  yearEstablished: null,
  yearsInBusiness: null,
  fullName: 'Ravi Kumar',
  phone: '+919876543210',
};

describe('saving the business a manufacturer described', () => {
  beforeEach(() => {
    db.calls.length = 0;
    db.state.existing = null;
    db.state.insertResult = { data: { id: 'new-company' }, error: null };
  });

  it('saves the person\'s profile and creates the company they own', async () => {
    const result = await saveManufacturerCompany(draft, 'user-1');
    expect(result).toEqual({ companyId: 'new-company', error: null, reused: false });
    const profile = db.calls.find((call) => call.table === 'profiles' && call.op === 'update');
    expect(profile?.args[0]).toMatchObject({ full_name: 'Ravi Kumar', phone: '+919876543210', city: 'Rajkot', state: 'Gujarat' });
    expect(db.calls.find((call) => call.table === 'profiles' && call.op === 'eq')?.args).toEqual(['id', 'user-1']);
    const insert = db.calls.find((call) => call.table === 'companies' && call.op === 'insert');
    expect(insert?.args[0]).toMatchObject({ owner_id: 'user-1', company_name: 'Sunrise Polymers', verification_status: 'unverified', onboarding_completed: false });
  });

  it('uses the company this person already owns, and does not overwrite it', async () => {
    db.state.existing = { id: 'old-company' };
    const result = await saveManufacturerCompany(draft, 'user-1');
    expect(result).toEqual({ companyId: 'old-company', error: null, reused: true });
    expect(db.calls.some((call) => call.table === 'companies' && (call.op === 'insert' || call.op === 'update'))).toBe(false);
  });

  it('says what went wrong when the company cannot be saved', async () => {
    db.state.insertResult = { data: null, error: { message: 'new row violates row-level security policy' } };
    expect(await saveManufacturerCompany(draft, 'user-1')).toEqual({ companyId: null, error: 'new row violates row-level security policy', reused: false });
    db.state.insertResult = { data: null, error: null };
    expect((await saveManufacturerCompany(draft, 'user-1')).error).toBe('We could not save your business details.');
  });
});

describe('the supplier plans shared by the dashboard and the sign-up', () => {
  const rupees = (amount: number) => `₹${amount}`;

  it('lists four plans in order, the last one priced by talking to us', () => {
    const plans = buildPlans(COUNTRIES.IN, rupees);
    expect(plans.map((plan) => plan.tier)).toEqual(['starter', 'business', 'growth', 'enterprise']);
    expect(plans.map((plan) => plan.basePrice)).toEqual([2500, 7500, 15000, null]);
    expect(plans.map((plan) => plan.priceDisplay)).toEqual(['₹2500', '₹7500', '₹15000', 'Custom']);
    expect(plans.filter((plan) => plan.enterprise).map((plan) => plan.tier)).toEqual(['enterprise']);
    expect(plans.filter((plan) => plan.popular).map((plan) => plan.tier)).toEqual(['business']);
    for (const plan of plans) expect(plan.features.length).toBeGreaterThan(3);
  });

  it('keeps the rupee figure of a plan priced in another currency the way the dashboard always did', () => {
    const us = buildPlans(COUNTRIES.US, (amount) => `$${amount}`);
    expect(us[0]).toMatchObject({ basePrice: 29, priceInr: Math.round(29 * 83.5), priceDisplay: '$29' });
  });

  it('adds up to the figures the payment is made with: fee included, tax on the plan only', () => {
    const totals = [2500, 7500, 15000].map((base) => calculateCountryPricing(base, COUNTRIES.IN));
    expect(totals.map((price) => price.taxAmount)).toEqual([450, 1350, 2700]);
    expect(totals.map((price) => price.feeAmount)).toEqual([59, 177, 354]);
    expect(totals.map((price) => price.totalPayable)).toEqual([3009, 9027, 18054]);
  });
});

describe('how a plan is named in the payment window and the message after it', () => {
  it('adds "Plan" to a bare name and leaves a full name alone, so it never reads "Business Plan Plan"', () => {
    expect(planDisplayName('Business')).toBe('Business Plan');
    expect(planDisplayName('Business Plan')).toBe('Business Plan');
    expect(planDisplayName('AI Accessibility Add-on')).toBe('AI Accessibility Add-on');
    expect(planDisplayName('24 Hours Sell Products')).toBe('24 Hours Sell Products Plan');
  });
});

describe('where the old supplier sign-up now leads', () => {
  function Probe() {
    const location = useLocation();
    return <output data-testid="where">{location.pathname + location.search}</output>;
  }
  function renderAuth(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <AuthPage />
                <Probe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
  }
  const where = () => screen.getByTestId('where').textContent;

  beforeEach(() => {
    auth.value = {
      user: null,
      profile: null,
      loading: false,
      resolvedRole: null,
      dashboardPath: '/auth',
      signIn: vi.fn(),
      signUp: vi.fn(),
      refreshProfile: vi.fn(),
    };
  });

  it('sends a manufacturer who is signing up to the assistant, wherever the link came from', async () => {
    for (const path of ['/auth?tab=supplier', '/register?role=supplier', '/signup?role=supplier']) {
      const view = renderAuth(path);
      await waitFor(() => expect(where()).toBe('/signup/manufacturer'));
      view.unmount();
    }
  });

  it('remembers where the person was going', async () => {
    renderAuth('/auth?tab=supplier&redirect=%2Fbuyers%2Fsuresh-traders');
    await waitFor(() => expect(where()).toBe('/signup/manufacturer?redirect=%2Fbuyers%2Fsuresh-traders'));
  });

  it('still shows the detailed form to someone who asks for it', () => {
    renderAuth('/auth?tab=supplier&form=full');
    expect(where()).toBe('/auth?tab=supplier&form=full');
    expect(screen.getByRole('heading', { name: 'Register as Supplier' })).toBeInTheDocument();
  });

  it('leaves login and buyer registration alone', () => {
    const login = renderAuth('/auth?tab=login');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(where()).toBe('/auth?tab=login');
    login.unmount();
    renderAuth('/auth?tab=buyer');
    expect(screen.getByRole('heading', { name: 'Register as Buyer' })).toBeInTheDocument();
    expect(where()).toBe('/auth?tab=buyer');
  });

  it('does not show the long form for a moment on the way', () => {
    renderAuth('/auth?tab=supplier');
    expect(screen.queryByRole('heading', { name: 'Register as Supplier' })).not.toBeInTheDocument();
  });

  it('does not take someone who is already signed in away from where they are going', () => {
    auth.value = { ...auth.value, user: { id: 'user-1' }, resolvedRole: 'supplier', dashboardPath: '/dashboard/supplier' };
    renderAuth('/auth?tab=supplier');
    expect(where()).not.toBe('/signup/manufacturer');
  });
});
