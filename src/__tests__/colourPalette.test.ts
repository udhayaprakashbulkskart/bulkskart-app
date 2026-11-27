import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The site uses white, black and orange only (red is kept for errors and
 * destructive actions). This guards against other accent colours creeping
 * back in through Tailwind colour classes.
 */
const FAMILIES = 'green|emerald|teal|lime|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|yellow|amber|slate|zinc|gray|stone';
const CLASS = new RegExp(
  `(?<![\\w\\[])(?:text|bg|border(?:-[trblxy])?|ring(?:-offset)?|fill|stroke|from|via|to|shadow|outline|divide|accent|caret|decoration|placeholder)-(?:${FAMILIES})-(?:50|[1-9]00|950)\\b`,
  'g',
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

/**
 * One exception: the Live Verified Supplier Map's brief asks for green "verified" marks (and green "approved" states
 * on its supplier and admin screens), so emerald is allowed in those files only.
 */
const VERIFIED_GREEN_FILES = [
  '/src/components/supplierMap/',
  '/src/pages/SupplierMapPage.tsx',
  '/src/pages/dashboard/supplier/SupplierMapListingPage.tsx',
  '/src/pages/dashboard/admin/AdminVerificationsPage.tsx',
];

/** Hot RFQ tags use a flame/amber badge (already live since #58). */
const HOT_AMBER_FILES = [
  '/src/lib/rfqPriority.ts',
];

describe('colour palette', () => {
  it('uses no Tailwind colour classes outside white, black (neutral), orange and red', () => {
    const found: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), 'src'))) {
      const rel = file.replace(process.cwd(), '');
      const allowGreen = VERIFIED_GREEN_FILES.some((f) => rel.startsWith(f));
      const allowAmber = HOT_AMBER_FILES.some((f) => rel.startsWith(f));
      const hits = (readFileSync(file, 'utf8').match(CLASS) ?? []).filter((h) => !(allowGreen && /-emerald-/.test(h)) && !(allowAmber && /-amber-/.test(h)));
      if (hits.length === 0) continue;
      found.push(`${rel}: ${[...new Set(hits)].join(', ')}`);
    }
    expect(found).toEqual([]);
  });
});
