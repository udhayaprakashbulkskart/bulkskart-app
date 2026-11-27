import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Requirement } from '@/types/types';
import { loopUnit, postedAgo, toLiveRfqCard } from '@/components/home/LiveRfqScrollSection';

const getOpenRequirements = vi.fn();
vi.mock('@/lib/api', () => ({
  getOpenRequirements: (...args: unknown[]) => getOpenRequirements(...args),
}));

import LiveRfqScrollSection from '@/components/home/LiveRfqScrollSection';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const rfq = {
  id: '5e015cc4-47a0-4e82-b1f4-271424ce7e3f',
  title: 'Dell OptiPlex Business Desktop Computer',
  quantity: 200,
  quantity_unit: 'Sets',
  destination_city: 'Bengaluru',
  destination_country: 'India',
  created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  status: 'active',
  buyer_id: 'buyer-1',
  // if a paid session leaked these, the ticker must still not show them
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
  it('loads real open RFQs with the same query as /requirements and shows title, quantity, city, time and a View link', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: /Live RFQs/ })).toBeInTheDocument());
    expect(getOpenRequirements).toHaveBeenCalledWith({ page: 1, pageSize: 20, sort: 'latest' });
    expect(screen.getAllByText('Dell OptiPlex Business Desktop Computer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('200 Sets').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bengaluru').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3 hours ago').length).toBeGreaterThan(0);
    const views = screen.getAllByRole('link', { name: /^View$/ });
    expect(views[0]).toHaveAttribute('href', '/requirements/5e015cc4-47a0-4e82-b1f4-271424ce7e3f');
    expect(screen.getByRole('link', { name: 'View all RFQs' })).toHaveAttribute('href', '/requirements');
    expect(document.querySelector('.animate-ping')).toBeTruthy();
    expect(screen.queryByText('9876543210')).toBeNull();
    expect(screen.queryByText('buyer@example.com')).toBeNull();
    expect(screen.queryByText('deepak')).toBeNull();
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
    expect(toLiveRfqCard(rfq)).not.toHaveProperty('phone');
    expect(toLiveRfqCard(rfq)).not.toHaveProperty('email');
    const now = Date.parse('2026-11-27T10:00:00+05:30');
    expect(postedAgo(new Date(now - 30_000).toISOString(), now)).toBe('Just now');
  });
});
