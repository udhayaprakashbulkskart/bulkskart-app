import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExternalSourceLink, GovernmentTenderBadge, PublicAuctionBadge } from '@/components/common/ExternalSourceLink';
import { toAuctionListing } from '@/lib/auctionListing';

vi.mock('@/db/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/api', () => ({ getCategories: vi.fn(async () => []) }));
vi.mock('@/components/auctions/CreateReverseAuctionDialog', () => ({ default: () => null }));

const listings = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock('@/lib/auctionListing', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auctionListing')>('@/lib/auctionListing');
  return {
    ...actual,
    getAuctionListings: vi.fn(async () => ({ rows: listings.rows, error: null })),
  };
});

import LiveReverseAuctionsRail from '@/components/home/LiveReverseAuctionsRail';

const GEM = 'https://bidplus.gem.gov.in/all-bids/GEM/2026/B/12345';

afterEach(() => cleanup());

describe('source links', () => {
  it('opens in a new tab with rel=noopener', () => {
    render(
      <ExternalSourceLink href={GEM} className="inline-flex">
        View on GeM
      </ExternalSourceLink>,
    );
    const link = screen.getByRole('link', { name: /View on GeM/ });
    expect(link).toHaveAttribute('href', GEM);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel') ?? '').toContain('noopener');
  });

  it('uses the existing orange badge treatment', () => {
    render(
      <div>
        <PublicAuctionBadge />
        <GovernmentTenderBadge />
      </div>,
    );
    for (const label of ['Public auction', 'Government tender']) {
      const badge = screen.getByText(label);
      expect(badge.className).toContain('text-[#FF5A1F]');
      expect(badge.className).toContain('bg-[#FF5A00]/15');
      expect(badge.className).not.toMatch(/emerald|green-|blue-/);
    }
  });
});

describe('Sell Products in 24 Hours rail', () => {
  it('sends a public auction to GeM and leaves a normal auction unchanged', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    listings.rows = [
      toAuctionListing({
        id: 'pub-1',
        title: 'HR coils from GeM',
        status: 'live',
        end_time: future,
        total_quantity: 0,
        starting_price: 0,
        quantity_unit: 'lot',
        total_bids: 0,
        description: `Notice ${GEM}`,
        specifications: { external_listing: 'true', source_url: GEM, source_name: 'GeM', seller_org: 'SAIL' },
      }),
      toAuctionListing({
        id: 'own-1',
        title: 'Factory bolts',
        status: 'live',
        end_time: future,
        total_quantity: 500,
        starting_price: 0,
        quantity_unit: 'kg',
        total_bids: 2,
        description: 'Ready to ship',
      }, 'Sri Lakshmi Fasteners'),
    ];

    render(
      <MemoryRouter>
        <LiveReverseAuctionsRail />
      </MemoryRouter>,
    );

    expect(await screen.findByText('HR coils from GeM')).toBeInTheDocument();
    const gem = screen.getByRole('link', { name: (name, el) => el.tagName === 'A' && name === 'View on GeM' });
    expect(gem).toHaveAttribute('href', GEM);
    expect(gem).toHaveAttribute('target', '_blank');
    expect(gem.getAttribute('rel') ?? '').toContain('noopener');
    expect(screen.getByText('Public auction')).toBeInTheDocument();
    expect(screen.getByText('SAIL')).toBeInTheDocument();

    const publicCard = screen.getByText('HR coils from GeM').closest('[role="link"]');
    expect(publicCard?.textContent ?? '').not.toMatch(/0 lot|₹0|Sign in to participate|Submit Bid|Enter Live Room/);

    expect(screen.getByText('Factory bolts')).toBeInTheDocument();
    expect(screen.getByText('500 kg')).toBeInTheDocument();
    expect(screen.getByText('Starting price not stated')).toBeInTheDocument();
    expect(screen.queryByText('Sri Lakshmi Fasteners')).toBeNull();
  });
});
