import { describe, it, expect } from 'vitest';
import { isSubscriptionActive, pickActiveSubscription, quoteAccess } from '@/lib/quoteAccess';

const now = new Date('2026-11-21T00:00:00Z');

describe('paid subscription check', () => {
  it('counts only active rows that have not ended', () => {
    expect(isSubscriptionActive(null, now)).toBe(false);
    expect(isSubscriptionActive({ status: 'trial', ends_at: null }, now)).toBe(false);
    expect(isSubscriptionActive({ status: 'expired', ends_at: null }, now)).toBe(false);
    expect(isSubscriptionActive({ status: 'active', ends_at: null }, now)).toBe(true);
    expect(isSubscriptionActive({ status: 'active', ends_at: '2026-12-01T00:00:00Z' }, now)).toBe(true);
    expect(isSubscriptionActive({ status: 'active', ends_at: '2026-11-01T00:00:00Z' }, now)).toBe(false);
  });

  it('picks the newest still-active row', () => {
    const rows = [
      { id: 'old', status: 'active', ends_at: null, created_at: '2026-01-01' },
      { id: 'ended', status: 'active', ends_at: '2026-11-01T00:00:00Z', created_at: '2026-10-01' },
      { id: 'new', status: 'active', ends_at: '2027-01-01T00:00:00Z', created_at: '2026-09-01' },
    ];
    expect(pickActiveSubscription(rows, now)?.id).toBe('new');
    expect(pickActiveSubscription([rows[1]], now)).toBeNull();
  });
});

describe('who may send a quotation', () => {
  it('lets anyone view but only registered, paid companies quote', () => {
    expect(quoteAccess({ loggedIn: false, hasCompany: false, hasPaidSubscription: false })).toBe('not_logged_in');
    expect(quoteAccess({ loggedIn: true, hasCompany: false, hasPaidSubscription: false })).toBe('not_registered_business');
    expect(quoteAccess({ loggedIn: true, hasCompany: true, hasPaidSubscription: false })).toBe('no_subscription');
    expect(quoteAccess({ loggedIn: true, hasCompany: true, hasPaidSubscription: true })).toBe('allowed');
    expect(quoteAccess({ loggedIn: true, hasCompany: false, isAdmin: true, hasPaidSubscription: false })).toBe('allowed');
  });
});
