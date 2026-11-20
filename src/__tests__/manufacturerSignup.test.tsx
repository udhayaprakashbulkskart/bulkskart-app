import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth.value }));

const supabaseMock = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('@/db/supabase', () => ({ supabase: { auth: { getUser: supabaseMock.getUser } } }));

const razorpay = vi.hoisted(() => ({ start: vi.fn(), loading: false }));
vi.mock('@/hooks/useRazorpay', () => ({ useRazorpay: () => ({ startCheckout: razorpay.start, loading: razorpay.loading }) }));

const apiMock = vi.hoisted(() => ({ trigger: vi.fn() }));
vi.mock('@/lib/api', () => ({ triggerMatchNewManufacturer: apiMock.trigger }));

const analytics = vi.hoisted(() => ({ trackEvent: vi.fn(), trackSignUp: vi.fn() }));
vi.mock('@/lib/analytics', () => analytics);

const saver = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('@/lib/signup/saveCompany', () => ({ saveManufacturerCompany: saver.save }));

vi.mock('@/components/common/BrandLogo', () => ({ default: () => <img alt="BulkSkart" src="/logo.png" /> }));
vi.mock('@/components/common/PageMeta', () => ({ default: () => null }));

import ManufacturerSignupPage, { describeBusiness, safeLocalPath } from '@/pages/ManufacturerSignupPage';
import { validateAccount } from '@/components/signup/AccountStep';

function Probe() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function renderAt(path = '/signup/manufacturer') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <ManufacturerSignupPage />
              <Probe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const where = () => screen.getByTestId('where').textContent;

function signedOut(overrides: Record<string, unknown> = {}) {
  auth.value = {
    user: null,
    profile: null,
    company: null,
    loading: false,
    resolvedRole: null,
    isPaidSubscriber: false,
    displayName: '',
    dashboardPath: '/auth',
    signUp: vi.fn(async () => ({ error: null, user: { id: 'user-1', email: 'ravi@company.in' } })),
    signOut: vi.fn(async () => undefined),
    refreshProfile: vi.fn(async () => undefined),
    ...overrides,
  };
}

const SENTENCE = 'We manufacture HDPE pipes and fittings in Vadodara, Gujarat';

beforeEach(() => {
  vi.clearAllMocks();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  razorpay.loading = false;
  saver.save.mockResolvedValue({ companyId: 'company-1', error: null, reused: false });
  supabaseMock.getUser.mockResolvedValue({ data: { user: null } });
  signedOut();
});

/** Types a sentence and waits for the assistant to read it. */
async function describeYourBusiness(text = SENTENCE) {
  fireEvent.change(screen.getByLabelText('About your business'), { target: { value: text } });
  await screen.findByRole('button', { name: 'Remove HDPE pipes' });
}

async function fillAccount(user: ReturnType<typeof userEvent.setup>, overrides: Partial<Record<'company' | 'name' | 'phone' | 'email' | 'password', string>> = {}) {
  const values = { company: 'Sunrise Polymers Pvt Ltd', name: 'Ravi Kumar', phone: '98765 43210', email: 'ravi@company.in', password: 'secret123', ...overrides };
  const company = screen.getByLabelText('Company or factory name');
  await user.clear(company);
  await user.type(company, values.company);
  await user.type(screen.getByLabelText('Your name'), values.name);
  await user.type(screen.getByLabelText('Mobile number'), values.phone);
  await user.type(screen.getByLabelText('Work e-mail'), values.email);
  await user.type(screen.getByLabelText('Password'), values.password);
}

describe('the pieces the page is made of', () => {
  it('only follows a path that stays on this site', () => {
    expect(safeLocalPath('/dashboard/supplier')).toBe('/dashboard/supplier');
    expect(safeLocalPath('//evil.example')).toBeNull();
    expect(safeLocalPath('https://evil.example')).toBeNull();
    expect(safeLocalPath('')).toBeNull();
    expect(safeLocalPath(null)).toBeNull();
  });

  it('says in one line what was understood', () => {
    expect(describeBusiness({ businessType: 'Manufacturer', categories: ['Plastics & Rubber'], products: ['HDPE pipes', 'Fittings'], city: 'Vadodara', state: 'Gujarat' })).toBe(
      'You are a manufacturer of HDPE pipes and Fittings in Vadodara, Gujarat.',
    );
    expect(describeBusiness({ businessType: 'Exporter', categories: ['Textiles & Apparel'], products: [], city: '', state: 'Tamil Nadu' })).toBe(
      'You are an exporter of Textiles & Apparel in Tamil Nadu.',
    );
    expect(describeBusiness({ businessType: 'Wholesaler', categories: [], products: [], city: '', state: '' })).toBe('You are a wholesaler.');
  });

  it('checks the account form field by field', () => {
    const good = { companyName: 'Sunrise Polymers', fullName: 'Ravi Kumar', phone: '9876543210', email: 'ravi@company.in', password: 'secret123', agreed: true };
    expect(validateAccount(good, 'new')).toEqual({});
    expect(Object.keys(validateAccount({ companyName: '', fullName: '', phone: '123', email: 'nope', password: 'short', agreed: false }, 'new'))).toEqual([
      'companyName',
      'fullName',
      'phone',
      'email',
      'password',
      'agreed',
    ]);
    // someone already signed in is only asked for the business and a phone number
    expect(validateAccount({ ...good, fullName: '', email: '', password: '', agreed: false }, 'existing')).toEqual({});
    expect(validateAccount({ ...good, companyName: 'x'.repeat(81) }, 'new').companyName).toMatch(/too long/);
  });
});

describe('step 1: telling the assistant about the business', () => {
  it('starts with a box for words and nothing else to fill in', () => {
    renderAt();
    expect(screen.getByRole('heading', { name: /about a minute/ })).toBeInTheDocument();
    expect(screen.getByLabelText('About your business')).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Looks right, continue/ })).toBeDisabled();
    expect(screen.getByText(/Tell me what you make above/)).toBeInTheDocument();
    // no wall of fields before the person has said anything
    expect(screen.queryByText('Here is what I understood')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('City')).not.toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Sign-up progress' })).getByText('Your business').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('shows the details as soon as the person starts, or when they ask for them', async () => {
    const user = userEvent.setup();
    const view = renderAt();
    fireEvent.change(screen.getByLabelText('About your business'), { target: { value: 'pipes' } });
    expect(screen.getByText('Here is what I understood')).toBeInTheDocument();
    view.unmount();

    renderAt();
    await user.click(screen.getByRole('button', { name: /pick the details myself/ }));
    expect(screen.getByText('Here is what I understood')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pick the details myself/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Add at least one product or category/)).toBeInTheDocument();
  });

  it('turns a sentence into details that can all be changed', async () => {
    renderAt();
    await describeYourBusiness();
    expect(screen.getByRole('button', { name: 'Manufacturer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Exporter' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Remove Fittings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Plastics & Rubber' })).toBeInTheDocument();
    expect(screen.getByLabelText('City')).toHaveValue('Vadodara');
    expect(screen.getByLabelText('State')).toHaveValue('Gujarat');
    expect(screen.getByRole('button', { name: /Looks right, continue/ })).toBeEnabled();
  });

  it('fills the box from an example, for someone who does not know how to start', async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(screen.getByRole('button', { name: 'Rice · Karnal' }));
    expect(screen.getByLabelText('About your business')).toHaveValue('We process and export basmati rice from Karnal, Haryana');
    await screen.findByRole('button', { name: 'Remove Agriculture & Food Products' });
    expect(screen.getByLabelText('City')).toHaveValue('Karnal');
    expect(screen.getByLabelText('State')).toHaveValue('Haryana');
    expect(screen.getByRole('button', { name: 'Manufacturer' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps what the person changed by hand when they keep typing, until they ask to read the words again', async () => {
    const user = userEvent.setup();
    renderAt();
    await describeYourBusiness();
    await user.click(screen.getByRole('button', { name: 'Remove Fittings' }));
    await user.click(screen.getByRole('button', { name: 'Exporter' }));
    fireEvent.change(screen.getByLabelText('About your business'), { target: { value: `${SENTENCE}, PVC valves and nipples` } });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByRole('button', { name: 'Remove Fittings' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exporter' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Read my words again' }));
    expect(screen.getByRole('button', { name: 'Manufacturer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Read my words again' })).not.toBeInTheDocument();
  });

  it('lets someone say nothing at all and add what they make by hand', async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(screen.getByRole('button', { name: /pick the details myself/ }));
    await user.type(screen.getByLabelText('Add a product'), 'Steel gates{Enter}');
    expect(screen.getByRole('button', { name: 'Remove Steel gates' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Looks right, continue/ })).toBeEnabled();
    // the same product again is not added twice
    await user.type(screen.getByLabelText('Add a product'), 'steel gates{Enter}');
    expect(screen.getAllByRole('button', { name: /^Remove Steel gates$/i })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Remove Steel gates' }));
    expect(screen.getByRole('button', { name: /Looks right, continue/ })).toBeDisabled();
  });

  it('picks categories by hand from the whole list', async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(screen.getByRole('button', { name: /pick the details myself/ }));
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    await user.click(screen.getByRole('button', { name: 'Gems & Jewellery' }));
    expect(screen.getByRole('button', { name: 'Remove Gems & Jewellery' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Looks right, continue/ })).toBeEnabled();
  });

  it('reads the state from a GST number and says who holds it', async () => {
    const user = userEvent.setup();
    renderAt();
    await user.type(screen.getByLabelText(/GST number/), '27AAPFU0939F1ZV');
    expect(screen.getByText(/Registered in/)).toHaveTextContent('Registered in Maharashtra · Partnership firm / LLP');
    expect(screen.getByLabelText('State')).toHaveValue('Maharashtra');
  });

  it('warns about a GST number with a wrong last character, and about one that is not a GST number', async () => {
    const user = userEvent.setup();
    renderAt();
    const box = screen.getByLabelText(/GST number/);
    await user.type(box, '27AAPFU0939F1ZW');
    expect(screen.getByRole('alert')).toHaveTextContent(/last character does not match/);
    await user.clear(box);
    await user.type(box, '27AAPFU0939F1XV');
    expect(screen.getByRole('alert')).toHaveTextContent(/does not look like a GST number/);
  });

  it('holds the person at a half-typed GST number, with a reason, so a typo does not get saved', async () => {
    const user = userEvent.setup();
    renderAt();
    await describeYourBusiness();
    await user.type(screen.getByLabelText(/GST number/), '27AAPF');
    expect(screen.getByText('6 of 15 characters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Looks right, continue/ })).toBeDisabled();
    expect(screen.getByText(/Finish the GST number/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/GST number/));
    expect(screen.getByRole('button', { name: /Looks right, continue/ })).toBeEnabled();
  });
});

describe('step 2: the login', () => {
  async function toAccountStep(user: ReturnType<typeof userEvent.setup>) {
    renderAt();
    await describeYourBusiness();
    await user.click(screen.getByRole('button', { name: /Looks right, continue/ }));
    await screen.findByRole('heading', { name: 'Create your login' });
  }

  it('tells the person what was understood, and asks for five things', async () => {
    const user = userEvent.setup();
    await toAccountStep(user);
    expect(screen.getByText(/You are a manufacturer of HDPE pipes and Fittings in Vadodara, Gujarat\./)).toBeInTheDocument();
    for (const label of ['Company or factory name', 'Your name', 'Mobile number', 'Work e-mail', 'Password']) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('puts a company name the person wrote in their sentence into the box', async () => {
    const user = userEvent.setup();
    renderAt();
    await describeYourBusiness('Sunrise Polymers Pvt Ltd manufactures HDPE pipes in Rajkot');
    await user.click(screen.getByRole('button', { name: /Looks right, continue/ }));
    expect(await screen.findByLabelText('Company or factory name')).toHaveValue('Sunrise Polymers Pvt Ltd');
  });

  it('shows what is wrong, next to each field, and puts the cursor on the first one', async () => {
    const user = userEvent.setup();
    await toAccountStep(user);
    await user.type(screen.getByLabelText('Mobile number'), '123');
    await user.type(screen.getByLabelText('Work e-mail'), 'nope');
    await user.click(screen.getByRole('button', { name: /Create account and choose a plan/ }));
    expect(screen.getByText('Please enter your company or factory name.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your name.')).toBeInTheDocument();
    expect(screen.getByText(/10-digit mobile number/)).toBeInTheDocument();
    expect(screen.getByText(/valid e-mail address/)).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(screen.getByText(/accept the User Agreement/)).toBeInTheDocument();
    expect(screen.getByLabelText('Company or factory name')).toHaveFocus();
    expect(screen.getByLabelText('Company or factory name')).toHaveAttribute('aria-invalid', 'true');
    expect(auth.value.signUp).not.toHaveBeenCalled();
  });

  it('suggests the right address when a well-known mail service is spelled wrong', async () => {
    const user = userEvent.setup();
    await toAccountStep(user);
    await user.type(screen.getByLabelText('Work e-mail'), 'ravi@gmial.com');
    await user.click(screen.getByRole('button', { name: 'ravi@gmail.com' }));
    expect(screen.getByLabelText('Work e-mail')).toHaveValue('ravi@gmail.com');
  });

  it('shows and hides the password', async () => {
    const user = userEvent.setup();
    await toAccountStep(user);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });

  it('keeps what was typed when the person goes back to change their business and returns', async () => {
    const user = userEvent.setup();
    await toAccountStep(user);
    await user.type(screen.getByLabelText('Your name'), 'Ravi Kumar');
    await user.type(screen.getByLabelText('Mobile number'), '9876543210');
    await user.click(screen.getByRole('button', { name: /Back/ }));
    expect(await screen.findByRole('heading', { name: /about a minute/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove HDPE pipes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Looks right, continue/ }));
    expect(await screen.findByLabelText('Your name')).toHaveValue('Ravi Kumar');
    expect(screen.getByLabelText('Mobile number')).toHaveValue('9876543210');
  });

  it('creates the login, saves the business exactly as understood, and goes on to the plans', async () => {
    const user = userEvent.setup();
    await toAccountStep(user);
    await fillAccount(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Create account and choose a plan/ }));

    await screen.findByRole('heading', { name: /You are in, Ravi!/ });
    expect(auth.value.signUp).toHaveBeenCalledWith('ravi@company.in', 'secret123', 'Ravi Kumar', 'supplier');
    expect(saver.save).toHaveBeenCalledTimes(1);
    expect(saver.save.mock.calls[0]).toEqual([
      {
        companyName: 'Sunrise Polymers Pvt Ltd',
        businessType: 'Manufacturer',
        categories: ['Plastics & Rubber'],
        products: ['HDPE pipes', 'Fittings'],
        city: 'Vadodara',
        state: 'Gujarat',
        country: 'India',
        gstin: '',
        description: SENTENCE,
        tradeType: 'domestic',
        yearEstablished: null,
        yearsInBusiness: null,
        fullName: 'Ravi Kumar',
        phone: '+919876543210',
      },
      'user-1',
    ]);
    expect(apiMock.trigger).toHaveBeenCalledWith('company-1');
    expect(auth.value.refreshProfile).toHaveBeenCalledWith('user-1');
    expect(analytics.trackSignUp).toHaveBeenCalledWith('supplier');
  });

  it('keeps the GST number and the state it came with', async () => {
    const user = userEvent.setup();
    renderAt();
    await describeYourBusiness('We make HDPE pipes');
    await user.type(screen.getByLabelText(/GST number/), '24AAACC1206D1ZM');
    await user.click(screen.getByRole('button', { name: /Looks right, continue/ }));
    await screen.findByRole('heading', { name: 'Create your login' });
    await fillAccount(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Create account and choose a plan/ }));
    await screen.findByRole('heading', { name: /You are in/ });
    expect(saver.save.mock.calls[0][0]).toMatchObject({ gstin: '24AAACC1206D1ZM', state: 'Gujarat', city: '' });
  });

  it('points to sign-in when the e-mail already has an account, and does not save a business', async () => {
    const user = userEvent.setup();
    auth.value = { ...auth.value, signUp: vi.fn(async () => ({ error: 'An account with this email address already exists. Please sign in instead.' })) };
    await toAccountStep(user);
    await fillAccount(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Create account and choose a plan/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/);
    expect(screen.getByRole('link', { name: 'Sign in instead' })).toHaveAttribute('href', '/auth?tab=login');
    expect(saver.save).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Create account and choose a plan/ })).toBeEnabled();
  });

  it('after a login that could not save the business, asks only for the business, and does not make a second login', async () => {
    const user = userEvent.setup();
    saver.save.mockResolvedValueOnce({ companyId: null, error: 'permission denied', reused: false });
    await toAccountStep(user);
    await fillAccount(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Create account and choose a plan/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/account is ready, but we could not save your business details\. Please try once more/);
    // the technical reason is for the logs, not for a manufacturer
    expect(screen.queryByText(/permission denied/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Confirm your business' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Company or factory name')).toHaveValue('Sunrise Polymers Pvt Ltd');

    auth.value = { ...auth.value, user: { id: 'user-1', email: 'ravi@company.in' }, resolvedRole: 'supplier' };
    await user.click(screen.getByRole('button', { name: /Save and choose a plan/ }));
    await screen.findByRole('heading', { name: /You are in/ });
    expect(auth.value.signUp).toHaveBeenCalledTimes(1);
    expect(saver.save).toHaveBeenCalledTimes(2);
  });
});

describe('step 3: choosing a plan and paying', () => {
  async function toPlanStep(user: ReturnType<typeof userEvent.setup>) {
    renderAt();
    await describeYourBusiness();
    await user.click(screen.getByRole('button', { name: /Looks right, continue/ }));
    await screen.findByRole('heading', { name: 'Create your login' });
    await fillAccount(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Create account and choose a plan/ }));
    await screen.findByRole('heading', { name: /You are in/ });
  }

  it('offers the three plans at the real rupee prices, with the middle one recommended and chosen', async () => {
    const user = userEvent.setup();
    await toPlanStep(user);
    const plans = within(screen.getByRole('radiogroup', { name: 'Choose a plan' }));
    expect(plans.getAllByRole('radio')).toHaveLength(3);
    expect(plans.getByRole('radio', { name: /Starter/ })).toHaveTextContent('₹2,500');
    expect(plans.getByRole('radio', { name: /Business/ })).toHaveTextContent('₹7,500');
    expect(plans.getByRole('radio', { name: /Growth/ })).toHaveTextContent('₹15,000');
    expect(plans.getByRole('radio', { name: /Business/ })).toHaveAttribute('aria-checked', 'true');
    expect(plans.getByRole('radio', { name: /Business/ })).toHaveTextContent('Recommended');
    expect(screen.getByRole('link', { name: /Talk to us about Enterprise/ })).toHaveAttribute('href', expect.stringContaining('mailto:info@bulkskart.com'));
  });

  it('shows the whole price, tax and fee included, before anything is paid', async () => {
    const user = userEvent.setup();
    await toPlanStep(user);
    const price = within(screen.getByLabelText('Price breakdown'));
    expect(price.getByText('Business plan, 30 days').closest('div[class*="justify-between"]')).toHaveTextContent('₹7,500');
    expect(price.getByText('18% GST').closest('div[class*="justify-between"]')).toHaveTextContent('+₹1,350');
    expect(price.getByText('Payment gateway fee').closest('div[class*="justify-between"]')).toHaveTextContent('+₹177');
    expect(price.getByText('Total payable today').closest('div[class*="justify-between"]')).toHaveTextContent('₹9,027');
    expect(screen.getByRole('button', { name: /Pay ₹9,027 and activate Business/ })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Starter/ }));
    expect(price.getByText('Total payable today').closest('div[class*="justify-between"]')).toHaveTextContent('₹3,009');
    expect(screen.getByRole('button', { name: /Pay ₹3,009 and activate Starter/ })).toBeInTheDocument();
  });

  it('opens the payment for the chosen plan, for this company, with the person\'s details filled in', async () => {
    const user = userEvent.setup();
    await toPlanStep(user);
    await user.click(screen.getByRole('radio', { name: /Growth/ }));
    await user.click(screen.getByRole('button', { name: /Pay ₹18,054 and activate Growth/ }));

    expect(razorpay.start).toHaveBeenCalledTimes(1);
    const options = razorpay.start.mock.calls[0][0];
    expect(options).toMatchObject({
      plan_tier: 'growth',
      plan_label: 'Growth Plan',
      price_inr: 18054,
      billing_cycle: 'monthly',
      company_id: 'company-1',
      user_name: 'Ravi Kumar',
      user_email: 'ravi@company.in',
      user_phone: '+919876543210',
    });
    expect(analytics.trackEvent).toHaveBeenCalledWith('manufacturer_signup_checkout', { plan: 'growth', amount: 18054 });

    // once paid, the rest of the app is told to look at the account again, so the new plan shows at once
    (auth.value.refreshProfile as ReturnType<typeof vi.fn>).mockClear();
    act(() => options.onSuccess());
    expect(auth.value.refreshProfile).toHaveBeenCalledWith('user-1');
  });

  it('shows a payment in progress, and cannot be pressed twice', async () => {
    const user = userEvent.setup();
    await toPlanStep(user);
    razorpay.loading = true;
    fireEvent.click(screen.getByRole('radio', { name: /Starter/ }));
    expect(screen.getByRole('button', { name: /Opening secure payment/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Skip for now/ })).toBeDisabled();
  });

  it('lets the person look around first: skipping goes to the dashboard', async () => {
    const user = userEvent.setup();
    await toPlanStep(user);
    await user.click(screen.getByRole('button', { name: /Skip for now/ }));
    expect(where()).toBe('/dashboard/supplier');
    expect(razorpay.start).not.toHaveBeenCalled();
  });

  it('is honest about what is locked until a plan is active, and about how long a payment lasts', async () => {
    const user = userEvent.setup();
    await toPlanStep(user);
    expect(screen.getByText(/Until a plan is active, buyer contacts and RFQ quotes stay locked/)).toBeInTheDocument();
    expect(screen.getByText('One payment gives you 30 days on the plan.')).toBeInTheDocument();
    expect(screen.getByText(/pay securely with Razorpay/i)).toBeInTheDocument();
  });
});

describe('people who are already signed in', () => {
  it('takes a manufacturer who has a company straight to the plans', async () => {
    auth.value = { ...auth.value, user: { id: 'user-9', email: 'meena@mills.in' }, resolvedRole: 'supplier', company: { id: 'company-9' }, profile: { full_name: 'Meena Iyer', phone: '+919811111111' } };
    renderAt();
    expect(await screen.findByRole('heading', { name: /You are in, Meena!/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pay ₹9,027/ }));
    expect(razorpay.start.mock.calls[0][0]).toMatchObject({ company_id: 'company-9', user_email: 'meena@mills.in', user_name: 'Meena Iyer', user_phone: '+919811111111' });
  });

  it('sends a manufacturer who has already paid to the dashboard instead', async () => {
    auth.value = { ...auth.value, user: { id: 'user-9' }, resolvedRole: 'supplier', company: { id: 'company-9' }, isPaidSubscriber: true };
    renderAt();
    await waitFor(() => expect(where()).toBe('/dashboard/supplier'));
  });

  it('sends an admin to the admin dashboard', async () => {
    auth.value = { ...auth.value, user: { id: 'admin-1' }, resolvedRole: 'admin' };
    renderAt();
    await waitFor(() => expect(where()).toBe('/dashboard/admin'));
  });

  it('asks a manufacturer with no company yet only for the business, not for a second login', async () => {
    const user = userEvent.setup();
    auth.value = { ...auth.value, user: { id: 'user-5', email: 'new@factory.in' }, resolvedRole: 'supplier', company: null, profile: { full_name: 'Asha Rao' } };
    renderAt();
    await describeYourBusiness();
    await user.click(screen.getByRole('button', { name: /Looks right, continue/ }));
    expect(await screen.findByRole('heading', { name: 'Confirm your business' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Work e-mail')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Company or factory name'), 'Asha Plastics');
    await user.type(screen.getByLabelText('Mobile number'), '9822012345');
    await user.click(screen.getByRole('button', { name: /Save and choose a plan/ }));
    await screen.findByRole('heading', { name: /You are in, Asha!/ });
    expect(auth.value.signUp).not.toHaveBeenCalled();
    expect(saver.save.mock.calls[0][1]).toBe('user-5');
    expect(saver.save.mock.calls[0][0]).toMatchObject({ companyName: 'Asha Plastics', fullName: 'Asha Rao', phone: '+919822012345' });
  });

  it('does not push a buyer through a manufacturer sign-up, and offers to sign out', async () => {
    const user = userEvent.setup();
    auth.value = { ...auth.value, user: { id: 'buyer-1' }, resolvedRole: 'buyer', dashboardPath: '/dashboard/buyer' };
    renderAt();
    expect(screen.getByRole('heading', { name: 'You are signed in as a buyer' })).toBeInTheDocument();
    expect(screen.queryByLabelText('About your business')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Sign out and register as a manufacturer/ }));
    expect(auth.value.signOut).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /Go to my buyer dashboard/ }));
    expect(where()).toBe('/dashboard/buyer');
  });

  it('waits for the account to load before deciding anything', () => {
    auth.value = { ...auth.value, loading: true };
    renderAt();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByLabelText('About your business')).not.toBeInTheDocument();
  });
});

describe('the way in and out', () => {
  it('has a sign-in link, the full form and a person to talk to', () => {
    renderAt();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth?tab=login');
    expect(screen.getByRole('link', { name: 'Use the detailed form' })).toHaveAttribute('href', '/auth?tab=supplier&form=full');
    expect(screen.getByRole('link', { name: /Chat with us on WhatsApp/ })).toHaveAttribute('href', expect.stringContaining('wa.me/'));
  });

  it('carries the page the person came from through sign-in, the detailed form and the end of the sign-up', async () => {
    const user = userEvent.setup();
    renderAt('/signup/manufacturer?redirect=%2Fbuyers%2Fsuresh-traders');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth?tab=login&redirect=%2Fbuyers%2Fsuresh-traders');
    expect(screen.getByRole('link', { name: 'Use the detailed form' })).toHaveAttribute('href', '/auth?tab=supplier&form=full&redirect=%2Fbuyers%2Fsuresh-traders');

    await describeYourBusiness();
    await user.click(screen.getByRole('button', { name: /Looks right, continue/ }));
    await screen.findByRole('heading', { name: 'Create your login' });
    await fillAccount(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Create account and choose a plan/ }));
    await screen.findByRole('heading', { name: /You are in/ });
    await user.click(screen.getByRole('button', { name: /Skip for now/ }));
    expect(where()).toBe('/buyers/suresh-traders');
  });

  it('never follows a link to another site', async () => {
    const user = userEvent.setup();
    renderAt('/signup/manufacturer?redirect=https%3A%2F%2Fevil.example');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth?tab=login');
    await describeYourBusiness();
    await user.click(screen.getByRole('button', { name: /Looks right, continue/ }));
    await screen.findByRole('heading', { name: 'Create your login' });
    await fillAccount(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /Create account and choose a plan/ }));
    await screen.findByRole('heading', { name: /You are in/ });
    await user.click(screen.getByRole('button', { name: /Skip for now/ }));
    expect(where()).toBe('/dashboard/supplier');
  });
});
