import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requestedRfqListPage, resolveRfqListPage } from '@/lib/rfqListAccess';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('RFQ list pages after page 1 are for paid subscribers', () => {
  it('reads the page number from the query and treats junk as page 1', () => {
    expect(requestedRfqListPage('')).toBe(1);
    expect(requestedRfqListPage('page=2')).toBe(2);
    expect(requestedRfqListPage('?page=12&q=steel')).toBe(12);
    expect(requestedRfqListPage('page=0')).toBe(1);
    expect(requestedRfqListPage('page=-3')).toBe(1);
    expect(requestedRfqListPage('page=foo')).toBe(1);
  });

  it('lets a paid subscriber open later pages and blocks everyone else back to page 1', () => {
    expect(resolveRfqListPage(1, false)).toEqual({ page: 1, blocked: false });
    expect(resolveRfqListPage(2, false)).toEqual({ page: 1, blocked: true });
    expect(resolveRfqListPage(2, true)).toEqual({ page: 2, blocked: false });
    expect(resolveRfqListPage(1, true)).toEqual({ page: 1, blocked: false });
  });

  it('the requirements page uses the helper, the paywall, and the URL, and hides RFQ totals', () => {
    const page = src('src/pages/RequirementsPage.tsx');
    expect(page).toContain('resolveRfqListPage');
    expect(page).toContain('requestedRfqListPage');
    expect(page).toContain('goToListPage');
    expect(page).toContain("setDialogReason('not_logged_in')");
    expect(page).toContain("setDialogReason('no_subscription')");
    expect(page).toContain('<SubscribeToContactDialog');
    expect(page).toContain("next.set('page', String(nextPage))");
    expect(page).not.toContain('Showing Page');
    expect(page).not.toContain('open requirements)');
    expect(page).not.toMatch(/\d+ open requirement/);
    expect(page).not.toContain('tabCounts');
    expect(page).not.toContain('AnimatedCount');
    expect(page).toContain('Post what you need and get quotes from suppliers');
    expect(page).toContain('Post Requirement');
    // pagination controls stay
    expect(page).toContain('Next');
    expect(page).toContain('Prev');
  });
});

describe('home Live RFQ action colours and hidden totals', () => {
  it('colours Call, WhatsApp, Chat and Quote distinctly, without changing the layout', () => {
    const actions = src('src/components/home/LiveRfqActions.tsx');
    expect(actions).toContain('bg-[#16A34A]');
    expect(actions).toContain("dark:border-white/80 dark:text-white");
    expect(actions).toContain('bg-[#FF5A00]');
    expect(actions).toContain('live-rfq-quote-btn');
    expect(actions).toContain('rounded-xl');
    expect(actions).toContain('grid grid-cols-2 gap-1.5');
    expect(actions).toContain('fetchRfqBuyerContacts');
    expect(actions).toContain('SubscribeToContactDialog');
  });

  it('does not print an RFQ total on the home hero or supplier stats', () => {
    expect(src('src/components/home/LandingHero.tsx')).toContain("'Live Now: Active RFQs'");
    expect(src('src/components/home/LandingHero.tsx')).not.toContain('openRfqs');
    expect(src('src/components/home/VerifiedSuppliersSection.tsx')).not.toContain("label: 'Live RFQs'");
    expect(src('src/components/home/shared/parts.tsx')).not.toContain('10,000+');
    expect(src('src/components/home/shared/parts.tsx')).toContain("label: 'RFQs & Auctions'");
  });
});
