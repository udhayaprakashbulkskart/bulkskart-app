import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/supabase', () => ({ supabase: {} }));

import { auctionMoney, auctionPhase, isImportedAuction, secondsLeft, sellerPhoto, toAuctionListing } from '@/lib/auctionListing';

const NOW = new Date('2026-11-16T12:00:00Z').getTime();
const at = (ms: number) => new Date(NOW + ms).toISOString();

describe('auction lists show auctions as stored', () => {
  it('uses only photos the seller uploaded', () => {
    expect(sellerPhoto(['https://cdn.example.com/lot.jpg'])).toBe('https://cdn.example.com/lot.jpg');
    expect(sellerPhoto(['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800'])).toBeNull();
    expect(sellerPhoto(['https://cdn.pixabay.com/photo/2016/11/29/welding.jpg', 'https://cdn.example.com/b.png'])).toBe('https://cdn.example.com/b.png');
    expect(sellerPhoto([])).toBeNull();
    expect(sellerPhoto(null)).toBeNull();
  });

  it('keeps missing fields missing instead of filling them in', () => {
    const lot = toAuctionListing({ id: 'a1', title: 'Steel coils', status: 'live', total_bids: 0 });
    expect(lot.deliveryLocation).toBeNull();
    expect(lot.sellerName).toBeNull();
    expect(lot.image).toBeNull();
    expect(lot.startingPrice).toBeNull();
    expect(lot.totalBids).toBe(0);
    expect(lot.currency).toBe('INR');
    expect(lot).not.toHaveProperty('external');
  });

  it('reads the phase from the status and the auction\'s own times', () => {
    expect(auctionPhase({ status: 'live', startTime: at(-60_000), endTime: at(600_000) }, NOW).key).toBe('live');
    expect(auctionPhase({ status: 'live', startTime: at(-7_200_000), endTime: at(-60_000) }, NOW)).toMatchObject({ key: 'ended', ended: true });
    expect(auctionPhase({ status: 'live', startTime: at(3_600_000), endTime: at(7_200_000) }, NOW).key).toBe('scheduled');
    expect(auctionPhase({ status: 'awarded', startTime: null, endTime: null }, NOW).key).toBe('sold');
    expect(auctionPhase({ status: 'no_winner', startTime: null, endTime: null }, NOW).label).toBe('Not sold');
    expect(auctionPhase({ status: 'cancelled', startTime: null, endTime: at(600_000) }, NOW).ended).toBe(true);
  });

  it('counts down to the real end time and never restarts the clock', () => {
    expect(secondsLeft(at(90_000), NOW)).toBe(90);
    expect(secondsLeft(at(-90_000), NOW)).toBe(0);
    expect(secondsLeft(null, NOW)).toBe(0);
  });

  it('recognises lots copied from the GeM portal or another website, so they are never shown', () => {
    // the shape of the GeM rows in production
    expect(isImportedAuction({
      description: 'Forward auction on GeM',
      specifications: { external_listing: true, source: 'GeM', source_url: 'https://forwardauction.gem.gov.in/x', source_auction_id: '1', seller_org: 'Org' },
    })).toBe(true);
    expect(isImportedAuction({ specifications: { external_listing: 'true' } })).toBe(true);
    expect(isImportedAuction({ specifications: { source_url: 'https://example.com/lot/9' } })).toBe(true);
    expect(isImportedAuction({ specifications: '{"reference_no":"GEM/2026/A/1"}' })).toBe(true);
    expect(isImportedAuction({ description: 'See https://bidplus.gem.gov.in/all-bids/GEM/2026/B/12345', specifications: {} })).toBe(true);
    expect(isImportedAuction({ description: 'Lot listed on GeM', specifications: {} })).toBe(true);
  });

  it('keeps a seller\'s own auction, gem stones included, even when its text mentions GeM', () => {
    expect(isImportedAuction({ seller_id: 'u1', description: 'Also sold on GeM earlier', specifications: {} })).toBe(false);
    expect(isImportedAuction({ description: 'Mild steel coils, 2 mm', specifications: { Grade: 'IS 2062', Thickness: '2 mm' } })).toBe(false);
    expect(isImportedAuction({ description: 'Loose gem stones and gemstone beads', specifications: { Stone: 'gem quality ruby' } })).toBe(false);
    expect(isImportedAuction({ description: null, specifications: null })).toBe(false);
    expect(isImportedAuction(null)).toBe(false);
  });

  it('formats money in the lot\'s currency and leaves out prices that were not given', () => {
    expect(auctionMoney(1250, 'INR')).toBe('₹1,250');
    expect(auctionMoney(null, 'INR')).toBeNull();
    expect(auctionMoney(0, 'INR')).toBeNull();
  });
});
