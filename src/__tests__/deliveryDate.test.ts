import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  deliveryByLabel,
  deliveryDateLabel,
  isoDateInTimeZone,
  isDeliveryDatePassed,
  isValidDeliveryDate,
  normalizeDeadlineInput,
  PAST_DELIVERY_DATE_MESSAGE,
  todayIsoDateIST,
} from '@/lib/deliveryDate';

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('delivery dates stay on the calendar day the buyer picked', () => {
  it('formats a date-only deadline without a UTC off-by-one', () => {
    expect(deliveryDateLabel('2026-12-12')).toBe('12 Dec 2026');
    expect(deliveryDateLabel('2026-01-01')).toBe('01 Jan 2026');
    expect(deliveryByLabel('2026-12-12', new Date('2026-11-27T18:30:00.000Z'))).toBe('Delivery by 12 Dec 2026');
    expect(normalizeDeadlineInput('2026-12-12')).toBe('2026-12-12');
    expect(normalizeDeadlineInput(' 2026-12-12T00:00:00.000Z ')).toBe('2026-12-12');
    expect(normalizeDeadlineInput('')).toBeNull();
    expect(deliveryDateLabel(null)).toBeNull();
    expect(deliveryByLabel(null)).toBeNull();
  });

  it('uses today in IST for min and for whether the date has passed, not UTC', () => {
    // 27 Nov 2026 18:30 UTC is already 28 Nov in IST (UTC+5:30)
    const lateUtc = new Date('2026-11-27T18:30:00.000Z');
    expect(todayIsoDateIST(lateUtc)).toBe('2026-11-28');
    expect(isoDateInTimeZone(lateUtc, 'UTC')).toBe('2026-11-27');
    expect(isValidDeliveryDate('2026-11-27', lateUtc)).toBe(false);
    expect(isValidDeliveryDate('2026-11-28', lateUtc)).toBe(true);
    expect(isDeliveryDatePassed('2026-11-27', lateUtc)).toBe(true);
    expect(isDeliveryDatePassed('2026-11-28', lateUtc)).toBe(false);
    expect(deliveryByLabel('2026-11-27', lateUtc)).toBe('Delivery date passed');
    expect(deliveryByLabel('2026-11-28', lateUtc)).toBe('Delivery by 28 Nov 2026');
  });

  it('does not treat the delivery day itself as passed', () => {
    const morningIst = new Date('2026-11-27T00:00:00+05:30');
    expect(todayIsoDateIST(morningIst)).toBe('2026-11-27');
    expect(isDeliveryDatePassed('2026-11-27', morningIst)).toBe(false);
    expect(isValidDeliveryDate('2026-11-27', morningIst)).toBe(true);
  });
});

describe('the post form stores deadline as a date-only value', () => {
  it('labels the field Delivery by, uses a native date input, and does not invent a date from the closing window or from UTC today', () => {
    const page = src('src/pages/PostRequirementPage.tsx');
    const dialog = src('src/components/common/PostRequirementDialog.tsx');
    expect(page).toContain('Delivery by');
    expect(dialog).toContain('label="Delivery by"');
    expect(page).toContain('type="date"');
    expect(dialog).toContain('type="date"');
    expect(page).toContain('todayIsoDateIST()');
    expect(dialog).toContain('todayIsoDateIST()');
    expect(page).toContain('normalizeDeadlineInput(form.requiredDate)');
    expect(dialog).toContain('normalizeDeadlineInput(form.deadline)');
    expect(page).not.toContain('toISOString().split(\'T\')[0]');
    expect(dialog).not.toContain('toISOString().split(\'T\')[0]');
    expect(page).not.toContain('computedDeadline');
    expect(page).toContain('PAST_DELIVERY_DATE_MESSAGE');
    expect(dialog).toContain('PAST_DELIVERY_DATE_MESSAGE');
    expect(PAST_DELIVERY_DATE_MESSAGE).toMatch(/today or a later date/i);
  });
});
