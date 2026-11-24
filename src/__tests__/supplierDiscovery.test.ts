import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/supabase', () => ({ supabase: { rpc: vi.fn() } }));

import { CATEGORY_LABELS, categoryLabel, discoveryError } from '@/lib/discovery/api';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('supplier discovery: website side', () => {
  it('turns database error codes into plain sentences', () => {
    expect(discoveryError('only_verified_can_be_published')).toBe('Only a verified supplier can be published.');
    expect(discoveryError('ERROR: note_required')).toMatch(/short note/);
    expect(discoveryError(null)).toMatch(/try again/);
  });

  it('uses the same category slugs as the worker and the site', () => {
    const worker = src('scripts/discovery/src/categories.mjs');
    const workerSlugs = [...worker.matchAll(/\['([a-z-]+)', \//g)].map((m) => m[1]).sort();
    expect(Object.keys(CATEGORY_LABELS).sort()).toEqual(workerSlugs);
    expect(categoryLabel('packaging')).toBe('Packaging');
  });

  it('the public directory never shows contacts, GSTINs, source links or the website', () => {
    const page = src('src/pages/SupplierDirectoryPage.tsx');
    for (const field of ['public_phones', 'public_emails', 'gstin', 'source_url', 'website_url', 'website_host', 'image_source_url', 'evidence']) {
      expect(page, field).not.toContain(field);
    }
    expect(page).not.toMatch(/target="_blank"|href=\{p\.|href=\{s\./);
  });

  it('the public directory reads only the directory functions (published, verified records)', () => {
    const page = src('src/pages/SupplierDirectoryPage.tsx');
    expect(page).toContain('directorySuppliers');
    expect(page).not.toMatch(/admin(Suppliers|Products|SupplierDetail)/);
    const migration = src('supabase/migrations/00074_supplier_discovery.sql');
    const directory = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.directory_suppliers'));
    expect(directory).toContain("publish_status = 'published' AND s.verification_status = 'verified'");
    expect(migration).toContain("CONSTRAINT suppliers_published_is_verified CHECK (publish_status <> 'published' OR verification_status = 'verified')");
  });

  it('nothing in the worker or migration ships records: no inserts of businesses or products', () => {
    const migration = src('supabase/migrations/00074_supplier_discovery.sql');
    expect(migration).not.toMatch(/INSERT INTO discovery\.(suppliers|products|product_sources)\s*\([^)]*\)\s*VALUES\s*\('/);
  });
});
