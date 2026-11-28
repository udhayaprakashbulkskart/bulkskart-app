import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Requirement } from '@/types/types';
import { deliveryByLabel, deliveryDateLabel, loopUnit, rfqReferencePhoto, toLiveRfqCard } from '@/components/home/LiveRfqScrollSection';

const getOpenRequirements = vi.fn();
const checkSupplierPaidSubscription = vi.fn();
vi.mock('@/lib/api', () => ({
  getOpenRequirements: (...args: unknown[]) => getOpenRequirements(...args),
  checkSupplierPaidSubscription: (...args: unknown[]) => checkSupplierPaidSubscription(...args),
}));

const auth = vi.hoisted(() => ({
  value: {
    user: null as null | { id: string },
    profile: null as null | { role: string },
    company: null as null | { id: string },
    isPaidSubscriber: false,
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth.value }));

const fetchRfqBuyerContacts = vi.fn();
vi.mock('@/lib/profileContacts', () => ({
  fetchRfqBuyerContacts: (...args: unknown[]) => fetchRfqBuyerContacts(...args),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import LiveRfqScrollSection from '@/components/home/LiveRfqScrollSection';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const PHOTO = 'https://cdn.bulkskart.com/rfq/optiplex.jpg';

const rfq = {
  id: '5e015cc4-47a0-4e82-b1f4-271424ce7e3f',
  title: 'Dell OptiPlex Business Desktop Computer',
  quantity: 200,
  quantity_unit: 'Sets',
  destination_city: 'Bengaluru',
  destination_country: 'India',
  created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  deadline: '2026-12-12',
  images: [PHOTO],
  attachment_url: 'https://cdn.bulkskart.com/rfq/ignored-attachment.jpg',
  status: 'active',
  buyer_id: 'buyer-1',
  profiles: { full_name: 'deepak', phone: '9876543210', email: 'buyer@example.com' },
  buyer_phone: '9876543210',
  buyer_email: 'buyer@example.com',
} as unknown as Requirement;

function renderSection() {
  return render(
    <MemoryRouter>
      <LiveRfqScrollSection />
    </MemoryRouter>,
  );
}

const originalLocation = window.location;
const originalOpen = window.open;

beforeEach(() => {
  getOpenRequirements.mockReset();
  getOpenRequirements.mockResolvedValue({ rows: [rfq], total: 1, error: null });
  checkSupplierPaidSubscription.mockReset();
  checkSupplierPaidSubscription.mockResolvedValue({ allowed: false, reason: 'no_subscription' });
  fetchRfqBuyerContacts.mockReset();
  auth.value = { user: null, profile: null, company: null, isPaidSubscriber: false };
  window.open = originalOpen;
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

afterEach(() => {
  window.open = originalOpen;
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

describe('Live RFQs sit under Verified Suppliers and above Verified Products', () => {
  it('replaces the old home feed instead of adding a second copy', () => {
    const home = src('src/pages/HomePage.tsx');
    const suppliers = home.indexOf('<VerifiedSuppliersSection />');
    const live = home.indexOf('<LiveRfqScrollSection />');
    const products = home.indexOf('<FeaturedProductsSection />');
    expect(suppliers).toBeGreaterThan(0);
    expect(live).toBeGreaterThan(suppliers);
    expect(products).toBeGreaterThan(live);
    expect(home).not.toContain('LiveRequirementsFeed');
    expect(src('src/components/home/LiveRfqScrollSection.tsx')).toContain('getOpenRequirements');
  });
});

describe('Live RFQ scroll section', () => {
  it('loads real open RFQs with the posted photo and delivery date, not the posted time', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: /Live RFQs/ })).toBeInTheDocument());
    expect(getOpenRequirements).toHaveBeenCalledWith({ page: 1, pageSize: 20, sort: 'latest' });
    expect(screen.getAllByText('Dell OptiPlex Business Desktop Computer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('200 Sets').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bengaluru').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Delivery by 12 Dec 2026').length).toBeGreaterThan(0);
    expect(screen.queryByText('3 hours ago')).toBeNull();
    expect(screen.queryByText(/just now/i)).toBeNull();
    const photos = screen.getAllByRole('img', { name: 'Dell OptiPlex Business Desktop Computer' });
    expect(photos[0]).toHaveAttribute('src', PHOTO);
    expect(photos[0]).toHaveAttribute('loading', 'lazy');
    expect(photos[0]).toHaveClass('object-cover');
    const views = screen.getAllByRole('link', { name: /^View$/ });
    expect(views[0]).toHaveAttribute('href', '/requirements/5e015cc4-47a0-4e82-b1f4-271424ce7e3f');
    expect(screen.getByRole('link', { name: 'View all RFQs' })).toHaveAttribute('href', '/requirements');
    expect(document.querySelector('.animate-ping')).toBeTruthy();
    expect(document.querySelector('.live-rfq-live-pill')).toBeTruthy();
    expect(document.querySelector('.live-rfq-live-pill')).toHaveClass('bg-[#b91c1c]', 'text-white');
    expect(screen.queryByText('9876543210')).toBeNull();
    expect(screen.queryByText('buyer@example.com')).toBeNull();
    expect(screen.queryByText('deepak')).toBeNull();
  });

  it('uses a placeholder icon when there is no photo, and omits the date when there is no delivery date', async () => {
    const bare = { ...rfq, images: [], attachment_url: null, deadline: null } as unknown as Requirement;
    getOpenRequirements.mockResolvedValue({ rows: [bare], total: 1, error: null });
    renderSection();
    await waitFor(() => expect(screen.getAllByTestId('rfq-photo-placeholder').length).toBeGreaterThan(0));
    expect(screen.queryByRole('img', { name: 'Dell OptiPlex Business Desktop Computer' })).toBeNull();
    expect(screen.queryByText(/Delivery by/)).toBeNull();
    expect(screen.queryByText('12 Dec 2026')).toBeNull();
    expect(screen.queryByText(/hours ago|min ago|Just now|Yesterday|flexible/i)).toBeNull();
  });

  it('hides the section when there are no open RFQs', async () => {
    getOpenRequirements.mockResolvedValue({ rows: [], total: 0, error: null });
    const { container } = renderSection();
    await waitFor(() => expect(getOpenRequirements).toHaveBeenCalled());
    expect(container.querySelector('section')).toBeNull();
    expect(screen.queryByText('View all RFQs')).toBeNull();
  });

  it('keeps a seamless looping track, pauses on hover, and respects reduced motion', () => {
    const css = src('src/components/home/live-rfq-scroll.css');
    expect(css).toContain('@keyframes live-rfq-marquee');
    expect(css).toContain('@keyframes live-rfq-glow-pulse');
    expect(css).toContain('@keyframes live-rfq-shimmer');
    expect(css).toContain('animation-play-state: paused');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('.live-rfq-live-pill::before');
    expect(css).toContain('.live-rfq-quote-btn::after');
    expect(loopUnit(['a', 'b'], 8)).toHaveLength(8);
    expect(toLiveRfqCard(rfq).city).toBe('Bengaluru');
    expect(toLiveRfqCard(rfq).photo).toBe(PHOTO);
    expect(toLiveRfqCard(rfq).deliveryDate).toBe('Delivery by 12 Dec 2026');
    expect(deliveryByLabel('2020-01-01', new Date('2026-11-27T10:00:00+05:30'))).toBe('Delivery date passed');
    expect(toLiveRfqCard({ ...rfq, deadline: '2020-01-01' } as unknown as Requirement).deliveryDate).toBe('Delivery date passed');
    expect(deliveryByLabel('2026-12-12')).toBe('Delivery by 12 Dec 2026');
    expect(deliveryByLabel(null)).toBeNull();
    expect(toLiveRfqCard(rfq)).not.toHaveProperty('phone');
    expect(toLiveRfqCard(rfq)).not.toHaveProperty('email');
    expect(toLiveRfqCard(rfq)).not.toHaveProperty('postedAgo');
    expect(rfqReferencePhoto({ images: [PHOTO], attachment_url: 'https://cdn.example/other.jpg' })).toBe(PHOTO);
    expect(rfqReferencePhoto({ images: [], attachment_url: 'https://cdn.example/other.jpg' })).toBe('https://cdn.example/other.jpg');
    expect(rfqReferencePhoto({ images: null, attachment_url: null })).toBeNull();
    expect(deliveryDateLabel('2026-12-12')).toBe('12 Dec 2026');
    expect(deliveryDateLabel(null)).toBeNull();
    const section = src('src/components/home/LiveRfqScrollSection.tsx');
    expect(section).not.toContain('resolveRfqImage');
    expect(section).not.toContain('SafeImage');
  });
});


describe('Live RFQ priority badges', () => {
  it('maps a valid tag onto the card and leaves untagged RFQs untagged', () => {
    expect(toLiveRfqCard(rfq).priorityTag).toBeNull();
    expect(toLiveRfqCard({ ...rfq, priority_tag: 'emergency' } as unknown as Requirement).priorityTag).toBe('emergency');
    expect(toLiveRfqCard({ ...rfq, priority_tag: 'hot' } as unknown as Requirement).priorityTag).toBe('hot');
    expect(toLiveRfqCard({ ...rfq, priority_tag: 'made-up' } as unknown as Requirement).priorityTag).toBeNull();
  });

  it('renders the chosen tag on the ticker card and stays silent when there is none', async () => {
    const tagged = { ...rfq, priority_tag: 'emergency' } as unknown as Requirement;
    getOpenRequirements.mockResolvedValue({ rows: [tagged], total: 1, error: null });
    renderSection();
    await waitFor(() => expect(screen.getAllByText('Emergency').length).toBeGreaterThan(0));
    expect(screen.getAllByTestId('rfq-priority-badge').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('rfq-priority-badge')[0]).toHaveClass('absolute', 'left-2', 'top-2');
    expect(screen.queryByText('Urgent Requirement')).toBeNull();
    expect(screen.queryByText('Hot')).toBeNull();
  });

  it('shows an Urgent badge over the photo (top-left) when is_urgent is set and priority_tag is empty', async () => {
    const flagged = { ...rfq, is_urgent: true, priority_tag: null } as unknown as Requirement;
    expect(toLiveRfqCard(flagged).priorityTag).toBe('urgent');
    getOpenRequirements.mockResolvedValue({ rows: [flagged], total: 1, error: null });
    renderSection();
    await waitFor(() => expect(screen.getAllByText('Urgent Requirement').length).toBeGreaterThan(0));
    expect(document.querySelector('.live-rfq-urgent-glow')).toBeTruthy();
    const overlays = screen.getAllByTestId('rfq-priority-badge');
    expect(overlays.length).toBeGreaterThan(0);
    expect(overlays[0]).toHaveClass('absolute', 'left-2', 'top-2');
    const photo = screen.getAllByRole('img', { name: 'Dell OptiPlex Business Desktop Computer' })[0];
    expect(overlays[0].parentElement).toContainElement(photo);
    expect(screen.queryByText('Emergency')).toBeNull();
  });

  it('does not invent a tag on untagged RFQs', async () => {
    renderSection();
    await waitFor(() => expect(screen.getAllByText('Dell OptiPlex Business Desktop Computer').length).toBeGreaterThan(0));
    expect(screen.queryByText('Emergency')).toBeNull();
    expect(screen.queryByText('Urgent Requirement')).toBeNull();
    expect(screen.queryByText('Hot')).toBeNull();
    expect(screen.queryByTestId('rfq-priority-badge')).toBeNull();
  });
});

describe('Live RFQ card actions', () => {
  it('puts Call, WhatsApp, Quote and Chat on every card, without preloading the buyer number', async () => {
    renderSection();
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Call$/ }).length).toBeGreaterThan(0));
    expect(screen.getAllByRole('button', { name: /^WhatsApp$/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Chat$/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Quote$/ }).length).toBeGreaterThan(0);
    expect(fetchRfqBuyerContacts).not.toHaveBeenCalled();
    expect(screen.queryByText('9876543210')).toBeNull();
    expect(screen.queryByText('buyer@example.com')).toBeNull();
    expect(toLiveRfqCard(rfq)).not.toHaveProperty('phone');
    expect(toLiveRfqCard(rfq)).not.toHaveProperty('email');
    const section = src('src/components/home/LiveRfqScrollSection.tsx');
    expect(section).toContain('LiveRfqActions');
    expect(section).not.toContain('fetchRfqBuyerContacts');
    expect(src('src/lib/profileContacts.ts')).toContain("rpc('rfq_buyer_contacts'");
    expect(src('src/components/home/LiveRfqActions.tsx')).toContain('fetchRfqBuyerContacts');
  });

  it('asks a visitor to sign up, and does not fetch the number or leave the page', async () => {
    const user = userEvent.setup();
    renderSection();
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Call$/ }).length).toBeGreaterThan(0));
    expect(screen.getAllByRole('link', { name: 'Upgrade' })[0]).toHaveAttribute('href', '/register');
    await user.click(screen.getAllByRole('button', { name: /^Call$/ })[0]);
    expect(await screen.findByText('Login to Send Quotations & Messages')).toBeInTheDocument();
    expect(fetchRfqBuyerContacts).not.toHaveBeenCalled();
    expect(screen.queryByText('9876543210')).toBeNull();
  });

  it('opens the sign-in or upgrade dialog from a locked button on a card inside the marquee', async () => {
    const user = userEvent.setup();
    const { container } = renderSection();
    await waitFor(() => expect(container.querySelector('.live-rfq-scroll__track')).toBeTruthy());
    expect(container.querySelector('.live-rfq-scroll__viewport')).toBeTruthy();
    expect(container.querySelector('.live-rfq-scroll__track ul')).toBeTruthy();
    const call = container.querySelector('.live-rfq-scroll__track button') as HTMLButtonElement;
    expect(call).toBeTruthy();
    expect(call.textContent).toMatch(/Call/);
    await user.click(call);
    const dialog = await screen.findByRole('dialog', { name: /Login to Send Quotations/ });
    expect(dialog).toBeVisible();
    expect(dialog).toHaveTextContent('Sign in or register');
  });

  it('asks a free user to upgrade, and still does not fetch the number', async () => {
    auth.value = { user: { id: 'supplier-1' }, profile: { role: 'supplier' }, company: { id: 'co-1' }, isPaidSubscriber: false };
    const user = userEvent.setup();
    renderSection();
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Upgrade' }).length).toBeGreaterThan(0));
    expect(screen.getAllByRole('link', { name: 'Upgrade' })[0]).toHaveAttribute('href', '/dashboard/supplier/subscription');
    await user.click(screen.getAllByRole('button', { name: /^WhatsApp$/ })[0]);
    expect(await screen.findByText('Active Subscription Required')).toBeInTheDocument();
    expect(fetchRfqBuyerContacts).not.toHaveBeenCalled();
    expect(checkSupplierPaidSubscription).toHaveBeenCalled();
  });

  it('lets a paid supplier fetch the number only after they click Call or WhatsApp', async () => {
    auth.value = { user: { id: 'supplier-paid' }, profile: { role: 'supplier' }, company: { id: 'co-1' }, isPaidSubscriber: true };
    fetchRfqBuyerContacts.mockResolvedValue({ phone: '9876543210', email: 'buyer@example.com', whatsapp_number: null });
    const open = vi.fn();
    window.open = open;
    const loc = { href: 'http://localhost/' };
    Object.defineProperty(window, 'location', { configurable: true, value: loc });
    const user = userEvent.setup();
    renderSection();
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Call$/ }).length).toBeGreaterThan(0));
    expect(fetchRfqBuyerContacts).not.toHaveBeenCalled();
    expect(screen.queryByText('9876543210')).toBeNull();
    await user.click(screen.getAllByRole('button', { name: /^Call$/ })[0]);
    await waitFor(() => expect(fetchRfqBuyerContacts).toHaveBeenCalledTimes(1));
    expect(fetchRfqBuyerContacts).toHaveBeenCalledWith('5e015cc4-47a0-4e82-b1f4-271424ce7e3f');
    expect(loc.href).toBe('tel:+919876543210');
    await user.click(screen.getAllByRole('button', { name: /^WhatsApp$/ })[0]);
    await waitFor(() => expect(fetchRfqBuyerContacts).toHaveBeenCalledTimes(2));
    expect(open).toHaveBeenCalled();
    expect(String(open.mock.calls[0][0])).toMatch(/^https:\/\/wa\.me\/919876543210/);
  });

  it('sends a paid supplier to the RFQ quote or chat tab, and a button click does not follow the card View link', async () => {
    auth.value = { user: { id: 'supplier-paid' }, profile: { role: 'supplier' }, company: { id: 'co-1' }, isPaidSubscriber: true };
    const user = userEvent.setup();
    function Where() {
      const { pathname, search } = useLocation();
      return <div data-testid="where">{pathname + search}</div>;
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <Where />
        <LiveRfqScrollSection />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Quote$/ }).length).toBeGreaterThan(0));
    expect(screen.getByTestId('where').textContent).toBe('/');
    await user.click(screen.getAllByRole('button', { name: /^Quote$/ })[0]);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/requirements/5e015cc4-47a0-4e82-b1f4-271424ce7e3f?tab=quotes'));
    expect(fetchRfqBuyerContacts).not.toHaveBeenCalled();
    await user.click(screen.getAllByRole('button', { name: /^Chat$/ })[0]);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/requirements/5e015cc4-47a0-4e82-b1f4-271424ce7e3f?tab=chat'));
  });
});
