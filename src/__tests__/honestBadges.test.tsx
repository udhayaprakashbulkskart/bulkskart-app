import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

/** Rows the reviews section reads; empty unless a test fills it. */
const db = vi.hoisted(() => ({ reviews: [] as unknown[] }));

vi.mock('@/db/supabase', () => {
  const chain = (rows: () => unknown[]): Record<string, unknown> =>
    new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') {
            return (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows(), count: rows().length, error: null }).then(resolve);
          }
          return () => chain(rows);
        },
      },
    );
  return { supabase: { from: () => chain(() => db.reviews) } };
});

import BidderProfileModal from '@/components/auctions/BidderProfileModal';
import ReviewsHomeSection from '@/components/home/ReviewsHomeSection';

describe('bidder pop-up', () => {
  it('shows only the bids placed in this auction, with no invented ratings or badges', () => {
    render(
      <MemoryRouter>
        <BidderProfileModal
          bidderName="Sri Lakshmi Fasteners (Your Active Bid)"
          bids={[{ id: 'b1', bid_amount: 2350, quantity: 500, timestamp: '03:05 PM', status: 'winning' }]}
          quantityUnit="coils"
          open
          onOpenChange={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Sri Lakshmi Fasteners')).toBeInTheDocument();
    expect(screen.getByText('Holds the leading bid in this auction')).toBeInTheDocument();
    expect(screen.getAllByText('₹2,350/coils').length).toBeGreaterThan(0);
    for (const invented of [/Trust Score/i, /Auctions Won/i, /GSTIN Verified/i, /Escrow Deposit/i, /Member On BulkSkart/i]) {
      expect(screen.queryByText(invented)).toBeNull();
    }
    // No phone on the bid, so no contact row (and no made-up number)
    expect(screen.queryByText(/Bidding contact/i)).toBeNull();
  });
});

describe('home reviews', () => {
  it('stays hidden until buyers have written reviews', async () => {
    db.reviews = [];
    const { container } = render(<MemoryRouter><ReviewsHomeSection /></MemoryRouter>);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows real reviews and marks only order-backed ones as verified, in orange', async () => {
    db.reviews = [
      { id: 'r1', rating: 5, review_text: 'Bolts arrived on time.', order_id: 'o1', created_at: '2026-11-10T00:00:00Z', reviewer: { full_name: 'Asha', avatar_url: null }, company: { company_name: 'Sri Lakshmi Fasteners', slug: 'sri-lakshmi' } },
      { id: 'r2', rating: 4, review_text: 'Good packing.', order_id: null, created_at: '2026-11-09T00:00:00Z', reviewer: { full_name: 'Ravi', avatar_url: null }, company: null },
    ];
    render(<MemoryRouter><ReviewsHomeSection /></MemoryRouter>);
    expect(await screen.findByText('"Bolts arrived on time."')).toBeInTheDocument();
    const badges = screen.getAllByText('Verified order');
    expect(badges).toHaveLength(1);
    expect(badges[0].className).toMatch(/text-primary/);
    expect(badges[0].className).not.toMatch(/emerald|green/);
  });
});
