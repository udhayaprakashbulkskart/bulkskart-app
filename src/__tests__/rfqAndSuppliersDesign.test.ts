import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isOutsideListing, isOwnUrl, isTenderImport, outsideLinksIn, withoutOutsideLinks } from '@/lib/rfqSources';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('RFQs stay on BulkSkart', () => {
  it('treats only site paths and BulkSkart file storage as its own', () => {
    expect(isOwnUrl('/post-requirement')).toBe(true);
    expect(isOwnUrl('https://www.bulkskart.com/requirements')).toBe(true);
    expect(isOwnUrl('https://abcd.supabase.co/storage/v1/object/public/rfq-files/spec.pdf')).toBe(true);
    expect(isOwnUrl('https://gem.gov.in/bid/123')).toBe(false);
    expect(isOwnUrl('https://www.indiamart.com/x')).toBe(false);
    expect(isOwnUrl('//evil.example/x')).toBe(false);
    expect(isOwnUrl('')).toBe(false);
  });

  it('spots listings taken from tender portals or pointing to other websites', () => {
    expect(isOutsideListing({ title: 'Supply of LED lights (GeM tender)', description: 'Bid on https://gem.gov.in/bid/123', specifications: null })).toBe(true);
    expect(isOutsideListing({ title: 'Cotton yarn', description: 'Details at www.tradeindia.com/abc', specifications: null })).toBe(true);
    expect(isOutsideListing({ title: 'Road works', description: 'See eprocure.gov.in for documents', specifications: null })).toBe(true);
    expect(isOutsideListing({ title: 'Office chairs – GeM bid 2026', description: null, specifications: null })).toBe(true);
    expect(isOutsideListing({ title: 'Precious gem stones, 2 kg', description: null, specifications: null })).toBe(false);
    expect(isOutsideListing({ title: 'Commercial Electric Deep Fryer – 10L', description: '50 pieces, delivery to Bengaluru', specifications: '230 V, 10 litre' })).toBe(false);
  });

  it('recognises GeM government tenders, which are never listed or opened', () => {
    // the wording of the GeM rows in production
    expect(isTenderImport({ title: 'All Terrain Vehicle (MHA)', description: 'Government buyer requirement published on GeM (Government e-Marketplace). Bid GEM/2026/B/8283895.', specifications: null })).toBe(true);
    expect(isTenderImport({ title: 'HR coil', description: null, specifications: '{"source_url":"https://bidplus.gem.gov.in/all-bids/GEM/2026/B/99"}' })).toBe(true);
    expect(isTenderImport({ title: 'Precious gem stones, 2 kg', description: 'Loose gemstones for jewellery', specifications: null })).toBe(false);
    // a real buyer naming GeM in their own words keeps their requirement
    expect(isTenderImport({ title: 'Steel chairs', description: 'Need chairs as per GeM specification, 500 pcs', specifications: null })).toBe(false);
    expect(isTenderImport({ title: 'Cotton T-shirts', description: '5000 pcs to Chennai', specifications: 'GSM: 180' })).toBe(false);
  });

  it('has no GeM links, buttons or badges left in the code', () => {
    for (const file of ['src/lib/externalListing.ts', 'src/components/common/ExternalSourceLink.tsx']) expect(existsSync(join(process.cwd(), file))).toBe(false);
    for (const file of ['src/pages/AuctionsHubPage.tsx', 'src/pages/ForwardAuctionDetailPage.tsx', 'src/components/home/LiveReverseAuctionsRail.tsx', 'src/pages/RequirementsPage.tsx',
      'src/pages/RequirementDetailsPage.tsx', 'src/components/common/RequirementDetailDrawer.tsx', 'src/pages/dashboard/supplier/SupplierRFQsPage.tsx', 'src/lib/requirementVisuals.ts']) {
      const code = src(file);
      expect(code, file).not.toMatch(/View (bid )?on GeM|gem\.gov\.in|Government tender|Public auction|source listing/i);
    }
  });

  it('removes outside links from RFQ text but keeps BulkSkart ones', () => {
    expect(outsideLinksIn('see https://gem.gov.in/x and https://www.bulkskart.com/y')).toEqual(['https://gem.gov.in/x']);
    expect(withoutOutsideLinks('Specs at https://gem.gov.in/x, delivery Mumbai')).toBe('Specs at , delivery Mumbai');
  });

  it('hides outside listings in the home feed and the RFQ list, and opens only own attachments', () => {
    expect(src('src/components/common/LiveRequirementsFeed.tsx')).toContain('.filter((r) => !isOutsideListing(r) && !isSeededRequirement(r) && !isPublicListing(r))');
    expect(src('src/lib/api.ts')).toContain('rows.filter((r) => !isOutsideListing(r) && !isPublicListing(r))');
    expect(src('src/components/common/RequirementDetailDrawer.tsx')).toContain('isOwnUrl(requirement.attachment_url)');
    expect(src('src/pages/RequirementDetailsPage.tsx')).toContain('isOwnUrl(req.attachment_url)');
  });
});

describe('Live RFQ and Verified Suppliers laid out from the design pictures', () => {
  it('Live RFQ has the header, promises, counts, filters, cards and the post button', () => {
    const feed = src('src/components/common/LiveRequirementsFeed.tsx');
    for (const text of ["'Genuine Buyers'", "'Direct Quotation'", "label: 'Live RFQs'", "label: 'Open RFQ Value'", "label: 'All RFQs'", "label: 'High Value'", "label: 'My RFQs'", 'All Locations', 'Submit Quotation', 'Post a Buying Requirement (RFQ)', "label: 'Urgent RFQ'", "label: 'Multi-Product RFQ'", "label: 'New RFQ'"]) {
      expect(feed).toContain(text);
    }
    // live: realtime inserts and a countdown that ticks
    expect(feed).toContain("event: 'INSERT', schema: 'public', table: 'requirements'");
    expect(feed).toContain('setInterval(() => setNow(Date.now()), 1000)');
    // the old auto-scroll controls are gone
    expect(feed).not.toContain('Auto Scroll');
  });

  it('Verified Suppliers has the header, live pill, country chips with More, and design cards', () => {
    const sup = src('src/components/home/VerifiedSuppliersSection.tsx');
    for (const text of ['Verified Businesses', 'Genuine Manufacturers', 'Global Trade Ready', 'Live Updates:', "'More'", 'Verified Manufacturer', 'Verified Supplier', 'View Products', 'Send Inquiry']) {
      expect(sup).toContain(text);
    }
    expect(sup).toContain("navigate(s.hasProfile && isDbCompany ? `/post-requirement?supplier=${s.id}` : '/post-requirement')");
  });

  it('uses the pictures cut from the designs, and every one exists', () => {
    for (const file of ['rfq-port.jpg', 'rfq-icon.png', 'rfq-fryer.jpg', 'rfq-tshirts.jpg', 'rfq-computer.jpg', 'rfq-stove.jpg', 'sup-port.jpg', 'sup-shield.png', 'sup-cover-tower.jpg', 'sup-cover-factory.jpg']) {
      expect(existsSync(join(process.cwd(), 'public/home-design', file))).toBe(true);
    }
  });

  it('forgets saved RFQs when someone else signs in on the same browser', () => {
    expect(src('src/lib/userScopedStorage.ts')).toContain("'bulkskart_saved_rfqs'");
  });
});
