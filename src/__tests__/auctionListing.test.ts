import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/supabase', () => ({ supabase: {} }));

import { auctionMoney, auctionPhase, secondsLeft, sellerPhoto, toAuctionListing } from '@/lib/auctionListing';

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

  it('formats money in the lot\'s currency and leaves out prices that were not given', () => {
    expect(auctionMoney(1250, 'INR')).toBe('₹1,250');
    expect(auctionMoney(null, 'INR')).toBeNull();
    expect(auctionMoney(0, 'INR')).toBeNull();
  });
});
