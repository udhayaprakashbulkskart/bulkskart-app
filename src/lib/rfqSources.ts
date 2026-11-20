/**
 * Keeps RFQs on BulkSkart.
 *
 * Some buying requirements were brought in from other websites (government tender portals and other marketplaces)
 * and point buyers and suppliers to those sites. The live RFQ feed leaves such listings out, and attachments are only
 * opened when they are stored by BulkSkart itself.
 */
import type { Requirement } from '@/types/types';

const OWN_DOMAINS = ['bulkskart.com'];

const SUPABASE_HOST = (() => {
  try {
    return new URL(String(import.meta.env.VITE_SUPABASE_URL || '')).host;
  } catch {
    return '';
  }
})();

/** Government and tender portals, by name or address. */
const OUTSIDE_PORTAL = /(?:\bgem\.gov\.in\b|\b[a-z0-9-]+\.gov\.in\b|\b[a-z0-9-]+\.nic\.in\b|\beprocure\b|\bcppp\b|\be-?tenders?\b|\btenderwizard\b|\btender ?tiger\b|\bbidassist\b|\bindiamart\b|\btradeindia\b|\bexportersindia\b|\balibaba\.com\b)/i;

// a web address, without punctuation that ends the sentence after it
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]*[^\s<>"')\].,;:!?]/gi;

/** True for site paths and files stored by BulkSkart (its own domain or its file storage). */
export function isOwnUrl(url?: string | null): boolean {
  const value = (url ?? '').trim();
  if (!value) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const u = new URL(value.startsWith('www.') ? `https://${value}` : value);
    const host = u.hostname.toLowerCase();
    if (OWN_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) return true;
    const isStorage = u.pathname.startsWith('/storage/v1/object/');
    if (isStorage && (u.host === SUPABASE_HOST || host.endsWith('.supabase.co'))) return true;
    return false;
  } catch {
    return false;
  }
}

/** Links in the text that lead away from BulkSkart. */
export function outsideLinksIn(text?: string | null): string[] {
  if (!text) return [];
  return (text.match(LINK) ?? []).filter((link) => !isOwnUrl(link));
}

/** The text without links to other websites. */
export function withoutOutsideLinks(text?: string | null): string {
  if (!text) return '';
  return text.replace(LINK, (link) => (isOwnUrl(link) ? link : '')).replace(/[ \t]{2,}/g, ' ').trim();
}

/** A listing taken from a tender portal or another website, or one that sends people there. */
export function isOutsideListing(req: Pick<Requirement, 'title' | 'description' | 'specifications'>): boolean {
  const text = [req.title, req.description, req.specifications].filter(Boolean).join(' \n ');
  // "GeM" (Government e-Marketplace) is matched with its exact spelling so "gem stones" are not caught
  return OUTSIDE_PORTAL.test(text) || /\bGeM\b/.test(text) || outsideLinksIn(text).length > 0;
}
