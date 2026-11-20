import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ getMarketplaceProducts: vi.fn(async () => ({ products: [] })) }));
import { fromCatalogue, fromProducts, heroLists, HERO_RING_SIZE } from '@/components/home/hero/heroProducts';
import type { Product } from '@/types/types';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('landing hero product carousel', () => {
  it('uses only catalogue photos that are hosted with the site', () => {
    const items = fromCatalogue();
    expect(items.length).toBeGreaterThanOrEqual(HERO_RING_SIZE);
    for (const item of items) expect(item.img).toMatch(/^\/verified-bulk-products\/curated-prod-\d+\.jpg$/);
  });

  it('puts real products with a catalogue photo first and skips ones without a photo', () => {
    const real = fromProducts([
      { id: 'p1', name: 'MS Hex Bolt M12', slug: 'ms-hex-bolt-m12', images: ['https://x.supabase.co/storage/v1/object/public/product-images/catalog/bolt.jpg'], price_min: 6.5, price_max: 9, price_currency: 'INR', moq: 1000, moq_unit: 'pcs', companies: { company_name: 'Sri Lakshmi Fasteners', country: 'India', verification_status: 'verified' } },
      { id: 'p2', name: 'No Photo Washer', slug: 'washer', images: [], price_min: 1 },
    ] as unknown as Product[]);
    expect(real.map((p) => p.id)).toEqual(['p1']);
    const { featured, top } = heroLists(real, fromCatalogue());
    expect(featured[0].id).toBe('p1');
    expect(featured).toHaveLength(HERO_RING_SIZE);
    expect(top.every((p) => p.topSeller)).toBe(true);
    expect(new Set(featured.map((p) => p.name)).size).toBe(featured.length);
  });

  it('adds only the product scroll under the hero and keeps the hero content as it was', () => {
    const landing = src('src/components/home/LandingHero.tsx');
    expect(landing).toContain('<ProductCarouselHero />');
    expect(landing).toContain("const HEADLINE = ['The', 'Global', 'B2B', 'Marketplace', 'for'];");
    expect(landing).toContain('Search products, suppliers, categories…');
    expect(landing.indexOf('<ProductCarouselHero />')).toBeLessThan(landing.indexOf('CATEGORY CHIPS ═'));
    const scroll = src('src/components/home/hero/ProductCarouselHero.tsx');
    expect(scroll).not.toContain('<h1');
    expect(scroll).toContain('aria-roledescription="carousel"');
    expect(scroll).toContain('prefers-reduced-motion');
  });

  it('shows Free Delivery and Loan Eligible as buttons to the free delivery and loan page', () => {
    const scroll = src('src/components/home/hero/ProductCarouselHero.tsx');
    expect(scroll.match(/to="\/loan-calculator"/g)).toHaveLength(2);
    expect(scroll).toContain('<Truck className="h-4 w-4 text-[#FF7A2E]" aria-hidden="true" /> Free Delivery');
    expect(scroll).toContain('<Wallet className="h-4 w-4" aria-hidden="true" /> Loan Eligible');
    // and on every card
    expect(scroll).toContain('<span className="pc-card-perks" aria-hidden="true">');
  });
});
