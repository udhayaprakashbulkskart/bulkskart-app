import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/supabase', () => ({ supabase: {} }));

import { getRequirementVisualInfo } from '@/lib/requirementVisuals';
import type { Requirement } from '@/types/types';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const day = 864e5;
const req = (over: Partial<Requirement>): Requirement =>
  ({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'Cotton sarees',
    quantity: 5000,
    quantity_unit: 'pieces',
    created_at: new Date(Date.now() - 20 * day).toISOString(),
    deadline: null,
    destination_city: null,
    destination_country: 'India',
    is_verified_buyer: false,
    ...over,
  }) as unknown as Requirement;

describe('requirements show only real facts', () => {
  it('tags come from the deadline and posting date, not from the title or position', () => {
    const inDays = (n: number) => new Date(Date.now() + n * day).toISOString().slice(0, 10);
    expect(getRequirementVisualInfo(req({ deadline: inDays(2) })).tag.type).toBe('expiring');
    expect(getRequirementVisualInfo(req({ deadline: inDays(6) })).tag.type).toBe('expiring');
    expect(getRequirementVisualInfo(req({ created_at: new Date().toISOString() })).tag.type).toBe('new');
    expect(getRequirementVisualInfo(req({ created_at: new Date(Date.now() - 3 * day).toISOString() })).tag.type).toBe('open');
    expect(getRequirementVisualInfo(req({ destination_country: 'Kenya' })).tag.type).toBe('open');
    // a saree request is no longer always "urgent", and the same row gets the same tag anywhere in a list
    expect(getRequirementVisualInfo(req({}), 0).tag.type).toBe('open');
    expect(getRequirementVisualInfo(req({}), 5).tag.type).toBe('open');
  });

  it('never guesses a location or calls an unverified buyer verified', () => {
    const v = getRequirementVisualInfo(req({ destination_country: null as unknown as string }));
    expect(v.locationDisplay).toBe('Location not stated');
    expect(v.verifiedStatus).toBe('');
    expect(getRequirementVisualInfo(req({ is_verified_buyer: true })).verifiedStatus).toBe('Verified buyer');
  });

  it('the requirement list and detail page use the database only', () => {
    for (const f of ['largeRequirementsDataset', 'bulkOrdersIndiaDataset', 'buyerProfilesPool']) {
      expect(existsSync(join(process.cwd(), `src/lib/${f}.ts`)), f).toBe(false);
    }
    const list = src('src/pages/RequirementsPage.tsx');
    expect(list).toContain('getOpenRequirements(');
    expect(list).not.toMatch(/totalCount \* 0\.\d+|Nairobi|50,000\+ verified/);
    expect(src('src/pages/RequirementDetailsPage.tsx')).not.toMatch(/COTTON_SAREES|getBuyerProfileForRequirement|generateSyntheticRequirement/);
  });
});

describe('actions do what they say', () => {
  it('reports are saved for the team (or e-mailed), not kept in the browser', () => {
    const modal = src('src/components/common/ReportItemModal.tsx');
    expect(modal).toContain(".from('reports')");
    expect(modal).not.toContain('bs_reports');
    expect(src('src/routes.tsx')).toContain("path: '/dashboard/admin/reports'");
  });

  it('auction listings are never published without a real payment', () => {
    const dialog = src('src/components/auctions/CreateReverseAuctionDialog.tsx');
    expect(dialog).not.toMatch(/generatedPaymentId|rzp_pay_\$\{Date\.now\(\)\}|9876543210/);
    expect(dialog).not.toContain('`BS-REV-${randomSuffix}`');
  });

  it('awarding an auction creates a real order and reports failures', () => {
    const page = src('src/pages/ForwardAuctionDetailPage.tsx');
    expect(page).toContain('await createOrder(');
    expect(page).not.toMatch(/100% Escrow|'Verified Industrial Supplier'|\|\| 4\.9/);
  });

  it('manufacturer invitations are real messages to the manufacturer', () => {
    const page = src('src/pages/ManufacturersPage.tsx');
    expect(page).toContain('sendMessage(convId');
    expect(page).not.toContain('BS-RFQ-1042');
  });

});
