import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Requirement } from '@/types/types';

vi.mock('@/db/supabase', () => ({
  supabase: { channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: () => {}, storage: { from: () => ({}) } },
}));
vi.mock('@/lib/api', () => ({
  getQuotationsForRequirement: vi.fn(async () => []),
  getMessages: vi.fn(async () => []),
  sendMessage: vi.fn(),
  getOrCreateConversation: vi.fn(),
  updateQuotationStatus: vi.fn(),
  updateRequirement: vi.fn(async () => ({ error: null })),
  checkDirectMessageQuota: vi.fn(),
  checkSupplierPaidSubscription: vi.fn(),
}));
vi.mock('@/components/common/BuyerQuotationsPanel', () => ({ default: () => <p>buyer quotations panel</p> }));
vi.mock('@/components/common/SafeImage', () => ({ default: ({ alt }: { alt: string }) => <img alt={alt} /> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth.value }));

import { RequirementDetailView } from '@/components/common/RequirementDetailDrawer';

const BUYER = '00000000-0000-4000-8000-0000000000b9';
const req = {
  id: '11111111-2222-4333-8444-555555555555',
  req_number: 'RFQ-042469',
  title: 'Dell OptiPlex Business Desktop Computer',
  description: 'For a new office.',
  specifications: 'RAM: 16GB',
  quantity: 200,
  quantity_unit: 'Sets',
  destination_city: 'Bengaluru',
  destination_country: 'India',
  deadline: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
  created_at: new Date().toISOString(),
  status: 'active',
  buyer_id: BUYER,
  categories: { name: 'Electronics & Electricals' },
  profiles: { full_name: 'deepak' },
  images: [],
  quote_count: 0,
  is_verified_buyer: true,
} as unknown as Requirement;

const renderPage = (extra: Partial<Parameters<typeof RequirementDetailView>[0]> = {}) =>
  render(
    <MemoryRouter>
      <RequirementDetailView layout="page" requirement={req} onRequirementUpdated={() => {}} {...extra} />
    </MemoryRouter>,
  );

beforeEach(() => {
  auth.value = { user: null, profile: null, company: null, isPaidSubscriber: false };
});

describe('RFQ full page (the panel\'s Overview, Quotations and Chat as a page)', () => {
  it('shows the RFQ as the page heading, the overview facts and the three tabs', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: req.title })).toBeInTheDocument();
    for (const label of ['Quantity', 'Delivery', 'Ends in', 'Budget', 'Posted', 'Quotations']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('200 Sets')).toBeInTheDocument();
    for (const tab of ['Overview', 'My Quote', 'Chat']) expect(screen.getByRole('tab', { name: new RegExp(tab) })).toBeInTheDocument();
    expect(screen.getByText('Deal status')).toBeInTheDocument();
    expect(screen.getByText('For a new office.')).toBeInTheDocument();
  });

  it('gives a supplier the Chat and Send Quotation buttons inside the overview (no bottom bar)', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Send Quotation/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Chat$/ })).toBeInTheDocument();
    expect(screen.getByText(/Only Premium Suppliers \(active paid plan\) can chat and send quotations/)).toBeInTheDocument();
  });

  it('gives the buyer who posted it a way to their quotations instead', () => {
    auth.value = { user: { id: BUYER }, profile: { role: 'buyer' }, company: null, isPaidSubscriber: false };
    renderPage();
    expect(screen.queryByRole('button', { name: /Send Quotation/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'My requirements' })).toHaveAttribute('href', '/dashboard/buyer/requirements');
    fireEvent.click(screen.getByRole('button', { name: /See quotations/ }));
    expect(screen.getByText('buyer quotations panel')).toBeInTheDocument();
  });

  it('places the page\'s own extras: by the title, in the buyer card, and under each column', () => {
    renderPage({
      headerExtra: <span>loan tag</span>,
      buyerExtra: <span>buyer contact</span>,
      aside: <span>similar requirements</span>,
      below: <span>matching products</span>,
    });
    const header = screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement;
    expect(within(header).getByText('loan tag')).toBeInTheDocument();
    for (const text of ['buyer contact', 'similar requirements', 'matching products']) expect(screen.getByText(text)).toBeInTheDocument();
  });
});

describe('Opening an RFQ', () => {
  const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
  it('from the home feed goes to its full page instead of a side panel', () => {
    const feed = src('src/components/common/LiveRequirementsFeed.tsx');
    expect(feed.match(/<Link to=\{`\/requirements\/\$\{req\.id\}`\}/g)).toHaveLength(2);
    expect(feed).not.toContain('RequirementDetailDrawer');
  });
  it('the RFQ page renders the shared view as a page', () => {
    expect(src('src/pages/RequirementDetailsPage.tsx')).toContain('<RequirementDetailView\n            layout="page"');
  });
});
