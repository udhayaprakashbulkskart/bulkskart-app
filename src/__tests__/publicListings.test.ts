import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isMissingColumnError, isPublicListing, postedOnLabel } from '@/lib/publicListings';
import { representativeImage } from '@/lib/representativeImage';
import { usableLeads } from '@/lib/rfqAlerts';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Public Requirements (collected from public pages elsewhere)', () => {
  it('are told apart from BulkSkart buyer RFQs', () => {
    expect(isPublicListing({ source_type: 'public_listing' })).toBe(true);
    expect(isPublicListing({ source_type: 'bulkskart' })).toBe(false);
    expect(postedOnLabel('2026-11-17')).toBe('17 Nov 2026');
    expect(isMissingColumnError({ code: '42703', message: 'column requirements.source_type does not exist' })).toBe(true);
  });

  it('stay out of Live RFQ: feed, counts, alerts and the RFQ list', () => {
    expect(src('src/components/common/LiveRequirementsFeed.tsx')).toContain('!isSeededRequirement(r) && !isPublicListing(r)');
    expect(src('src/components/common/LiveRequirementsFeed.tsx')).toContain("liveQuery.neq('source_type', 'public_listing')");
    expect(src('src/lib/api.ts')).toContain('!isOutsideListing(r) && !isPublicListing(r)');
    const lead = { id: 'a', title: 'U Bolt', description: null, specifications: null, quantity: 1001, quantity_unit: 'Nos', budget_min: null, budget_max: null, currency: 'INR', created_at: null };
    expect(usableLeads([{ ...lead, source_type: 'public_listing' } as never])).toHaveLength(0);
  });

  it('never name or link the source website for customers, and offer no quotation', () => {
    for (const file of ['src/components/common/PublicListingsSection.tsx', 'src/pages/RequirementDetailsPage.tsx']) {
      const text = src(file);
      expect(text, file).not.toMatch(/tradeindia|indiamart|alibaba|source_url|source_name|VIEW ORIGINAL/i);
    }
    const section = src('src/components/common/PublicListingsSection.tsx');
    expect(section).toContain("eq('review_status', 'approved')");
    expect(section).toContain(".gt('expires_at', new Date().toISOString())");
    expect(section).toContain('Representative image');
    expect(section).not.toMatch(/Send Quotation|Submit Quotation/);
  });

  it('uses a category picture only when it clearly matches the product', () => {
    expect(representativeImage('Screw Conveyor Mild Steel Hanger Bearing', 'Bearings')?.name).toMatch(/Bearing/);
    expect(representativeImage('Something unrelated', 'Zzz')).toBeNull();
  });

  it('keeps the source admin-only, removes duplicates, expires after 30 days and blocks quotations', () => {
    const m = src('supabase/migrations/00068_public_listing_rfqs.sql');
    expect(m).toContain('source_url text NOT NULL UNIQUE');
    expect(m).toContain('ALTER TABLE public_listing_sources ENABLE ROW LEVEL SECURITY');
    expect(m).toContain('FOR SELECT USING (is_admin())');
    expect(m).toContain("IF NEW.status <> 'active' OR NEW.source_type = 'public_listing' THEN");
    expect(m).toContain('BEFORE INSERT ON quotations');
    expect(src('scripts/public-rfqs/export_batch.py')).toContain('timedelta(days=30)');
    expect(src('src/routes.tsx')).toContain("path: '/dashboard/admin/public-requirements'");
  });
});
