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
