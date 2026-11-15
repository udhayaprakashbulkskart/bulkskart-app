import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The database a page reads from: rows per table, and the counts the pages ask for with `head: true`. */
const db = vi.hoisted(() => ({ rows: {} as Record<string, unknown[]>, counts: {} as Record<string, number> }));

vi.mock('@/db/supabase', () => {
  const query = (table: string) => {
    const result = () => ({ data: db.rows[table] ?? [], count: db.counts[table] ?? db.rows[table]?.length ?? 0, error: null });
    const chain: Record<string, unknown> = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
          if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve({ data: (db.rows[table] ?? [])[0] ?? null, error: null });
          return () => chain;
        },
      },
    );
    return chain;
  };
  return { supabase: { from: (table: string) => query(table), rpc: () => Promise.resolve({ data: null, error: null }) } };
});

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth.value }));

const api = vi.hoisted(() => ({
  getRequirements: vi.fn(),
  getProducts: vi.fn(),
  getMyQuotations: vi.fn(),
  ensureManufacturerWelcomeLeads: vi.fn(() => ({ seeded: false })),
}));
vi.mock('@/lib/api', () => api);

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn(), info: vi.fn() } }));
// the shell has its own tests; these pages are checked for the figures they work out
vi.mock('@/components/layouts/DashboardLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/common/PageMeta', () => ({ default: () => null }));
vi.mock('@/components/common/MatchedRequirementsPanel', () => ({ default: () => <div>matched requirements</div> }));
vi.mock('@/components/common/AIOpportunityCard', () => ({ default: () => <div>ai opportunities</div> }));
vi.mock('@/lib/aiSalesAssistant', () => ({
  analyzeAndMatchOpportunities: () => [],
  generateAIOpportunitySummary: () => ({ totalOpportunities: 0, highPriorityCount: 0, mediumPriorityCount: 0, lowPriorityCount: 0, averageMatchScore: 0, potentialBusinessINR: 0, potentialBusinessINRFormatted: '₹0' }),
}));

import BuyerDashboard from '@/pages/dashboard/buyer/BuyerDashboard';
import SupplierDashboard from '@/pages/dashboard/supplier/SupplierDashboard';
import AdminDashboardFull from '@/pages/dashboard/admin/AdminDashboardFull';

const now = new Date();
/** A date `back` months ago, in the middle of that month (so no time zone moves it into another month) */
const monthsAgo = (back: number) => new Date(now.getFullYear(), now.getMonth() - back, 15, 12).toISOString();
const dated = (counts: number[]) => counts.flatMap((n, back) => Array.from({ length: n }, () => ({ created_at: monthsAgo(back) })));

function card(title: string) {
  const el = screen.getByText(title, { selector: '.dk-title' }).closest('.dk') as HTMLElement;
  return within(el);
}

beforeEach(() => {
  db.rows = {};
  db.counts = {};
  api.getRequirements.mockReset();
  api.getProducts.mockReset().mockResolvedValue([]);
  api.getMyQuotations.mockReset().mockResolvedValue([]);
});

describe('Buyer dashboard: the figures', () => {
  beforeEach(() => {
    auth.value = { user: { id: 'u-1' }, buyerProfile: { onboarding_completed: true }, resolvedRole: 'buyer', loading: false };
    // four requirements, two of them with a quote
    api.getRequirements.mockResolvedValue([
      { id: 'r1', title: 'Steel pipes', quantity: 500, quantity_unit: 'Pcs', deadline: null, status: 'active', quote_count: 2 },
      { id: 'r2', title: 'Cotton yarn', quantity: 900, quantity_unit: 'Kg', deadline: null, status: 'active', quote_count: 0 },
      { id: 'r3', title: 'Cartons', quantity: 3000, quantity_unit: 'Pcs', deadline: null, status: 'closed', quote_count: 1 },
      { id: 'r4', title: 'Resin', quantity: 40, quantity_unit: 'MT', deadline: null, status: 'active', quote_count: 0 },
    ]);
    // this month 3 requirements, last month 2; this month 6 quotes, last month 4
    db.rows.requirements = dated([3, 2]);
    db.rows.quotations = dated([6, 4]);
    db.counts = { quotations: 90, orders: 5, conversations: 2, saved_manufacturers: 3, notifications: 1, disputes: 0 };
    db.rows.buyer_profiles = [{ verification_status: 'verified' }];
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <BuyerDashboard />
      </MemoryRouter>,
    );

  it('shows the counts the buyer has, each leading to its page', async () => {
    renderPage();
    await waitFor(() => expect(card('Requirements Posted').getByText('4')).toBeInTheDocument());
    expect(card('Quotes Received').getByText('90')).toBeInTheDocument();
    expect(screen.getByText('Quotes Received', { selector: '.dk-title' }).closest('a')).toHaveAttribute('href', '/dashboard/buyer/quotes');
    expect(screen.getByText('Active Orders', { selector: '.dk-title' }).closest('a')).toHaveAttribute('href', '/dashboard/buyer/orders');
  });

  it('works out the change since last month from the dates on the buyer\'s own rows', async () => {
    renderPage();
    await waitFor(() => expect(card('Requirements Posted').getByText(/50%/)).toBeInTheDocument());
    expect(card('Requirements Posted').getByText(/50%/).closest('p')).toHaveClass('is-up');
    // 6 quotes this month against 4 last month is also +50%
    expect(card('Quotes Received').getByText(/50%/)).toBeInTheDocument();
  });

  it('works out the share of requirements that have a quote for the gauge', async () => {
    renderPage();
    // two of the four requirements have at least one quote
    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Requirements with quotes: 50%' })).toBeInTheDocument();
  });

  it('shows this month\'s requirements and quotes under the gauge', async () => {
    renderPage();
    const posted = (await screen.findByText('Posted this month')).closest('.dmini') as HTMLElement;
    expect(within(posted).getByText('3')).toBeInTheDocument();
    const quotes = screen.getByText('Quotes this month').closest('.dmini') as HTMLElement;
    expect(within(quotes).getByText('6')).toBeInTheDocument();
  });

  it('draws the chart from the same rows, one bar per month with requirements', async () => {
    const { container } = renderPage();
    await waitFor(() => expect(container.querySelectorAll('.dbar')).toHaveLength(2));
    expect(screen.getByRole('img', { name: 'Requirements posted and quotes received in each of the last 12 months' })).toBeInTheDocument();
  });

  it('says there is nothing to chart or measure, instead of inventing it, for a new buyer', async () => {
    api.getRequirements.mockResolvedValue([]);
    db.rows.requirements = [];
    db.rows.quotations = [];
    db.counts = {};
    const { container } = renderPage();
    expect(await screen.findByText('No requirements or quotes in the last 12 months yet.')).toBeInTheDocument();
    expect(container.querySelector('.dbar')).toBeNull();
    expect(screen.getByText('Post a requirement to start')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Requirements with quotes: no data yet' })).toBeInTheDocument();
  });

  it('shows no arrow for a figure that has nothing to be compared with', async () => {
    db.rows.requirements = dated([3]); // nothing last month
    renderPage();
    await screen.findByText('Posted this month');
    await waitFor(() => expect(within(card('Requirements Posted').getByText('4').closest('.dk') as HTMLElement).queryByText(/%/)).not.toBeInTheDocument());
  });

  it('keeps the verification prompt for a buyer who is not verified', async () => {
    db.rows.buyer_profiles = [{ verification_status: 'pending' }];
    renderPage();
    expect(await screen.findByText('Get Verified Buyer Badge')).toBeInTheDocument();
  });

  it('lists the latest requirements in a table', async () => {
    renderPage();
    // the chart keeps a table of its own for screen readers, so pick the one with the requirements in it
    await screen.findByText('Steel pipes');
    const table = screen.getAllByRole('table').find((candidate) => within(candidate).queryByText('Steel pipes')) as HTMLElement;
    expect(within(table).getByText('Steel pipes')).toBeInTheDocument();
    expect(within(table).getByText('500 Pcs')).toBeInTheDocument();
  });

  it('shows the counts of saved manufacturers, chats and alerts on the quick links', async () => {
    renderPage();
    const saved = await screen.findByRole('link', { name: /Saved Manufacturers/ });
    await waitFor(() => expect(saved).toHaveTextContent('3'));
    expect(screen.getByRole('link', { name: /Active Chats/ })).toHaveTextContent('2');
    expect(screen.getByRole('link', { name: /Notifications/ })).toHaveTextContent('1');
  });
});

describe('Supplier dashboard: the figures', () => {
  beforeEach(() => {
    auth.value = { user: { id: 'u-2' }, profile: { role: 'supplier' }, company: { id: 'co-1', company_name: 'Vadodara Polymer Pipe Industries', is_verified: true, onboarding_completed: true, verification_status: 'verified' } };
    db.counts = { products: 6, quotations: 90, orders: 40, notifications: 2, disputes: 0 };
    db.rows.quotations = dated([9, 6]);
    db.rows.orders = dated([3, 2]);
    db.rows.subscriptions = [{ tier: 'growth', ends_at: null, max_rfq_leads: 50, used_rfq_leads: 18, max_products: 100 }];
    db.rows.companies = [{ response_rate: 87, avg_response_hours: 3, total_revenue: 1250000, wallet_balance: 48000, withdrawable_balance: 12000 }];
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <SupplierDashboard />
      </MemoryRouter>,
    );

  it('shows the company, its counts and where each leads', async () => {
    renderPage();
    expect(await screen.findByText('Vadodara Polymer Pipe Industries')).toBeInTheDocument();
    await waitFor(() => expect(card('Listed Products').getByText('6')).toBeInTheDocument());
    expect(card('Quotes Sent').getByText('90')).toBeInTheDocument();
    expect(screen.getByText('Listed Products', { selector: '.dk-title' }).closest('a')).toHaveAttribute('href', '/dashboard/supplier/products');
    expect(screen.getByText('Quotes Sent', { selector: '.dk-title' }).closest('a')).toHaveAttribute('href', '/dashboard/supplier/quotations');
  });

  it('shows the response rate the company has on the gauge', async () => {
    renderPage();
    expect(await screen.findByText('87%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Replying to buyers: 87%' })).toBeInTheDocument();
  });

  it('shows the money and the leads the subscription still allows', async () => {
    renderPage();
    await waitFor(() => expect(card('Wallet Balance').getByText('₹48,000')).toBeInTheDocument());
    expect(card('Total Revenue').getByText('₹1,250,000')).toBeInTheDocument();
    expect(card('Avg Response Time').getByText('3h')).toBeInTheDocument();
    const leads = card('RFQ Leads Left');
    expect(leads.getByText('32')).toBeInTheDocument();
    expect(leads.getByText('/ 50')).toBeInTheDocument();
  });

  it('works out the change since last month for quotes and orders', async () => {
    renderPage();
    // 9 quotes this month against 6 last month: +50%; 3 orders against 2: +50%
    await waitFor(() => expect(card('Quotes Sent').getByText(/50%/)).toBeInTheDocument());
    expect(card('Active Orders').getByText(/50%/)).toBeInTheDocument();
    const quotes = screen.getByText('Quotes this month').closest('.dmini') as HTMLElement;
    expect(within(quotes).getByText('9')).toBeInTheDocument();
  });

  it('shows the unpaid-account prompt when there is no subscription', async () => {
    db.rows.subscriptions = [];
    renderPage();
    expect(await screen.findByText('Action Required: Unpaid Manufacturer Account')).toBeInTheDocument();
  });

  it('keeps the AI matches and the matched requirements', async () => {
    renderPage();
    expect(await screen.findByText('ai opportunities')).toBeInTheDocument();
    expect(screen.getByText('matched requirements')).toBeInTheDocument();
  });

  it('shows the wallet notice only when the wallet holds something', async () => {
    renderPage();
    expect(await screen.findByText(/Withdrawable: ₹12,000/)).toBeInTheDocument();
  });
});

describe('Admin dashboard: the figures', () => {
  beforeEach(() => {
    auth.value = { profile: { role: 'admin' }, user: { id: 'u-3' } };
    // nine companies, six of them verified; sign-ups and join dates over the months
    const company = (i: number, status: string, back: number) => ({ id: `co-${i}`, company_name: `Company ${i} Industries`, business_type: 'Manufacturer', city: 'Pune', verification_status: status, created_at: monthsAgo(back), profiles: { full_name: `Owner ${i}`, email: `o${i}@example.com`, role: 'supplier' } });
    db.rows.companies = [
      company(1, 'pending', 0), company(2, 'verified', 0), company(3, 'verified', 1), company(4, 'pending', 1),
      company(5, 'verified', 2), company(6, 'verified', 3), company(7, 'pending', 4), company(8, 'verified', 5), company(9, 'verified', 6),
    ];
    db.rows.profiles = dated([12, 8]);
    db.counts = { profiles: 114, requirements: 57, orders: 35 };
    db.rows.disputes = [];
    db.rows.fraud_alerts = [];
    db.rows.withdrawal_requests = [];
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <AdminDashboardFull />
      </MemoryRouter>,
    );

  const kpi = (title: string) => screen.getByText(title, { selector: '.dk-title' }).closest('.dk') as HTMLElement;

  it('shows the platform counts', async () => {
    renderPage();
    await waitFor(() => expect(within(kpi('Total Users')).getByText('114')).toBeInTheDocument());
    expect(within(kpi('Companies')).getByText('9')).toBeInTheDocument();
    expect(within(kpi('Pending Verifications')).getByText('3')).toBeInTheDocument();
    expect(within(kpi('Active RFQs')).getByText('57')).toBeInTheDocument();
    expect(within(kpi('Total Orders')).getByText('35')).toBeInTheDocument();
  });

  it('works out the share of companies that are verified for the gauge', async () => {
    renderPage();
    // six of the nine companies are verified
    expect(await screen.findByText('66.7%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Verified companies: 66.7%' })).toBeInTheDocument();
  });

  it('shows this month\'s new companies and sign-ups, with the change since last month', async () => {
    renderPage();
    const companies = (await screen.findByText('New companies this month')).closest('.dmini') as HTMLElement;
    expect(within(companies).getByText('2')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByText('New sign-ups this month').closest('.dmini') as HTMLElement).getByText('12')).toBeInTheDocument());
    // 12 sign-ups this month against 8 last month: +50%
    expect(within(screen.getByText('New sign-ups this month').closest('.dmini') as HTMLElement).getByText('▲ 50%')).toBeInTheDocument();
  });

  it('opens the right tab from a card that leads to one, and leaves the other cards as plain cards', async () => {
    renderPage();
    await screen.findByText('66.7%');
    expect(kpi('Total Users').tagName).toBe('DIV');
    const pending = kpi('Pending Verifications');
    expect(pending.tagName).toBe('BUTTON');
    fireEvent.click(pending);
    expect(screen.getByRole('tab', { name: /Verifications/ })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Company 1 Industries')).toBeInTheDocument();
  });

  it('keeps the tabs of the control panel', async () => {
    renderPage();
    for (const name of ['Overview', 'Verifications', 'Disputes', 'Fraud & Abuse', 'Withdrawals', 'All Companies', 'Loan Requests']) {
      expect(await screen.findByRole('tab', { name: new RegExp(name.replace('&', '.')) })).toBeInTheDocument();
    }
  });

  it('says there is nothing to measure for a platform with no companies yet', async () => {
    db.rows.companies = [];
    db.rows.profiles = [];
    renderPage();
    expect(await screen.findByText('No companies yet')).toBeInTheDocument();
    expect(screen.getByText('No new companies or sign-ups in the last 12 months.')).toBeInTheDocument();
  });

  it('refuses anyone who is not an admin', async () => {
    auth.value = { profile: { role: 'buyer' }, user: { id: 'u-4' } };
    renderPage();
    expect(await screen.findByText('Access denied.')).toBeInTheDocument();
  });
});
