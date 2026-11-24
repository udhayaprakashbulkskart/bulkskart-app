/**
 * Keeps RFQs on BulkSkart.
 *
 * Some buying requirements were brought in from other websites (government tender portals and other marketplaces)
 * and point buyers and suppliers to those sites. The live RFQ feed leaves such listings out, and attachments are only
 * opened when they are stored by BulkSkart itself.
 */
import type { Requirement } from '@/types/types';
import { INCLUDE_TEMPLATE_SEED_DATA, SEEDED_FEED_DESCRIPTION_ILIKE } from '@/lib/seedData';

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

/**
 * A government tender copied from the GeM portal (Government e-Marketplace). BulkSkart does not list these: they are
 * never shown, and a link to one opens as not found. Matched on the importer's own wording or a gem.gov.in link, so a
 * buyer who mentions GeM in their own requirement, or sells gem stones, is not caught.
 */
export const TENDER_IMPORT_PREFIX = 'Government buyer requirement published on GeM';

/** Leaves out, in the query itself, government tenders copied from the GeM portal. */
export function withoutTenderImports<Q extends { or: (filters: string) => Q }>(query: Q): Q {
  return query.or(`description.is.null,description.not.like.${TENDER_IMPORT_PREFIX.replace(/ /g, '*')}*`);
}

export function isTenderImport(req: Pick<Requirement, 'title' | 'description' | 'specifications'>): boolean {
  const text = [req.title, req.description, req.specifications].filter(Boolean).join(' \n ');
  return (req.description ?? '').trim().startsWith(TENDER_IMPORT_PREFIX) || /gem\.gov\.in/i.test(text);
}

/** A listing taken from a tender portal or another website, or one that sends people there. */
export function isOutsideListing(req: Pick<Requirement, 'title' | 'description' | 'specifications'>): boolean {
  const text = [req.title, req.description, req.specifications].filter(Boolean).join(' \n ');
  // "GeM" (Government e-Marketplace) is matched with its exact spelling so "gem stones" are not caught
  return OUTSIDE_PORTAL.test(text) || /\bGeM\b/.test(text) || outsideLinksIn(text).length > 0;
}

/**
 * Leaves out, in the database query itself: requirements without a BulkSkart buyer (Public Requirements collected
 * elsewhere have none), government tender imports (their description names GeM) and feed-filler demo RFQs. The checks
 * above run on each page afterwards, but when the newest rows are all such listings a page would otherwise come back
 * empty although real RFQs exist further down.
 */
export function withoutOutsideOrDemoRfqs<Q extends { or: (filters: string) => Q }>(query: Q): Q {
  let q = query.or('buyer_id.not.is.null');
  // case-sensitive "GeM", so "gem stones" stay
  q = q.or('description.is.null,description.not.like.*GeM*');
  if (!INCLUDE_TEMPLATE_SEED_DATA) q = q.or(`description.is.null,description.not.ilike.${SEEDED_FEED_DESCRIPTION_ILIKE}`);
  return q;
}
