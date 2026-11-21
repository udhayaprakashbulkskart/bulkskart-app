/**
 * Who may send a quotation on a buyer RFQ.
 *
 * Anyone (guests included) can view RFQs. Only a logged-in user with a
 * registered company AND an active paid subscription can send a quotation.
 * "Active paid" matches the database rule (is_supplier_subscribed /
 * trg_check_quotation_subscription): subscriptions.status = 'active' and
 * ends_at is empty or still in the future.
 */
export interface SubscriptionLike {
  status?: string | null;
  ends_at?: string | null;
  created_at?: string | null;
}

export function isSubscriptionActive(sub: SubscriptionLike | null | undefined, now: Date = new Date()): boolean {
  if (!sub || sub.status !== 'active') return false;
  if (!sub.ends_at) return true;
  const end = new Date(sub.ends_at).getTime();
  return Number.isNaN(end) ? false : end > now.getTime();
}

/** newest still-active subscription out of a company's rows, or null */
export function pickActiveSubscription<T extends SubscriptionLike>(rows: T[] | null | undefined, now: Date = new Date()): T | null {
  const active = (rows ?? []).filter((row) => isSubscriptionActive(row, now));
  active.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
  return active[0] ?? null;
}

export type QuoteAccess = 'allowed' | 'not_logged_in' | 'not_registered_business' | 'no_subscription';

export function quoteAccess(opts: { loggedIn: boolean; hasCompany: boolean; isAdmin?: boolean; hasPaidSubscription: boolean }): QuoteAccess {
  if (!opts.loggedIn) return 'not_logged_in';
  if (opts.isAdmin) return 'allowed';
  if (!opts.hasCompany) return 'not_registered_business';
  if (!opts.hasPaidSubscription) return 'no_subscription';
  return 'allowed';
}

export const QUOTE_ACCESS_NOTE = 'Anyone can view this RFQ. Only registered companies with an active paid subscription can send quotations.';
