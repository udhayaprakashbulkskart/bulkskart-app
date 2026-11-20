import { gemTenderUrl, specificationProse } from '@/lib/externalListing';
import type { Requirement } from '@/types/types';

/**
 * What a requirement card shows, taken only from what the buyer saved. Nothing is guessed from the
 * title: no stock photo, no made-up place, no random "urgent" tag and no "verified" badge the buyer
 * has not earned. Where the buyer left something out, the card says so or leaves it out.
 */

export type RequirementTagType = 'urgent' | 'new' | 'expiring' | 'open';

export interface RequirementVisualInfo {
  /** the buyer's own photo, or null (cards then show a plain tile, never a stock photo) */
  image: string | null;
  /** delivery city and country as the buyer typed them, or "Location not stated" */
  locationDisplay: string;
  hasLocation: boolean;
  tag: {
    label: string;
    type: RequirementTagType;
    bgClass: string;
    textClass: string;
  };
  /** "Verified buyer" only when the buyer is verified, otherwise empty */
  verifiedStatus: string;
  /** the buyer's deadline ("Needed by 12 Dec") or how many quotes it has, otherwise empty */
  orderAttribute: string;
  attributeIcon: 'calendar' | 'quotes' | 'none';
  /** first line of the description or specifications, otherwise empty */
  subtitle: string;
  cleanTitle: string;
  quantityDisplay: string;
  /** GeM bid link when the specifications carry one, otherwise null */
  governmentTenderUrl: string | null;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** How long a requirement counts as new, and how close a deadline counts as closing soon. */
export const NEW_REQUIREMENT_HOURS = 48;
export const CLOSING_SOON_DAYS = 7;

const IMAGE_FILE = /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i;

/** The buyer's attachment when it is a picture. */
export function buyerImage(req: Pick<Requirement, 'attachment_url'>): string | null {
  const url = (req.attachment_url ?? '').trim();
  if (!url) return null;
  return IMAGE_FILE.test(url) || url.startsWith('data:image/') ? url : null;
}

/** "5,000 kg"; a quantity of zero or less reads "Quantity not stated". */
export function quantityLabel(req: Pick<Requirement, 'quantity' | 'quantity_unit'>): string {
  const amount = Number(req.quantity);
  if (!Number.isFinite(amount) || amount <= 0) return 'Quantity not stated';
  return `${amount.toLocaleString('en-IN')} ${(req.quantity_unit ?? '').trim()}`.trim();
}

/** "Chennai, India", "India", or null when the buyer named no place. */
export function placeLabel(req: Pick<Requirement, 'destination_city' | 'destination_country'>): string | null {
  const parts = [req.destination_city, req.destination_country].map((part) => (part ?? '').trim()).filter(Boolean);
  const unique = parts.filter((part, i) => parts.findIndex((other) => other.toLowerCase() === part.toLowerCase()) === i);
  return unique.length ? unique.join(', ') : null;
}

/** Midnight at the end of the deadline day, so a requirement stays open through its last day. */
function deadlineEnd(deadline: string | null | undefined): number | null {
  if (!deadline) return null;
  const day = new Date(`${deadline.slice(0, 10)}T23:59:59`);
  return Number.isNaN(day.getTime()) ? null : day.getTime();
}

export function requirementTag(
  req: Pick<Requirement, 'created_at' | 'deadline'> & { is_urgent?: boolean | null },
  now = Date.now(),
): RequirementVisualInfo['tag'] {
  if (req.is_urgent) return { label: 'URGENT', type: 'urgent', bgClass: 'bg-[#ff3b30]', textClass: 'text-white' };
  const end = deadlineEnd(req.deadline);
  if (end !== null && end >= now && end - now <= CLOSING_SOON_DAYS * DAY) {
    return { label: 'CLOSING SOON', type: 'expiring', bgClass: 'bg-[#e55000]', textClass: 'text-white' };
  }
  const posted = new Date(req.created_at).getTime();
  if (Number.isFinite(posted) && now - posted <= NEW_REQUIREMENT_HOURS * HOUR) {
    return { label: 'NEW', type: 'new', bgClass: 'bg-[#FF5A00]', textClass: 'text-white' };
  }
  return { label: 'OPEN', type: 'open', bgClass: 'bg-muted', textClass: 'text-foreground' };
}

function firstLine(text?: string | null, max = 90): string {
  const line = (text ?? '')
    .split('\n')
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return '';
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

export function getRequirementVisualInfo(
  req: Requirement & { is_urgent?: boolean | null },
  _index = 0,
  now = Date.now(),
): RequirementVisualInfo {
  const place = placeLabel(req);
  const deadline = deadlineEnd(req.deadline);
  const quotes = Number(req.quote_count) || 0;
  const governmentTenderUrl = gemTenderUrl(req.specifications);
  const specLine = governmentTenderUrl ? specificationProse(req.specifications) : req.specifications;

  let orderAttribute = '';
  let attributeIcon: RequirementVisualInfo['attributeIcon'] = 'none';
  if (deadline !== null) {
    const day = new Date(deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    orderAttribute = deadline >= now ? `Needed by ${day}` : `Deadline was ${day}`;
    attributeIcon = 'calendar';
  } else if (quotes > 0) {
    orderAttribute = `${quotes} quote${quotes === 1 ? '' : 's'} received`;
    attributeIcon = 'quotes';
  }

  return {
    image: buyerImage(req),
    locationDisplay: place ?? 'Location not stated',
    hasLocation: place !== null,
    tag: requirementTag(req, now),
    verifiedStatus: req.is_verified_buyer ? 'Verified buyer' : '',
    orderAttribute,
    attributeIcon,
    subtitle: firstLine(req.description) || firstLine(specLine),
    cleanTitle: (req.title ?? '').trim() || 'Untitled requirement',
    quantityDisplay: quantityLabel(req),
    governmentTenderUrl,
  };
}
