import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORY_CATALOG } from '@/data/categoryCatalog';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('All Categories page from the category PDF', () => {
  it('has every category and subcategory, each with its picture', () => {
    expect(CATEGORY_CATALOG).toHaveLength(41);
    expect(CATEGORY_CATALOG.reduce((n, c) => n + c.subcategories.length, 0)).toBe(853);
    const slugs = new Set<string>();
    for (const c of CATEGORY_CATALOG) {
      expect(slugs.has(c.slug), c.slug).toBe(false);
      slugs.add(c.slug);
      expect(existsSync(join(process.cwd(), 'public', c.banner)), c.banner).toBe(true);
      const names = new Set<string>();
      for (const s of c.subcategories) {
        expect(s.name.trim().length, c.slug).toBeGreaterThan(2);
        expect(names.has(s.name.toLowerCase()), `${c.slug}: ${s.name}`).toBe(false);
        names.add(s.name.toLowerCase());
        expect(existsSync(join(process.cwd(), 'public', s.img)), s.img).toBe(true);
      }
    }
  });

  it('includes the Consumer Electronics subcategories listed in the request', () => {
    const ce = CATEGORY_CATALOG.find((c) => c.slug === 'consumer-electronics-and-household-appliances');
    const names = ce?.subcategories.map((s) => s.name) ?? [];
    for (const n of ['Biometrics & Access Control Devices', 'Freezers, Refrigerators & Chillers', 'LED, LCD, Smart TV and Home Theatre', 'Computer Stationery Products', 'Computer Hard Disk, RAM & Pen Drives', 'Lantern, Chandeliers & Hanging Lamps', 'Domestic RO Water Purifier & Filters', 'Headphones and Microphones', 'Computer PCI Cards, Cables & Modules', 'Adaptors, Plugs & Sockets', 'CD, DVD, MP3 & Audio Video Players', 'Interior and Exterior Lighting', 'Hospital & Medical Lights', 'Decorative and Party Lights', 'Batteries & Charge Storage Devices', 'Solar & Renewable Energy Products', 'Telecommunication Equipment & Parts', 'Automobile Electrical Components', 'Electrical & Electronic Test Devices', 'Electrical & Electronic Goods Repair', 'Laptops, PC, Mainframes & Computers', 'Electrical & Signaling Contractors', 'Safety Equipment & Systems', 'Instrument Calibration & Adjustment', 'Security & Inspection Devices', 'Antennas, Wifi & Communication Tower', 'Electronic Safes & Security Systems', 'Industrial Coolers, Blowers & Fans', 'Electrical & Electronic Goods Rental', 'Calibrators & Monitoring Systems']) {
      expect(names, n).toContain(n);
    }
  });

  it('is the page behind /categories, and shows no made-up counts', () => {
    const routes = src('src/routes.tsx');
    expect(routes).toContain("{ name: 'Categories Hub', path: '/categories', element: <AllCategoriesPage />");
    expect(routes).toContain("path: '/categories/:slug', element: <AllCategoriesPage />");
    const page = src('src/pages/AllCategoriesPage.tsx');
    expect(page).not.toMatch(/\d,\d{3}\+/);
    expect(page).toContain('to={productsHref(s.name)}');
  });
});
