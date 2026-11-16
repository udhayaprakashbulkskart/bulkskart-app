import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Radix measures some parts, and jsdom has no ResizeObserver
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn(), info: vi.fn(), warning: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth.value }));

/** a small stand-in for the Supabase client: each test says what a table returns */
const db = vi.hoisted(() => ({
  inserts: [] as Array<{ table: string; row: unknown }>,
  results: {} as Record<string, { data: unknown; error: unknown }>,
  authListener: null as null | ((event: string) => void),
  updateUser: vi.fn(),
}));
vi.mock('@/db/supabase', () => {
  const query = (table: string) => {
    const result = () => db.results[table] ?? { data: null, error: null };
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'order', 'limit']) chain[name] = () => chain;
    chain.maybeSingle = async () => result();
    chain.single = async () => result();
    chain.insert = (row: unknown) => {
      db.inserts.push({ table, row });
      return chain;
    };
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => query(table),
      auth: {
        onAuthStateChange: (callback: (event: string) => void) => {
          db.authListener = callback;
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        updateUser: db.updateUser,
      },
      storage: { from: () => ({ upload: async () => ({ data: null, error: { message: 'no storage in tests' } }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    },
  };
});

const api = vi.hoisted(() => ({ createQuotation: vi.fn(), createCompanyReview: vi.fn(), checkSupplierPaidSubscription: vi.fn() }));
vi.mock('@/lib/api', () => api);

import { Stepper, CountedTextArea, RatingPicker, FormDialog, optionsWith, PAYMENT_TERMS } from '@/components/formkit';
import { catalogueInr, generateAIQuotationDraft, type MatchedProduct } from '@/lib/aiSalesAssistant';
import ReportItemModal from '@/components/common/ReportItemModal';
import SubmitQuotationWizard from '@/components/rfq/SubmitQuotationWizard';
import CompanyReviewsAndRatingSection from '@/components/common/CompanyReviewsAndRatingSection';
import PasswordRecoveryDialog from '@/components/common/PasswordRecoveryDialog';
import type { Requirement } from '@/types/types';

beforeEach(() => {
  vi.clearAllMocks();
  db.inserts = [];
  db.results = {};
  db.authListener = null;
  auth.value = { user: null, profile: null, company: null };
});

const requirement = {
  id: 'req-1',
  title: 'Corrugated 5-ply cartons 18x12x10 in',
  quantity: 5000,
  quantity_unit: 'Pcs',
  budget_min: 28,
  budget_max: 34,
} as unknown as Requirement;

const matched = (overrides: Partial<MatchedProduct> = {}): MatchedProduct => ({
  id: 'p-1',
  name: 'Corrugated 5-ply cartons printed',
  slug: 'cartons',
  price: 29,
  priceCurrency: 'INR',
  priceINR: 29,
  moq: 1000,
  moqUnit: 'Pcs',
  availableQuantity: 0,
  estimatedDeliveryDays: 0,
  matchScore: 92,
  unitCompatibility: true,
  ...overrides,
});

describe('catalogue prices in rupees', () => {
  it('keeps a rupee price as it is, even under 1,000', () => {
    expect(catalogueInr(450, 'INR')).toBe(450);
    expect(catalogueInr(29, 'inr')).toBe(29);
  });
  it('converts a dollar price', () => {
    expect(catalogueInr(10, 'USD', 83.5)).toBe(835);
  });
  it('does not guess other or missing currencies, or empty prices', () => {
    expect(catalogueInr(100, 'EUR')).toBe(0);
    expect(catalogueInr(100, null)).toBe(0);
    expect(catalogueInr(0, 'INR')).toBe(0);
    expect(catalogueInr(null, 'INR')).toBe(0);
  });
});

describe('the AI quotation draft only starts from real numbers', () => {
  it('uses the catalogue price and MOQ, and fills in nothing else', () => {
    const draft = generateAIQuotationDraft(requirement, matched());
    expect(draft).toMatchObject({ unitPrice: 29, priceSource: 'catalogue', moq: 1000, quantity: 5000, deliveryDays: 0, paymentTerms: '', deliveryTerms: '' });
    expect(draft.notes).toContain(requirement.title);
    expect(draft.notes).not.toMatch(/escrow|inspection|export documentation/i);
  });
  it("falls back to the buyer's budget when the product has no price", () => {
    const draft = generateAIQuotationDraft(requirement, matched({ priceINR: 0, price: 0 }));
    expect(draft).toMatchObject({ unitPrice: 34, priceSource: 'buyer' });
  });
  it('leaves the price empty when nothing real is known', () => {
    const draft = generateAIQuotationDraft({ ...requirement, budget_min: null, budget_max: null } as unknown as Requirement, null);
    expect(draft).toMatchObject({ unitPrice: 0, priceSource: null, moq: 0 });
  });
  it('reads a raw catalogue product without inflating a rupee price', () => {
    const product = { id: 'p-2', name: 'Tiffin', price_min: 450, price_currency: 'INR', moq: 100 } as never;
    expect(generateAIQuotationDraft(requirement, product).unitPrice).toBe(450);
  });
});

describe('term lists', () => {
  it('keeps a value that is not in the list at the front', () => {
    expect(optionsWith(PAYMENT_TERMS, '30% advance, 70% on BL')[0]).toBe('30% advance, 70% on BL');
    expect(optionsWith(PAYMENT_TERMS, 'Net 30')).toEqual([...PAYMENT_TERMS]);
    expect(optionsWith(PAYMENT_TERMS, '  ')).toEqual([...PAYMENT_TERMS]);
  });
});

describe('kit fields', () => {
  function StepperHarness({ start = '5', min = 1, max = 7 }: { start?: string; min?: number; max?: number }) {
    const [value, setValue] = useState(start);
    return (
      <>
        <label htmlFor="qty">Quantity</label>
        <Stepper id="qty" value={value} onChange={setValue} min={min} max={max} unitName="pieces" />
      </>
    );
  }

  it('the stepper counts up and down within its limits', async () => {
    const user = userEvent.setup();
    render(<StepperHarness />);
    const box = screen.getByLabelText('Quantity') as HTMLInputElement;
    await user.click(screen.getByRole('button', { name: 'More pieces' }));
    await user.click(screen.getByRole('button', { name: 'More pieces' }));
    expect(box.value).toBe('7');
    expect(screen.getByRole('button', { name: 'More pieces' })).toBeDisabled();
    await user.clear(box);
    await user.type(box, '0');
    fireEvent.blur(box);
    expect(box.value).toBe('1');
    expect(screen.getByRole('button', { name: 'Less pieces' })).toBeDisabled();
  });

  it('the counted text box shows how much room is used', () => {
    render(<CountedTextArea aria-label="Notes" value="hello" maxLength={500} onChange={() => {}} />);
    expect(screen.getByText('5 / 500')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toHaveAttribute('maxlength', '500');
  });

  it('the star picker is a radio group that works with the keyboard', async () => {
    function Harness() {
      const [value, setValue] = useState(3);
      return (
        <>
          <span id="rating-label">Your rating</span>
          <RatingPicker id="rating" value={value} onChange={setValue} labelledBy="rating-label" />
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Your rating' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    const three = screen.getByRole('radio', { name: /^3 stars/ });
    expect(three).toHaveAttribute('aria-checked', 'true');
    three.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: /^4 stars/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: /^1 star,/ }));
    expect(screen.getByRole('radio', { name: /^1 star,/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('a dialog cannot be closed by accident while it is busy', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <FormDialog open onOpenChange={onOpenChange} title="Report" busy>
        <p>body</p>
      </FormDialog>,
    );
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
    rerender(
      <FormDialog open onOpenChange={onOpenChange} title="Report">
        <p>body</p>
      </FormDialog>,
    );
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('report form', () => {
  const COMPANY = '33333333-3333-4333-8333-333333333333';
  const renderReport = () =>
    render(
      <MemoryRouter>
        <ReportItemModal open onOpenChange={() => {}} targetType="company" targetId={COMPANY} targetTitle="Sunrise Steelware" />
      </MemoryRouter>,
    );

  it('saves a signed-in report to the reports table', async () => {
    auth.value = { user: { id: 'user-1' } };
    db.results.reports = { data: { id: 'abcdef12-0000-4000-8000-000000000000' }, error: null };
    const user = userEvent.setup();
    renderReport();
    await user.selectOptions(screen.getByLabelText(/Reason for reporting/), 'fraud');
    await user.type(screen.getByLabelText(/Details & Evidence/), 'Asked for payment to a personal account.');
    await user.click(screen.getByRole('button', { name: /Submit Report/ }));
    await screen.findByText('Report received');
    expect(db.inserts).toEqual([
      {
        table: 'reports',
        row: expect.objectContaining({ reporter_id: 'user-1', reason: 'fraud', reported_company_id: COMPANY, reported_product_id: null }),
      },
    ]);
    expect(screen.getByText('ABCDEF12')).toBeInTheDocument();
  });

  it('checks the details before sending', async () => {
    auth.value = { user: { id: 'user-1' } };
    const user = userEvent.setup();
    renderReport();
    await user.selectOptions(screen.getByLabelText(/Reason for reporting/), 'fraud');
    await user.type(screen.getByLabelText(/Details & Evidence/), 'too short');
    await user.click(screen.getByRole('button', { name: /Submit Report/ }));
    expect(await screen.findByText(/at least 10 characters/)).toBeInTheDocument();
    expect(db.inserts).toEqual([]);
  });

  it('asks a visitor to log in or e-mail the report instead of pretending to file it', () => {
    renderReport();
    expect(screen.getByRole('link', { name: /Log in to report/ })).toHaveAttribute('href', '/auth?tab=login');
    expect(screen.getByRole('link', { name: /E-mail it/ }).getAttribute('href')).toMatch(/^mailto:info@bulkskart\.com\?subject=/);
    expect(screen.queryByRole('button', { name: /Submit Report/ })).not.toBeInTheDocument();
  });
});

describe('RFQ quotation wizard', () => {
  const rfq = { id: 'req-1', reqNumber: 'RFQ-1', title: 'Corrugated cartons', quantity: 5000, quantityUnit: 'Pcs', targetPriceMin: 28, targetPriceMax: 34 };
  const supplier = () => {
    auth.value = { user: { id: 'user-1' }, profile: { role: 'supplier' }, company: { id: 'company-1' } };
  };
  const fillAndReview = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText(/Unit Price/), '31');
    await user.type(screen.getByLabelText(/Delivery Time/), '12');
    await user.click(screen.getByRole('button', { name: /Review Quotation/ }));
  };

  it('sends the supplier, company and buyer with the price, GST and total', async () => {
    supplier();
    db.results.requirements = { data: { id: 'req-1', buyer_id: 'buyer-1' }, error: null };
    api.createQuotation.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SubmitQuotationWizard open onOpenChange={() => {}} rfq={rfq} />);
    expect(screen.getByText(/Within the buyer's budget|The buyer's budget/)).toBeInTheDocument();
    await fillAndReview(user);
    expect(screen.getByText('₹1,82,900')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Submit Quotation/ }));
    await screen.findByText('Your quotation is with the buyer');
    expect(api.createQuotation).toHaveBeenCalledWith(
      expect.objectContaining({
        requirement_id: 'req-1',
        supplier_id: 'user-1',
        supplier_company_id: 'company-1',
        buyer_id: 'buyer-1',
        unit_price: 31,
        quantity: 5000,
        delivery_days: 12,
        tax_amount: 27900,
        total_price: 182900,
      }),
    );
  });

  it('starts empty and checks the price and delivery time', async () => {
    supplier();
    const user = userEvent.setup();
    render(<SubmitQuotationWizard open onOpenChange={() => {}} rfq={rfq} />);
    expect((screen.getByLabelText(/Unit Price/) as HTMLInputElement).value).toBe('');
    await user.click(screen.getByRole('button', { name: /Review Quotation/ }));
    expect(await screen.findByText(/unit price greater than 0/)).toBeInTheDocument();
    expect(screen.getByText(/how many days delivery takes/)).toBeInTheDocument();
  });

  it('does not send to a request that is not saved', async () => {
    supplier();
    db.results.requirements = { data: null, error: null };
    const user = userEvent.setup();
    render(<SubmitQuotationWizard open onOpenChange={() => {}} rfq={rfq} />);
    await fillAndReview(user);
    await user.click(screen.getByRole('button', { name: /Submit Quotation/ }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/not an open buyer request/)));
    expect(api.createQuotation).not.toHaveBeenCalled();
  });

  it('shows the error when saving fails instead of claiming success', async () => {
    supplier();
    db.results.requirements = { data: { id: 'req-1', buyer_id: 'buyer-1' }, error: null };
    api.createQuotation.mockResolvedValue({ error: 'Monthly post response quota exceeded' });
    const user = userEvent.setup();
    render(<SubmitQuotationWizard open onOpenChange={() => {}} rfq={rfq} />);
    await fillAndReview(user);
    await user.click(screen.getByRole('button', { name: /Submit Quotation/ }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Monthly post response quota exceeded'));
    expect(screen.queryByText('Your quotation is with the buyer')).not.toBeInTheDocument();
  });
});

describe('supplier reviews', () => {
  const renderReviews = (onReviewAdded = vi.fn()) => {
    render(
      <MemoryRouter>
        <CompanyReviewsAndRatingSection companyId="company-9" companyName="Sunrise Steelware" reviews={[]} onReviewAdded={onReviewAdded} />
      </MemoryRouter>,
    );
    return onReviewAdded;
  };

  it('shows a review only once it is saved', async () => {
    auth.value = { user: { id: 'user-1', email: 'kiran@example.com' }, profile: { full_name: 'Kiran' } };
    api.createCompanyReview.mockResolvedValue({ error: 'permission denied' });
    const user = userEvent.setup();
    const added = renderReviews();
    await user.type(screen.getByLabelText(/Your review/), 'Packing was fine, delivery a week late.');
    await user.click(screen.getByRole('button', { name: /Post Review/ }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(added).not.toHaveBeenCalled();

    api.createCompanyReview.mockResolvedValue({ error: null });
    await user.click(screen.getByRole('button', { name: /Post Review/ }));
    await waitFor(() => expect(added).toHaveBeenCalledWith(expect.objectContaining({ company_id: 'company-9', rating: 5 })));
  });

  it('has no made-up rating', () => {
    renderReviews();
    expect(screen.getByText('No ratings yet')).toBeInTheDocument();
    expect(screen.queryByText(/4\.9/)).not.toBeInTheDocument();
  });

  it('asks a visitor to log in', () => {
    renderReviews();
    expect(screen.getByRole('link', { name: /Log In/ }).getAttribute('href')).toMatch(/^\/login\?returnUrl=/);
    expect(screen.queryByRole('button', { name: /Post Review/ })).not.toBeInTheDocument();
  });
});

describe('new password after a reset link', () => {
  it('opens on the recovery event and saves the new password', async () => {
    db.updateUser.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<PasswordRecoveryDialog />);
    expect(screen.queryByText('New Password')).not.toBeInTheDocument();
    act(() => db.authListener?.('PASSWORD_RECOVERY'));
    const password = await screen.findByLabelText(/^New password/);
    await user.type(password, 'longenough1');
    await user.type(screen.getByLabelText(/Confirm new password/), 'different1');
    await user.click(screen.getByRole('button', { name: /Save New Password/ }));
    expect(await screen.findByText('The two passwords do not match.')).toBeInTheDocument();
    expect(db.updateUser).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/Confirm new password/));
    await user.type(screen.getByLabelText(/Confirm new password/), 'longenough1');
    await user.click(screen.getByRole('button', { name: /Save New Password/ }));
    await screen.findByText('Password changed');
    expect(db.updateUser).toHaveBeenCalledWith({ password: 'longenough1' });
  });
});
