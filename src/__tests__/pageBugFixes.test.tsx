import { render } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import InteractiveStarRating from '@/components/common/InteractiveStarRating';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('page bug fixes', () => {
  it('a read-only star rating has no buttons, so it can sit inside a button or link', () => {
    const { container, rerender } = render(<InteractiveStarRating value={4} readOnly />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    rerender(<InteractiveStarRating value={0} onChange={() => {}} />);
    expect(container.querySelectorAll('button')).toHaveLength(5);
  });

  it('messages page defines the contact name helper before the suggestions use it', () => {
    const page = src('src/pages/dashboard/shared/MessagesPage.tsx');
    expect(page.indexOf('const getContactName')).toBeGreaterThan(-1);
    expect(page.indexOf('const getContactName')).toBeLessThan(page.indexOf('const aiChatSuggestions'));
  });

  it('paid manufacturers are not judged unpaid while their account loads', () => {
    expect(src('src/components/layouts/DashboardLayout.tsx')).toContain("role === 'supplier' && !loading && !isPaidSubscriber");
  });

  it('supplier RFQ leads are real requirements, not generated ones', () => {
    expect(existsSync(join(process.cwd(), 'src/lib/refreshLeadBoard.ts'))).toBe(false);
    const page = src('src/pages/dashboard/supplier/SupplierRFQsPage.tsx');
    expect(page).toContain("getRequirements({ status: 'active'");
    expect(page).not.toMatch(/max_rfq_leads - subscription\.used_rfq_leads/);
  });

  it('products show real prices, ratings and badges', () => {
    const home = src('src/components/home/FeaturedProductsSection.tsx');
    expect(home).not.toMatch(/price_min \?\? 25|price_max \?\? 45/);
    expect(home).not.toContain("=== 'verified' || true");
    expect(home).not.toMatch(/4\.7 \+ \(\(index/);
    const detail = src('src/pages/ProductDetailPage.tsx');
    expect(detail).not.toContain('value={4.8}');
    expect(detail).not.toMatch(/price_min < 1000/);
    expect(src('src/pages/ProductsPage.tsx')).not.toMatch(/val < 1000/);
  });

  it('banner highlights are readable on the orange banners', () => {
    for (const page of ['AboutPage', 'CareersPage', 'ContactPage']) {
      const text = src(`src/pages/${page}.tsx`);
      const banner = text.slice(text.indexOf('bg-[#C94400] text-white'), text.indexOf('</h1>'));
      expect(banner, page).not.toMatch(/<span className="text-(primary|\[#FF5A00\])">/);
    }
  });
});
