import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Requirement } from '@/types/types';
import { deliveryByLabel, deliveryDateLabel, loopUnit, rfqReferencePhoto, toLiveRfqCard } from '@/components/home/LiveRfqScrollSection';

const getOpenRequirements = vi.fn();
vi.mock('@/lib/api', () => ({
  getOpenRequirements: (...args: unknown[]) => getOpenRequirements(...args),
}));

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

beforeEach(() => {
  getOpenRequirements.mockReset();
  getOpenRequirements.mockResolvedValue({ rows: [rfq], total: 1, error: null });
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
    expect(css).toContain('animation-play-state: paused');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('overflow-x: auto');
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
    expect(screen.queryByText('Urgent')).toBeNull();
    expect(screen.queryByText('Hot')).toBeNull();
  });

  it('shows an Urgent badge over the photo (top-left) when is_urgent is set and priority_tag is empty', async () => {
    const flagged = { ...rfq, is_urgent: true, priority_tag: null } as unknown as Requirement;
    expect(toLiveRfqCard(flagged).priorityTag).toBe('urgent');
    getOpenRequirements.mockResolvedValue({ rows: [flagged], total: 1, error: null });
    renderSection();
    await waitFor(() => expect(screen.getAllByText('Urgent').length).toBeGreaterThan(0));
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
    expect(screen.queryByText('Urgent')).toBeNull();
    expect(screen.queryByText('Hot')).toBeNull();
    expect(screen.queryByTestId('rfq-priority-badge')).toBeNull();
  });
});
