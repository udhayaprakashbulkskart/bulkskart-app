import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HIDDEN_HOME_SECTIONS } from '@/config/homeSections';
import { appPlatform } from '@/lib/appInstall';
import DownloadAppPopup, { NO_POPUP_PATHS } from '@/components/common/DownloadAppPopup';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('three home sections are hidden, not deleted', () => {
  it('switches them off with flags', () => {
    expect(HIDDEN_HOME_SECTIONS).toEqual({ exploreCategories: true, tradeWorkflows: true, sellIn24Hours: true });
    const home = src('src/pages/HomePage.tsx');
    expect(home).toContain('{!HIDDEN_HOME_SECTIONS.exploreCategories && <WhenVisible><CategoriesAndStatsSection /></WhenVisible>}');
    expect(home).toContain('{!HIDDEN_HOME_SECTIONS.tradeWorkflows && <WhenVisible><VerifiedSupplierQuickActions /></WhenVisible>}');
    expect(home).toContain('{!HIDDEN_HOME_SECTIONS.sellIn24Hours && <WhenVisible><LiveReverseAuctionsRail /></WhenVisible>}');
  });

  it('keeps their code', () => {
    expect(src('src/components/home/CategoriesAndStatsSection.tsx')).toContain('Explore Bulk Product');
    expect(src('src/components/home/VerifiedSupplierQuickActions.tsx')).toContain('Fast-Track Sourcing & Selling Workflows');
    expect(src('src/components/home/LiveReverseAuctionsRail.tsx')).toContain('Sell Products in 24 Hours');
  });
});

describe('Download App popup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><DownloadAppPopup /></MemoryRouter>);

  it('slides in after a few seconds with a Download button, and stays away once closed', () => {
    const { unmount } = renderAt('/');
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => { vi.advanceTimersByTime(3100); });
    expect(screen.getByText(/BulkSkart/, { selector: '#download-app-title *' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Download$/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();
    renderAt('/');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows add-to-home-screen steps when the browser has no install dialog', () => {
    renderAt('/products');
    act(() => { vi.advanceTimersByTime(3100); });
    fireEvent.click(screen.getByRole('button', { name: /^Download$/ }));
    return Promise.resolve().then(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
      expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
    });
  });

  it('stays off sign-in, dashboard and payment pages', () => {
    for (const path of ['/auth', '/register/manufacturer', '/dashboard/buyer', '/admin', '/checkout', '/supplier-map']) expect(NO_POPUP_PATHS.test(path), path).toBe(true);
    for (const path of ['/', '/products', '/requirements', '/authors']) expect(NO_POPUP_PATHS.test(path), path).toBe(false);
  });

  it('tells phones and computers apart', () => {
    expect(appPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
    expect(appPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('android');
    expect(appPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
  });

  it('is mounted for the whole site and the install offer is caught from the start', () => {
    expect(src('src/App.tsx')).toContain('<DownloadAppPopup />');
    expect(src('src/main.tsx')).toContain('import "./lib/appInstall";');
  });
});

describe('Live RFQ: anyone can view, only Premium (paid) suppliers send quotations', () => {
  const feed = src('src/components/common/LiveRequirementsFeed.tsx');
  it('says so in the Premium banner and in the empty feed, with a way to upgrade or register', () => {
    expect(feed).toContain("{premium ? 'PREMIUM' : 'PREMIUM ONLY'}");
    expect(feed).toContain("{premium ? 'You are a' : 'Exclusive for'}");
    expect(feed).toContain('to submit quotations and connect with bulk buyers.');
    expect(feed).toContain('No open RFQs right now');
    expect(feed).toContain('Only <strong className="font-bold text-[#FFC928]">Premium Suppliers</strong> can submit quotations.');
    expect(feed).toContain('Upgrade to Premium');
    expect(feed).toContain("const premium = !!company && !!isPaidSubscriber;");
    expect(feed).toContain("const upgradeHref = user && !company ? registerCompanyHref : '/pricing';");
    expect(feed.match(/\{\/\* Who can quote/g)).toHaveLength(1);
    expect(feed).toContain("const registerCompanyHref = user ? '/dashboard/supplier/profile' : '/auth?tab=supplier';");
  });
  it('still stops guests and people without a company at the quote button', () => {
    expect(feed).toContain("if (!user || !profile) { setDialogReason('not_logged_in'); setDialogOpen(true); return; }");
    expect(feed).toContain("if (!company) { setDialogReason('not_registered_business'); setDialogOpen(true); return; }");
  });
});
