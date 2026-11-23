import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkCin, checkGstin, checkLlpin, checkRegistrationNumber, checkUdyam, gstinCheckChar, isIncorporated, mapDbError, panFromGstin, validateApplication } from '@/lib/supplierMap/registration';
import { formatKm, matchSupplier, timeAgo } from '@/lib/supplierMap/matchScore';
import { COUNTRY_NAMES, findPlace, kmBetween, normaliseBounds, PLACES, placeLabel, placeLine, RADIUS_OPTIONS, searchPlaces } from '@/lib/supplierMap/places';
import { answerListingPrompt, LIST_BUSINESS_SIGNUP_HREF, listBusinessHref, markListingOffered, shouldOfferListing } from '@/lib/supplierMap/listBusinessPrompt';
import { docPathFromUrl, privateDocRef } from '@/lib/supplierMap/docPath';
import type { MapSupplier } from '@/lib/supplierMap/types';

const supplier = (over: Partial<MapSupplier> = {}): MapSupplier => ({
  company_id: 'c1', company_name: 'Tiruppur Knits', slug: 'tiruppur-knits', business_type: null, city: 'Tiruppur', state: 'Tamil Nadu', country: 'India',
  latitude: 11.1085, longitude: 77.3411, distance_km: null, rating: null, review_count: 0, logo_url: null, cover_url: null,
  gst_verified: true, cin_verified: false, udyam_verified: false, registry_verified: false, verified_since: '2026-11-01T00:00:00Z',
  matched_products: [{ id: 'p1', name: 'Cotton T-Shirt', slug: 'cotton-t-shirt', moq: 200, moq_unit: 'pcs', price_min: 120, price_max: 180, currency: 'INR', image: null }],
  product_count: 1, min_moq: 200, moq_unit: 'pcs', monthly_capacity: null, capacity_unit: null, lead_time_days: null,
  stock_status: null, supply_type: null, availability_updated_at: null, total_count: 1, ...over,
});

describe('registration numbers', () => {
  it('accepts well-formed GSTINs with a correct check character and rejects typos', () => {
    expect(checkGstin('27AAPFU0939F1ZV')).toBeNull();
    expect(checkGstin(' 07aagff2194n1z1 ')).toBeNull();
    expect(checkGstin('27AAPFU0939F1ZW')).toMatch(/typing mistake/);
    expect(checkGstin('27AAPFU0939')).toMatch(/15 characters/);
    expect(gstinCheckChar('27AAPFU0939F1Z')).toBe('V');
    expect(panFromGstin('27AAPFU0939F1ZV')).toBe('AAPFU0939F');
  });

  it('checks CIN, LLPIN and Udyam formats', () => {
    expect(checkCin('U12345TN2020PTC123456')).toBeNull();
    expect(checkCin('L17110MH1973PLC019786')).toBeNull();
    expect(checkCin('U12345TN2020XYZ123456')).not.toBeNull();
    expect(checkLlpin('AAB-1234')).toBeNull();
    expect(checkLlpin('AB-1234')).not.toBeNull();
    expect(checkUdyam('UDYAM-TN-01-1234567')).toBeNull();
    expect(checkUdyam('UDYAM-TN-1-1234567')).not.toBeNull();
  });

  it('never lets a company or LLP through on a GSTIN alone', () => {
    const base = {
      legal_name: 'ABC Pvt Ltd', cin_llpin: '', gstin: '27AAPFU0939F1ZV', udyam_number: '', registration_country: '', registration_number: '', registered_address: 'a', factory_address: 'b',
      contact_name: 'x', contact_phone: '9876543210', contact_email: 'a@b.co', documentCount: 1,
    };
    expect(isIncorporated('private_limited')).toBe(true);
    expect(validateApplication({ ...base, entity_type: 'private_limited' }).cin_llpin).toMatch(/CIN/);
    expect(validateApplication({ ...base, entity_type: 'llp' }).cin_llpin).toMatch(/LLPIN/);
    expect(validateApplication({ ...base, entity_type: 'private_limited', cin_llpin: 'U12345TN2020PTC123456' })).toEqual({});
    expect(validateApplication({ ...base, entity_type: 'proprietorship' })).toEqual({});
    expect(validateApplication({ ...base, entity_type: 'proprietorship', gstin: '' }).gstin).toMatch(/GSTIN or a Udyam/);
    expect(validateApplication({ ...base, entity_type: 'partnership', documentCount: 0 }).documents).toBeTruthy();
  });

  it('accepts businesses registered outside India on their own registration number', () => {
    const base = {
      legal_name: 'Gulf Packaging LLC', cin_llpin: '', gstin: '', udyam_number: '', registration_country: 'United Arab Emirates', registration_number: 'DMCC-12345',
      registered_address: 'JLT, Dubai', factory_address: 'Jebel Ali', contact_name: 'x', contact_phone: '+971 50 000 0000', contact_email: 'a@b.co', documentCount: 1,
      entity_type: 'foreign_company' as const,
    };
    expect(validateApplication(base)).toEqual({});
    expect(validateApplication({ ...base, registration_country: 'India' }).registration_country).toBeTruthy();
    expect(validateApplication({ ...base, registration_number: '' }).registration_number).toBeTruthy();
    expect(checkRegistrationNumber('HRB 12345')).toBeNull();
    expect(checkRegistrationNumber('#')).not.toBeNull();
    expect(mapDbError({ message: 'registry_not_verified' })).toMatch(/registry/);
  });

  it('turns database refusals into plain messages', () => {
    expect(mapDbError({ message: 'cin_not_verified' })).toMatch(/GSTIN alone/);
    expect(mapDbError({ message: 'admin_only' })).toMatch(/Only admins/);
    expect(mapDbError({ code: 'PGRST202', message: 'Could not find the function public.map_search_suppliers' })).toMatch(/00071/);
  });
});

describe('match score', () => {
  it('scores only what can be measured, and explains each part', () => {
    const m = matchSupplier(supplier(), { query: 't-shirt' });
    expect(m.parts.map((p) => p.key)).toEqual(['product', 'availability', 'checks']);
    expect(m.parts.find((p) => p.key === 'product')?.points).toBe(30);
    expect(m.parts.find((p) => p.key === 'availability')?.reason).toMatch(/Not updated/);
    expect(m.score).toBeGreaterThan(0);
    expect(m.score).toBeLessThanOrEqual(100);
  });

  it('prefers nearer, in-stock, freshly updated suppliers whose MOQ fits', () => {
    const now = Date.parse('2026-11-23T00:00:00Z');
    const near = supplier({ distance_km: 4, stock_status: 'in_stock', availability_updated_at: '2026-11-22T00:00:00Z', cin_verified: true });
    const far = supplier({ distance_km: 400, stock_status: 'out_of_stock', availability_updated_at: '2026-08-01T00:00:00Z', min_moq: 900 });
    const a = matchSupplier(near, { query: 't-shirt', orderQty: 500, now });
    const b = matchSupplier(far, { query: 't-shirt', orderQty: 500, now });
    expect(a.score).toBeGreaterThan(b.score);
    expect(b.parts.find((p) => p.key === 'moq')?.reason).toMatch(/above your 500/);
    expect(a.score).toBe(100);
  });

  it('gives no points for data the supplier has not given', () => {
    const m = matchSupplier(supplier({ monthly_capacity: null }), { minCapacity: 1000 });
    expect(m.parts.find((p) => p.key === 'capacity')).toMatchObject({ points: 0, reason: 'Monthly capacity not listed' });
  });

  it('formats distances and times', () => {
    expect(formatKm(0.42)).toBe('420 m');
    expect(formatKm(4.25)).toBe('4.3 km');
    expect(formatKm(1234)).toBe('1,234 km');
    const now = Date.parse('2026-11-23T12:00:00Z');
    expect(timeAgo('2026-11-23T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-11-23T09:00:00Z', now)).toBe('3 h ago');
    expect(timeAgo('2026-11-20T12:00:00Z', now)).toBe('3 days ago');
  });
});

describe('places', () => {
  it('measures distance like the database', () => {
    const cbe = findPlace('coimbatore');
    const tpr = findPlace('Tiruppur, India');
    expect(cbe && tpr).toBeTruthy();
    if (!cbe || !tpr) return;
    expect(kmBetween(cbe.lat, cbe.lng, tpr.lat, tpr.lng)).toBeCloseTo(43.3, 0);
    expect(RADIUS_OPTIONS.map((o) => o.label)).toEqual(['Nearby', '10 km', '25 km', '50 km', '100 km', 'Worldwide']);
  });

  it('covers the world: unique places in known countries, searchable by city or country', () => {
    expect(new Set(PLACES.map(placeLabel)).size).toBe(PLACES.length);
    const known = new Set([...COUNTRY_NAMES, 'Hong Kong', 'Taiwan']);
    expect(PLACES.filter((p) => !known.has(p.country)).map(placeLabel)).toEqual([]);
    expect(new Set(PLACES.map((p) => p.country)).size).toBeGreaterThan(60);
    for (const p of PLACES) {
      expect(Math.abs(p.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(p.lng)).toBeLessThanOrEqual(180);
    }
    expect(searchPlaces('dub')[0].name).toBe('Dubai');
    expect(searchPlaces('sao paulo')[0].name).toBe('São Paulo');
    expect(searchPlaces('germany').every((p) => p.country === 'Germany')).toBe(true);
    expect(searchPlaces('zzzz')).toEqual([]);
    expect(findPlace('Dubai, United Arab Emirates')?.country).toBe('United Arab Emirates');
    expect(placeLine('Tiruppur', 'Tamil Nadu', 'India')).toBe('Tiruppur, Tamil Nadu');
    expect(placeLine('Shenzhen', 'Guangdong', 'China')).toBe('Shenzhen, China');
  });

  it('sends map views across the 180th meridian in a form the database understands', () => {
    expect(normaliseBounds({ south: -25, west: 170, north: -10, east: 190 })).toEqual({ south: -25, west: 170, north: -10, east: -170 });
    expect(normaliseBounds({ south: -100, west: -300, north: 100, east: 300 })).toEqual({ south: -90, west: -180, north: 90, east: 180 });
    expect(normaliseBounds({ south: 10, west: 70, north: 20, east: 80 })).toEqual({ south: 10, west: 70, north: 20, east: 80 });
  });
});

describe('"List your business" popup', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('goes to manufacturer signup, then straight to the map listing', () => {
    expect(LIST_BUSINESS_SIGNUP_HREF).toBe('/signup/manufacturer?redirect=%2Fdashboard%2Fsupplier%2Fmap-listing');
    expect(listBusinessHref(null, false)).toBe(LIST_BUSINESS_SIGNUP_HREF);
    expect(listBusinessHref('supplier', true)).toBe('/dashboard/supplier/map-listing');
    expect(listBusinessHref('buyer', true)).toBeNull();
    expect(listBusinessHref('admin', true)).toBeNull();
  });

  it('shows only to signed-out visitors who searched, once per visit, and stays away after an answer', () => {
    const store = memory();
    const visit = memory();
    const now = Date.parse('2026-11-23T10:00:00Z');
    const ask = (o: Partial<Parameters<typeof shouldOfferListing>[0]> = {}) =>
      shouldOfferListing({ signedIn: false, authLoading: false, searched: true, now, store, visit, ...o });
    expect(ask({ searched: false })).toBe(false);
    expect(ask({ signedIn: true })).toBe(false);
    expect(ask({ authLoading: true })).toBe(false);
    expect(ask()).toBe(true);
    markListingOffered(visit);
    expect(ask()).toBe(false);
    const nextVisit = memory();
    expect(ask({ visit: nextVisit })).toBe(true);
    answerListingPrompt('later', now, store);
    expect(ask({ visit: nextVisit, now: now + 2 * 86_400_000 })).toBe(false);
    expect(ask({ visit: nextVisit, now: now + 4 * 86_400_000 })).toBe(true);
    answerListingPrompt('buyer', now, store);
    expect(ask({ visit: nextVisit, now: now + 60 * 86_400_000 })).toBe(false);
    expect(ask({ visit: nextVisit, now: now + 91 * 86_400_000 })).toBe(true);
  });

  it('still works when the browser blocks storage', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(shouldOfferListing({ signedIn: false, authLoading: false, searched: true, store: broken, visit: broken })).toBe(true);
    expect(() => answerListingPrompt('later', Date.now(), broken)).not.toThrow();
    expect(() => markListingOffered(broken)).not.toThrow();
  });
});

describe('documents', () => {
  it('finds the private object path in links the old verification page saved', () => {
    const uid = '3f1c2b4a-1111-2222-3333-444455556666';
    expect(docPathFromUrl(`https://www.bulkskart.com/storage/v1/object/public/verification-docs/${uid}/gst/6162.pdf`)).toBe(`${uid}/gst/6162.pdf`);
    expect(docPathFromUrl(`https://x/storage/v1/object/sign/verification-docs/${uid}/a.pdf?token=t`)).toBe(`${uid}/a.pdf`);
    expect(docPathFromUrl('https://x/storage/v1/object/public/product-images/a.png')).toBeNull();
    expect(docPathFromUrl(null)).toBeNull();
  });

  it('opens documents from both private buckets through signed links', () => {
    const uid = '3f1c2b4a-1111-2222-3333-444455556666';
    expect(privateDocRef(`https://www.bulkskart.com/storage/v1/object/public/business-docs/${uid}/docs/gst-1.pdf`)).toEqual({ bucket: 'business-docs', path: `${uid}/docs/gst-1.pdf` });
    expect(privateDocRef(`https://www.bulkskart.com/storage/v1/object/public/verification-docs/${uid}/pan/a%20b.pdf`)).toEqual({ bucket: 'verification-docs', path: `${uid}/pan/a b.pdf` });
    expect(privateDocRef('https://www.bulkskart.com/storage/v1/object/public/avatars/a.png')).toBeNull();
    expect(docPathFromUrl(`https://x/storage/v1/object/public/business-docs/${uid}/a.pdf`)).toBeNull();
  });
});

describe('display rules live in the database', () => {
  const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/00071_supplier_map.sql'), 'utf8');
  const visible = sql.slice(sql.indexOf('FUNCTION public.map_visible_company_ids'), sql.indexOf('-- great-circle distance'));

  it('shows a company only when every rule holds', () => {
    for (const rule of [
      "bv.status = 'approved'",
      "fl.status = 'verified'",
      "p.status = 'active' AND p.role = 'supplier'",
      "c.verification_status = 'verified'",
      'NOT COALESCE(c.is_blocked, false)',
      'pr.is_active',
      "c.owner_id <> '00000000-0000-0000-0000-000000000001'",
      'bv.recheck_due_at > now()',
    ]) expect(visible).toContain(rule);
  });

  it('search and detail both go through those rules, and nothing is writable directly', () => {
    expect(sql.slice(sql.indexOf('FUNCTION public.map_search_suppliers'), sql.indexOf('FUNCTION public.map_supplier_detail'))).toContain('map_visible_company_ids()');
    expect(sql.slice(sql.indexOf('FUNCTION public.map_supplier_detail'), sql.indexOf('-- ── Format checks'))).toContain('map_visible_company_ids()');
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.business_verifications, public\.factory_locations/);
    expect(sql).toContain("IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only'");
    expect(sql).toContain("RAISE EXCEPTION 'cin_not_verified'");
    expect(sql).toContain("RAISE EXCEPTION 'registry_not_verified'");
    expect(sql).toContain('p_country text DEFAULT NULL');
  });

  it('makes the business document buckets private again', () => {
    expect(sql).toContain("UPDATE storage.buckets SET public = false WHERE id IN ('verification-docs', 'business-docs')");
    expect(sql).toContain('CREATE POLICY doc_buckets_owner_folder');
    expect(sql).toContain('CREATE POLICY doc_buckets_admin_read');
  });
});
