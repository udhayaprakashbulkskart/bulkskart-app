/**
 * Who may open RFQ list pages after page 1.
 * Same paid-supplier (or admin) rule as the home Live RFQ ticker (PR #54).
 * Enforcement is in the page: the open-requirements API is still a public
 * PostgREST query, and tightening it would need an RLS or schema change.
 */
export function requestedRfqListPage(search: string | URLSearchParams): number {
  const params = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    : search;
  const raw = Number.parseInt(params.get('page') || '1', 10);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  return Math.floor(raw);
}

/** Unpaid visitors stay on page 1; a request for page 2+ is blocked so the paywall can open. */
export function resolveRfqListPage(requested: number, isPaidSubscriber: boolean): { page: number; blocked: boolean } {
  const page = requested > 1 ? requested : 1;
  if (page === 1) return { page: 1, blocked: false };
  if (isPaidSubscriber) return { page, blocked: false };
  return { page: 1, blocked: true };
}
