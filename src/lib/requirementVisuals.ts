import type { Requirement } from '@/types/types';
import { resolveRfqImage } from '@/lib/contentImages';

/**
 * Visual metadata and image resolver for requirements
 * Matches the layout and aesthetic of the reference screenshots:
 * - Image 1: Live Feed on Home Page
 * - Image 2: Active Buying Requirements on /requirements
 */

export interface RequirementVisualInfo {
  image: string;
  locationDisplay: string;
  tag: {
    label: string;
    type: 'urgent' | 'new' | 'expiring' | 'live' | 'bulk' | 'regular' | 'export';
    bgClass: string;
    textClass: string;
  };
  verifiedStatus: string;
  orderAttribute: string;
  attributeIcon: 'building' | 'truck' | 'ship' | 'box';
  subtitle: string;
  cleanTitle: string;
  quantityDisplay: string;
}

export function getRequirementVisualInfo(req: Requirement, _index = 0): RequirementVisualInfo {
  const catSlug = req.categories?.slug?.toLowerCase() || '';
  const catName = req.categories?.name?.toLowerCase() || '';

  // 1. Resolve requirement-specific image (uploaded reference photo or exact commodity photo)
  const image = resolveRfqImage({
    id: req.id,
    title: req.title,
    attachment_url: req.attachment_url,
    imageUrl: (req as any).imageUrl,
    category: catName || catSlug,
    categories: req.categories,
  });

  // 2. Resolve clean title and quantity
  let cleanTitle = req.title;
  let quantityDisplay = `${req.quantity.toLocaleString()} ${req.quantity_unit || 'Pieces'}`;
  
  if (req.title.includes(' - ')) {
    const parts = req.title.split(' - ');
    cleanTitle = parts[0];
    if (parts[1] && (parts[1].toLowerCase().includes('piece') || parts[1].toLowerCase().includes('mt') || parts[1].toLowerCase().includes('kg') || parts[1].toLowerCase().includes('pcs'))) {
      quantityDisplay = parts[1];
    }
  }

  // 3. Location as the buyer gave it (never guessed from the title)
  const locationDisplay =
    (req as any).delivery_location ||
    [req.destination_city, req.destination_country].filter(Boolean).join(', ') ||
    'Location not given';

  // 4. Resolve subtitle / specifications
  let subtitle = req.specifications || (req as any).specs || req.description?.slice(0, 85) || req.categories?.name || 'Buyer requirement';
  if (subtitle.length > 85) {
    subtitle = subtitle.slice(0, 82) + '...';
  }

  // 5. Tag from real facts only: the deadline, when it was posted and where it goes.
  const DAY = 864e5;
  const now = Date.now();
  const deadlineMs = req.deadline ? new Date(`${req.deadline}`.length === 10 ? `${req.deadline}T23:59:59` : req.deadline).getTime() : NaN;
  const daysLeft = Number.isFinite(deadlineMs) ? (deadlineMs - now) / DAY : Infinity;
  const ageDays = req.created_at ? (now - new Date(req.created_at).getTime()) / DAY : Infinity;
  const country = (req.destination_country || '').trim().toLowerCase();
  const isExport = Boolean(country) && country !== 'india';
  let tag: RequirementVisualInfo['tag'];
  if (daysLeft >= 0 && daysLeft <= 3) {
    tag = { label: 'EXPIRING', type: 'expiring', bgClass: 'bg-[#B33D00]', textClass: 'text-white' };
  } else if (daysLeft >= 0 && daysLeft <= 7) {
    tag = { label: 'URGENT', type: 'urgent', bgClass: 'bg-[#C94400]', textClass: 'text-white' };
  } else if (ageDays <= 1) {
    tag = { label: 'LIVE', type: 'live', bgClass: 'bg-[#C94400]', textClass: 'text-white' };
  } else if (ageDays <= 3) {
    tag = { label: 'NEW', type: 'new', bgClass: 'bg-[#C94400]', textClass: 'text-white' };
  } else if (isExport) {
    tag = { label: 'EXPORT', type: 'export', bgClass: 'bg-[#1E1E1E]', textClass: 'text-[#FF7A2E]' };
  } else {
    tag = { label: 'OPEN', type: 'regular', bgClass: 'bg-[#1E1E1E]', textClass: 'text-[#FF7A2E]' };
  }

  // 6. Only say "verified" when the buyer is verified.
  const verifiedStatus = req.is_verified_buyer ? 'Verified Buyer' : '';

  let orderAttribute = 'Direct Sourcing';
  let attributeIcon: RequirementVisualInfo['attributeIcon'] = 'building';
  if (isExport) {
    orderAttribute = 'Export Requirement';
    attributeIcon = 'ship';
  } else if (Number.isFinite(deadlineMs) && daysLeft >= 0) {
    orderAttribute = `Needed by ${new Date(deadlineMs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    attributeIcon = 'truck';
  }

  return {
    image,
    locationDisplay,
    tag,
    verifiedStatus,
    orderAttribute,
    attributeIcon,
    subtitle,
    cleanTitle,
    quantityDisplay,
  };
}
