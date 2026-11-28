import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('home page top laid out from the design picture', () => {
  const landing = src('src/components/home/LandingHero.tsx');

  it('has the hero copy, buttons and four promises from the picture', () => {
    // the live badge does not show an RFQ total
    expect(landing).not.toContain('52,000+');
    expect(landing).toContain("'Live Now: Active RFQs'");
    expect(landing).not.toContain('openRfqs.toLocaleString');
    expect(landing).not.toContain('loadLiveStats()');
    expect(landing).toContain("{ title: 'BulkSkart — The Global B2B Marketplace for', accent: 'Bulk Buying & Selling' }");
    expect(landing).toContain('Post Your Requirement');
    expect(landing).toContain('Get Supplier Quotes');
    for (const word of ["['Verified', 'Suppliers']", "['Bulk', 'Pricing']", "['Free', 'Delivery*']", "['Trade', 'Assurance']"]) expect(landing).toContain(word);
    // one heading for the page, on the first slide
    expect(landing.match(/<h1/g)).toHaveLength(1);
  });

  it('uses the pictures cut from the design, and every one exists', () => {
    for (const file of ['hero-forklift.jpg', 'banner-refinery.jpg', 'cat-machinery.jpg', 'cat-packaging.jpg', 'cat-electrical.jpg', 'cat-textile.jpg', 'cat-chemicals.jpg']) {
      expect(landing).toContain(`/home-design/${file}`);
      expect(existsSync(join(process.cwd(), 'public/home-design', file))).toBe(true);
    }
  });

  it('shows eight more categories with pictures from tablet width up, keeping the phone at six tiles', () => {
    expect(landing).toContain('grid grid-cols-6 gap-1.5 sm:gap-2.5 md:grid-cols-7');
    expect(landing).toContain('group hidden flex-col items-center overflow-hidden rounded-2xl bg-white px-2 pb-3 pt-3 text-center');
    for (const file of ['cat-metals.jpg', 'cat-construction.jpg', 'cat-agriculture.jpg', 'cat-automotive.jpg', 'cat-solar.jpg', 'cat-furniture.jpg', 'cat-home-kitchen.jpg', 'cat-beauty.jpg']) {
      expect(landing).toContain(`/home-design/${file}`);
      expect(existsSync(join(process.cwd(), 'public/home-design', file))).toBe(true);
    }
    // credited: thumbnails of the licensed catalogue photos
    expect(src('public/home-design/README.md')).toContain('CREDITS.md');
  });

  it('links the category tiles, banner and action tiles to real pages', () => {
    for (const to of ['/products?category=machinery-industrial', '/products?category=packaging', '/products?category=electronics-electricals', '/products?category=textiles-apparel', '/products?category=chemicals-raw-materials', '/categories', '/auctions', '/post-requirement', '/manufacturers', '/auth?tab=supplier']) {
      expect(landing.includes(`'${to}'`) || landing.includes(`"${to}"`)).toBe(true);
    }
    expect(landing).toContain("isSupplier ? '/dashboard/supplier/products' : '/auth?tab=supplier'");
    const routes = src('src/routes.tsx');
    for (const path of ['/categories', '/auctions', '/post-requirement', '/manufacturers', '/products']) expect(routes).toContain(`path: '${path}'`);
  });

  it('gives the phone header the menu on the left, search, bell, account and an All Categories chip', () => {
    const header = src('src/components/layouts/Header.tsx');
    expect(header.indexOf('Mobile: menu button on the left of the logo')).toBeLessThan(header.indexOf('{/* Logo */}'));
    expect(header).toContain('aria-label="Search"');
    expect(header).toContain('All Categories');
    expect(header).toContain('to="/categories"');
  });

  it('shows the logo that matches the theme (white letters on dark, dark letters on the light theme)', () => {
    expect(src('src/components/common/BrandLogo.tsx')).toContain("return theme === 'light' ? BULKSKART_LOGO_LIGHT : BULKSKART_LOGO_DARK;");
  });
});
