/**
 * Public listings: buyer requirements copied from public pages on other B2B marketplaces
 * (supabase/migrations/00068_public_listing_rfqs.sql).
 *
 * They are kept apart from RFQs posted by BulkSkart buyers: they never appear in the BulkSkart RFQ feeds,
 * alerts or counts, they carry a PUBLIC LISTING label, and suppliers reach the buyer through the original
 * listing (VIEW ORIGINAL RFQ), never through a BulkSkart quotation.
 */
import type { Requirement } from '@/types/types';

export type RequirementSource = 'bulkskart' | 'public_listing';

/** True for a requirement copied from another marketplace's public page. */
export function isPublicListing(req: Pick<Requirement, 'source_type'> | null | undefined): boolean {
  return req?.source_type === 'public_listing';
}

/** The original listing, when it is a normal web address. */
export function originalListingUrl(req: Pick<Requirement, 'source_url'>): string | null {
  const url = (req.source_url ?? '').trim();
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** "17 Nov 2026" from the date the listing was posted on its source. */
export function postedOnLabel(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(`${date.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** PostgREST error for a column the database does not have yet (before the migration is applied). */
export function isMissingColumnError(err: { code?: string; message?: string } | null | undefined): boolean {
  return !!err && (err.code === '42703' || /source_type/.test(err.message ?? ''));
}
