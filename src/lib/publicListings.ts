/**
 * Public Requirements: buyer requirements collected from publicly accessible pages on other B2B websites
 * (supabase/migrations/00068_public_listing_rfqs.sql).
 *
 * They are a separate module from Live RFQ (BulkSkart buyer RFQs): they never appear in its feed, counts or alerts,
 * customers are never shown or sent to the source website (kept admin-only in public_listing_sources), and no
 * quotation is offered because the buyer has not authorised BulkSkart to receive and forward one.
 */
import type { Requirement } from '@/types/types';

export type RequirementSource = 'bulkskart' | 'public_listing';

/** True for a Public Requirement (collected elsewhere), false for an RFQ posted by a BulkSkart buyer. */
export function isPublicListing(req: Pick<Requirement, 'source_type'> | null | undefined): boolean {
  return req?.source_type === 'public_listing';
}

/** "17 Nov 2026" */
export function postedOnLabel(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date.length <= 10 ? `${date}T00:00:00` : date);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** PostgREST error for a column or table the database does not have yet (before the migration is applied). */
export function isMissingColumnError(err: { code?: string; message?: string } | null | undefined): boolean {
  return !!err && (err.code === '42703' || err.code === '42P01' || err.code === 'PGRST205' || /source_type|review_status|public_listing_sources/.test(err.message ?? ''));
}
