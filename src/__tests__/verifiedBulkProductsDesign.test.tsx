import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { shortMoq } from '@/lib/moqText';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Verified Bulk Products laid out from the design picture', () => {
  const section = src('src/components/home/FeaturedProductsSection.tsx');

  it('has the banner, the four promises, the chips and the Trending Wholesale Deals heading', () => {
    for (const text of [
      'Bulk Products',
      'Source directly from verified manufacturers at wholesale prices',
      'Explore Products',
      "label: 'Verified', sub: 'Manufacturers'",
      "label: 'Low MOQ', sub: '(Min. 10 Pcs)'",
      "label: 'Free', sub: 'Delivery'",
      "label: 'Best', sub: 'Wholesale Price'",
      "label: 'All Products'",
      "label: 'Kitchen'",
      "label: 'Apparel'",
      "label: 'Electronics'",
      'aria-label="More categories"',
      'Trending Wholesale <span className="text-[#FF6A00]">Deals</span>',
      'View All',
    ]) {
      expect(section, text).toContain(text);
    }
    expect(existsSync(join(process.cwd(), 'public/home-design/vbp-banner.jpg'))).toBe(true);
  });

  it('puts Kitchen right after All Products, as in the picture', () => {
    const order = ['All Products', 'Kitchen', 'Apparel', 'Electronics'].map((l) => section.indexOf(`label: '${l}'`));
    expect(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1]))).toBe(true);
  });

  it('cards show the price range as bulk price, struck-through price and saving, MOQ, free delivery, loan and Buy in Bulk', () => {
    for (const text of ['% OFF', '<s className=', 'Free Delivery', '<LoanEligibleTag link size="sm" tone="gold"', 'Buy in Bulk', 'openQuoteModal(product)', 'toggleFavorite(product.id, product.name)']) {
      expect(section, text).toContain(text);
    }
    // the saving comes only from the product's own price range
    expect(section).toContain('const off = high > low ? Math.round((1 - low / high) * 100) : 0;');
  });

  it('drops the search toolbar and the old phone carousel from the home section', () => {
    expect(section).not.toContain('Search 5,000+ products');
    expect(section).not.toContain('Swipe to browse');
    expect(section).not.toContain('Live 30s Rotation');
  });

  it('shortens MOQ units so they fit on a phone card', () => {
    expect(shortMoq('MOQ: 100 Cartons')).toBe('MOQ: 100 Ctns');
    expect(shortMoq('MOQ: 500 meters')).toBe('MOQ: 500 m');
    expect(shortMoq('MOQ: 25 kg')).toBe('MOQ: 25 Kg');
    expect(shortMoq('MOQ: 1 Container')).toBe('MOQ: 1 Cntr');
    expect(shortMoq('MOQ: 20 square meters')).toBe('MOQ: 20 Sq m');
    expect(shortMoq('MOQ: 5 metric tons')).toBe('MOQ: 5 MT');
    expect(shortMoq('MOQ: 10 Sets')).toBe('MOQ: 10 Sets');
  });
});
