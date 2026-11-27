/**
 * Who may see phone numbers, WhatsApp numbers and email addresses on public profile and product pages.
 *
 * Only members with an active paid subscription (admins count as paid, see AuthContext) and the person themselves.
 * Chat, quotations, Call and WhatsApp on an RFQ are for paid suppliers only (the same paid rule).
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

const EMAIL_IN_TEXT = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// 9+ digits with spaces, dots, dashes or brackets between them: phone numbers, not quantities, dates or addresses
const PHONE_IN_TEXT = /\+?\d[\d\s().-]{7,}\d/g;

/** Text a buyer wrote, with phone numbers and email addresses in it replaced by dots (for people without a paid plan). */
export function maskContactsInText(text: string): string {
  return text
    .replace(EMAIL_IN_TEXT, '•••••@•••••')
    .replace(PHONE_IN_TEXT, (m) => (m.replace(/\D/g, '').length >= 9 ? '••••• •••••' : m));
}

export type VisibleContacts = { phone: string | null; email: string | null; whatsapp_number: string | null };

/** 10-digit Indian mobiles get a 91 prefix; already-international numbers are kept as digits only. */
export function contactDigits(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits.replace(/^00/, '');
  return null;
}

export function telHref(phone: string | null | undefined): string | null {
  const digits = contactDigits(phone);
  return digits ? `tel:+${digits}` : null;
}

/** WhatsApp chat with a short pre-filled message about this RFQ. */
export function whatsappHref(phone: string | null | undefined, rfq: { title: string; req_number?: string | null; id?: string }): string | null {
  const digits = contactDigits(phone);
  if (!digits) return null;
  const ref = rfq.req_number?.trim() || rfq.title;
  const page = rfq.id ? ` https://www.bulkskart.com/requirements/${rfq.id}` : '';
  const text = `Hello, I am a supplier on BulkSkart. I am writing about your requirement ${ref}.${page}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
