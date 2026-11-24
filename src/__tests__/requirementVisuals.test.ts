import { describe, expect, it } from 'vitest';
import { buyerImage, getRequirementVisualInfo, placeLabel, quantityLabel, requirementTag } from '@/lib/requirementVisuals';
import type { Requirement } from '@/types/types';

const NOW = new Date('2026-11-16T12:00:00Z').getTime();
const DAY = 86_400_000;

function req(overrides: Partial<Requirement> & { is_urgent?: boolean } = {}): Requirement & { is_urgent?: boolean } {
  return {
    id: 'r1',
    buyer_id: 'b1',
    category_id: null,
    title: 'Saree fabric rolls',
    description: null,
    specifications: null,
    quantity: 5000,
    quantity_unit: 'kg',
    destination_country: null,
    destination_city: null,
    deadline: null,
    budget_min: null,
    budget_max: null,
    currency: 'INR',
    attachment_url: null,
    status: 'active',
    quote_count: 0,
    view_count: 0,
    is_verified_buyer: false,
    created_at: new Date(NOW - 10 * DAY).toISOString(),
    updated_at: new Date(NOW - 10 * DAY).toISOString(),
    expires_at: null,
    ...overrides,
  } as Requirement & { is_urgent?: boolean };
}

describe('requirement cards show only what the buyer saved', () => {
  it('uses the buyer photo, and no stand-in picture when there is none', () => {
    expect(buyerImage(req({ attachment_url: 'https://x.test/a/photo.JPG' }))).toBe('https://x.test/a/photo.JPG');
    expect(buyerImage(req({ attachment_url: 'https://x.test/spec-sheet.pdf' }))).toBeNull();
    expect(getRequirementVisualInfo(req(), 0, NOW).image).toBeNull();
  });

  it('never guesses a place from the title', () => {
    const info = getRequirementVisualInfo(req({ title: 'Saree fabric from Surat' }), 0, NOW);
    expect(info.locationDisplay).toBe('Location not stated');
    expect(info.hasLocation).toBe(false);
    expect(placeLabel(req({ destination_city: 'Chennai', destination_country: 'India' }))).toBe('Chennai, India');
    expect(placeLabel(req({ destination_city: 'India', destination_country: 'india' }))).toBe('India');
  });

  it('shows "verified" only for a verified buyer', () => {
    expect(getRequirementVisualInfo(req(), 0, NOW).verifiedStatus).toBe('');
    expect(getRequirementVisualInfo(req({ is_verified_buyer: true }), 0, NOW).verifiedStatus).toBe('Verified buyer');
  });

  it('tags from the buyer\'s own fields, the same for any position in a list', () => {
    expect(requirementTag(req({ is_urgent: true }), NOW).type).toBe('urgent');
    expect(requirementTag(req({ deadline: new Date(NOW + 3 * DAY).toISOString().slice(0, 10) }), NOW).type).toBe('expiring');
    expect(requirementTag(req({ created_at: new Date(NOW - 3_600_000).toISOString() }), NOW).type).toBe('new');
    expect(requirementTag(req(), NOW).type).toBe('open');
    const tags = [0, 1, 2, 3, 4, 5, 6].map((i) => getRequirementVisualInfo(req(), i, NOW).tag.type);
    expect(new Set(tags)).toEqual(new Set(['open']));
  });

  it('writes the quantity as saved, and says so when it is missing', () => {
    expect(quantityLabel(req({ quantity: 25000, quantity_unit: 'Pcs' }))).toBe('25,000 Pcs');
    expect(quantityLabel(req({ quantity: 0 }))).toBe('Quantity not stated');
  });

  it('shows the deadline or the real quote count, otherwise nothing', () => {
    const withDeadline = getRequirementVisualInfo(req({ deadline: '2026-12-12' }), 0, NOW);
    expect(withDeadline.orderAttribute).toBe('Needed by 12 Dec');
    expect(getRequirementVisualInfo(req({ quote_count: 3 }), 0, NOW).orderAttribute).toBe('3 quotes received');
    expect(getRequirementVisualInfo(req(), 0, NOW).orderAttribute).toBe('');
  });

  it('uses the first line of the description, and nothing made up when it is empty', () => {
    expect(getRequirementVisualInfo(req({ description: '\nPure silk, 5.5 m\nMore text' }), 0, NOW).subtitle).toBe('Pure silk, 5.5 m');
    expect(getRequirementVisualInfo(req(), 0, NOW).subtitle).toBe('');
  });

  it('offers no outside tender link', () => {
    const info = getRequirementVisualInfo(req({ specifications: 'Grade: A' }), 0, NOW);
    expect(info).not.toHaveProperty('governmentTenderUrl');
    expect(info.subtitle).toBe('Grade: A');
  });
});
