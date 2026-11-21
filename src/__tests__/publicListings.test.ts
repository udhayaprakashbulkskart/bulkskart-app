import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isMissingColumnError, isPublicListing, originalListingUrl, postedOnLabel } from '@/lib/publicListings';
import { usableLeads } from '@/lib/rfqAlerts';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('public RFQ listings from other marketplaces', () => {
  it('are told apart from BulkSkart buyer RFQs', () => {
    expect(isPublicListing({ source_type: 'public_listing' })).toBe(true);
    expect(isPublicListing({ source_type: 'bulkskart' })).toBe(false);
    expect(isPublicListing({ source_type: undefined })).toBe(false);
    expect(originalListingUrl({ source_url: 'https://www.tradeindia.com/buyoffer/1/x.html' })).toBe('https://www.tradeindia.com/buyoffer/1/x.html');
    expect(originalListingUrl({ source_url: 'javascript:alert(1)' })).toBeNull();
    expect(postedOnLabel('2026-11-17')).toBe('17 Nov 2026');
    expect(isMissingColumnError({ code: '42703', message: 'column requirements.source_type does not exist' })).toBe(true);
  });

  it('never appear as BulkSkart RFQs in feeds, counts, alerts or the RFQ list', () => {
    expect(src('src/components/common/LiveRequirementsFeed.tsx')).toContain('!isSeededRequirement(r) && !isPublicListing(r)');
    expect(src('src/components/common/LiveRequirementsFeed.tsx')).toContain("liveQuery.neq('source_type', 'public_listing')");
    expect(src('src/lib/api.ts')).toContain('!isOutsideListing(r) && !isPublicListing(r)');
    const lead = { id: 'a', title: 'U Bolt', description: null, specifications: null, quantity: 1001, quantity_unit: 'Nos', budget_min: null, budget_max: null, currency: 'INR', created_at: null };
    expect(usableLeads([{ ...lead, source_type: 'public_listing' } as never])).toHaveLength(0);
    expect(usableLeads([lead])).toHaveLength(1);
  });

  it('show the PUBLIC LISTING label and a VIEW ORIGINAL RFQ button, never a BulkSkart quote', () => {
    const section = src('src/components/common/PublicListingsSection.tsx');
    expect(section).toContain('PUBLIC LISTING');
    expect(section).toContain('VIEW ORIGINAL RFQ');
    expect(section).toContain('rel="nofollow noopener noreferrer"');
    const detail = src('src/pages/RequirementDetailsPage.tsx');
    expect(detail).toContain('if (isPublicListing(req))');
  });

  it('are stored apart, deduplicated by source URL, and skip supplier matching and quotations', () => {
    const m = src('supabase/migrations/00068_public_listing_rfqs.sql');
    expect(m).toContain("CHECK (source_type IN ('bulkskart', 'public_listing'))");
    expect(m).toContain('CREATE UNIQUE INDEX IF NOT EXISTS requirements_source_url_key ON requirements (source_url) WHERE source_url IS NOT NULL');
    expect(m).toContain("IF NEW.status <> 'active' OR NEW.source_type = 'public_listing' THEN");
    expect(m).toContain('BEFORE INSERT ON quotations');
    const batch = src('supabase/migrations/00069_public_listing_rfqs_test_batch.sql');
    expect(batch).toContain('ON CONFLICT (source_url) WHERE source_url IS NOT NULL DO NOTHING');
    expect((batch.match(/'public_listing', 'TradeIndia', 'https:\/\/www\.tradeindia\.com\/buyoffer\//g) ?? []).length).toBe(10);
    expect(existsSync(join(process.cwd(), 'docs/public-rfqs/test_batch_2026-11-21.csv'))).toBe(true);
  });
});
