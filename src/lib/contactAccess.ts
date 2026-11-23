/**
 * Who may see phone numbers, WhatsApp numbers and email addresses on public profile and product pages.
 *
 * Only members with an active paid subscription (admins count as paid, see AuthContext) and the person themselves.
 * Everyone else still reaches them on BulkSkart: chat, quote requests and factory visits stay open to all.
 */
export function canViewContacts(opts: { isPaidSubscriber: boolean; viewerId?: string | null; ownerId?: string | null }): boolean {
  if (opts.isPaidSubscriber) return true;
  return Boolean(opts.viewerId && opts.ownerId && opts.viewerId === opts.ownerId);
}

/** Where to go to get a paid plan: manufacturers to their subscription page, everyone else to the plans. */
export function contactUpgradeHref(role?: string | null): string {
  return role === 'supplier' ? '/dashboard/supplier/subscription' : '/pricing';
}

export const CONTACT_LOCK_NOTE = 'Phone, WhatsApp and email are visible only to members with an active paid subscription.';

const CONTACT_COLUMN = /^(email|phone|whatsapp_number)$/;
/** Profile columns visitors may read (migration 00069 keeps phone, email and WhatsApp from them). */
export const PROFILE_PUBLIC_COLUMNS = 'id,full_name,company_name,avatar_url,role,status,country,state,city,created_at,updated_at,onboarding_completed';

/**
 * The same select without profile contact columns, for visitors who are not signed in: the database refuses those
 * columns to them, so a request that names them (or "profiles(*)") would fail as a whole.
 * "*, profiles!buyer_id(id,full_name,email,phone)" -> "*, profiles!buyer_id(id,full_name)".
 */
export function withoutProfileContacts(select: string): string {
  return select.replace(/(profiles(?:![\w]+)*)\(([^)]*)\)/g, (_m, head: string, cols: string) => {
    if (cols.trim() === '*') return `${head}(${PROFILE_PUBLIC_COLUMNS})`;
    const kept = cols.split(',').map((c) => c.trim()).filter((c) => c && !CONTACT_COLUMN.test(c));
    return `${head}(${kept.join(',') || 'id'})`;
  });
}
