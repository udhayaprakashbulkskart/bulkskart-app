import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { displayPriorityTag, isUrgentFromTag, normalizePriorityChoice, normalizePriorityTag, priorityTagForStorage, PRIORITY_TAG_REQUIRED_MESSAGE, RFQ_PRIORITY_CLASS, RFQ_PRIORITY_LABEL } from '@/lib/rfqPriority';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('normalizePriorityTag', () => {
  it('accepts only urgent, emergency and hot, and treats everything else as untagged', () => {
    expect(normalizePriorityTag('urgent')).toBe('urgent');
    expect(normalizePriorityTag('Emergency')).toBe('emergency');
    expect(normalizePriorityTag(' HOT ')).toBe('hot');
    expect(normalizePriorityTag(null)).toBeNull();
    expect(normalizePriorityTag(undefined)).toBeNull();
    expect(normalizePriorityTag('')).toBeNull();
    expect(normalizePriorityTag('new')).toBeNull();
    expect(normalizePriorityTag('priority')).toBeNull();
  });

  it('shows Urgent when only the older is_urgent flag is set, and prefers a chosen tag', () => {
    expect(displayPriorityTag({ priority_tag: null, is_urgent: true })).toBe('urgent');
    expect(displayPriorityTag({ is_urgent: true })).toBe('urgent');
    expect(displayPriorityTag({ priority_tag: 'emergency', is_urgent: true })).toBe('emergency');
    expect(displayPriorityTag({ priority_tag: 'hot', is_urgent: false })).toBe('hot');
    expect(displayPriorityTag({ priority_tag: null, is_urgent: false })).toBeNull();
    expect(displayPriorityTag({})).toBeNull();
  });

  it('keeps the older is_urgent flag in step with Urgent and Emergency only', () => {
    expect(isUrgentFromTag('urgent')).toBe(true);
    expect(isUrgentFromTag('emergency')).toBe(true);
    expect(isUrgentFromTag('hot')).toBe(false);
    expect(isUrgentFromTag(null)).toBe(false);
  });

  it('uses red for Emergency, BulkSkart orange for Urgent, and amber for Hot', () => {
    expect(RFQ_PRIORITY_LABEL.emergency).toBe('Emergency');
    expect(RFQ_PRIORITY_LABEL.urgent).toBe('Urgent Requirement');
    expect(RFQ_PRIORITY_LABEL.regular).toBe('Regular');
    expect(RFQ_PRIORITY_LABEL.hot).toBe('Hot');
    expect(RFQ_PRIORITY_CLASS.emergency).toContain('bg-red-600');
    expect(RFQ_PRIORITY_CLASS.urgent).toContain('bg-[#FF5A00]');
    expect(RFQ_PRIORITY_CLASS.hot).toContain('bg-amber-500');
  });
});

describe('migration 00081', () => {
  const sql = src('supabase/migrations/00081_rfq_priority_tag.sql');

  it('adds a nullable priority_tag with a check constraint and does not backfill existing rows', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS priority_tag text/i);
    expect(sql).toMatch(/priority_tag IN \('urgent', 'emergency', 'hot'\)/);
    expect(sql).toMatch(/priority_tag IS NULL OR/);
    expect(sql).toMatch(/NOTIFY pgrst, 'reload schema'/);
    expect(sql).not.toMatch(/UPDATE\s+public\.requirements/i);
    expect(sql).not.toMatch(/SET\s+priority_tag/i);
    expect(sql).not.toMatch(/\bphone\b|\bemail\b|whatsapp_number/i);
    expect(sql).not.toMatch(/profile_contacts|rfq_buyer_contacts|my_profile/);
  });
});

describe('the tag is required on the post form and visible on RFQ cards and the detail page', () => {
  it('adds a required chip picker on both post-requirement forms, and stores Regular as null', () => {
    const dialog = src('src/components/common/PostRequirementDialog.tsx');
    const page = src('src/pages/PostRequirementPage.tsx');
    expect(dialog).toContain('RfqPriorityPicker');
    expect(page).toContain('RfqPriorityPicker');
    expect(dialog).toContain('priorityTagForStorage(form.priority_tag)');
    expect(page).toContain('priorityTagForStorage(normalizePriorityChoice(form.priorityTag))');
    expect(dialog).toContain('PRIORITY_TAG_REQUIRED_MESSAGE');
    expect(page).toContain('PRIORITY_TAG_REQUIRED_MESSAGE');
    expect(dialog).toContain('required');
    expect(page).toContain('required');
    expect(dialog).toContain('isUrgentFromTag');
    expect(page).toContain('isUrgentFromTag');
    expect(priorityTagForStorage('regular')).toBeNull();
    expect(priorityTagForStorage('urgent')).toBe('urgent');
    expect(priorityTagForStorage(null)).toBeNull();
    expect(normalizePriorityChoice('regular')).toBe('regular');
    expect(normalizePriorityChoice('Urgent')).toBe('urgent');
    expect(isUrgentFromTag('regular')).toBe(false);
    expect(PRIORITY_TAG_REQUIRED_MESSAGE).toBe('Choose a priority tag');
  });

  it('shows the badge on the home ticker, the list, and the detail page, and lets the owner edit it', () => {
    const ticker = src('src/components/home/LiveRfqScrollSection.tsx');
    const list = src('src/pages/RequirementsPage.tsx');
    const detail = src('src/components/common/RequirementDetailDrawer.tsx');
    expect(ticker).toContain('RfqPriorityBadge');
    expect(ticker).toContain('displayPriorityTag');
    expect(ticker).toContain('priorityTag');
    expect(list).toContain('RfqPriorityBadge');
    expect(list).toContain('displayPriorityTag');
    expect(detail).toContain('RfqPriorityBadge');
    expect(detail).toContain('OwnerPriorityEditor');
    expect(detail).toContain('canEditPriority');
    expect(detail).toContain("profile?.role === 'admin'");
    expect(detail).toContain('updateRequirement');
  });
});
