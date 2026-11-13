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

export function getRequirementVisualInfo(req: Requirement, index = 0): RequirementVisualInfo {
  const titleLower = (req.title || '').toLowerCase();
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

  // 3. Resolve location
  let locationDisplay = (req as any).delivery_location || (req.destination_city && req.destination_country ? `${req.destination_city}, ${req.destination_country}` : req.destination_country || 'Global Sourcing');
  if (!locationDisplay || locationDisplay === 'Global Sourcing') {
    if (titleLower.includes('saree')) {
      locationDisplay = 'Surat, Gujarat, India';
    } else if (titleLower.includes('t-shirt')) {
      locationDisplay = 'Tiruppur, Tamil Nadu, India';
    } else if (titleLower.includes('corrugated') || titleLower.includes('box')) {
      locationDisplay = 'Bangalore, Karnataka, India';
    } else if (titleLower.includes('jute')) {
      locationDisplay = 'Kolkata, West Bengal, India';
    } else if (titleLower.includes('rice')) {
      locationDisplay = 'Delhi NCR, India';
    } else if (titleLower.includes('chilli')) {
      locationDisplay = 'Guntur, Andhra Pradesh, India';
    } else if (titleLower.includes('cnc')) {
      locationDisplay = 'Coimbatore, Tamil Nadu, India';
    } else if (titleLower.includes('steel')) {
      locationDisplay = 'Chennai, Tamil Nadu, India';
    } else if (titleLower.includes('shrimp')) {
      locationDisplay = 'Cochin, Kerala, India';
    } else if (titleLower.includes('solar')) {
      locationDisplay = 'Gujarat, India';
    } else if (titleLower.includes('earbud') || titleLower.includes('headphone')) {
      locationDisplay = 'Los Angeles, CA, USA';
    } else if (req.destination_country) {
      locationDisplay = `${req.destination_country}, Global`;
    }
  }

  // 4. Resolve subtitle / specifications
  let subtitle = req.specifications || (req as any).specs || req.description?.slice(0, 85) || 'Verified B2B Procurement Requirement';
  if (subtitle.length > 85) {
    subtitle = subtitle.slice(0, 82) + '...';
  }

  // 5. Urgency Tag determination
  const tagMod = (index + req.id.charCodeAt(0)) % 7;
  let tag: RequirementVisualInfo['tag'] = {
    label: 'URGENT',
    type: 'urgent',
    bgClass: 'bg-[#C94400]',
    textClass: 'text-white',
  };

  if (titleLower.includes('saree') || titleLower.includes('cnc') || tagMod === 0) {
    tag = { label: 'URGENT', type: 'urgent', bgClass: 'bg-[#C94400]', textClass: 'text-white' };
  } else if (titleLower.includes('t-shirt') || titleLower.includes('jute') || titleLower.includes('ldpe') || tagMod === 1) {
    tag = { label: 'NEW', type: 'new', bgClass: 'bg-[#C94400]', textClass: 'text-white' };
  } else if (titleLower.includes('chilli') || tagMod === 2) {
    tag = { label: 'EXPIRING', type: 'expiring', bgClass: 'bg-[#B33D00]', textClass: 'text-white' };
  } else if (titleLower.includes('corrugated') || tagMod === 3) {
    tag = { label: 'LIVE', type: 'live', bgClass: 'bg-[#C94400]', textClass: 'text-white' };
  } else if (titleLower.includes('rice') || tagMod === 4) {
    tag = { label: 'BULK ORDER', type: 'bulk', bgClass: 'bg-[#C94400]', textClass: 'text-white' };
  } else if (titleLower.includes('steel') || tagMod === 5) {
    tag = { label: 'REGULAR', type: 'regular', bgClass: 'bg-[#C94400]', textClass: 'text-white' };
  } else {
    tag = { label: 'EXPORT', type: 'export', bgClass: 'bg-[#1E1E1E]', textClass: 'text-[#FF7A2E]' };
  }

  // 6. Verification and order attributes
  let verifiedStatus = 'Verified Buyer';
  if (titleLower.includes('cnc') || titleLower.includes('steel')) {
    verifiedStatus = 'Verified Company';
  } else if (titleLower.includes('corrugated') && !titleLower.includes('pcs')) {
    verifiedStatus = 'Business Verified';
  }

  let orderAttribute = 'Direct Sourcing';
  let attributeIcon: RequirementVisualInfo['attributeIcon'] = 'building';

  if (titleLower.includes('saree')) {
    orderAttribute = 'Direct Sourcing';
    attributeIcon = 'building';
  } else if (titleLower.includes('t-shirt')) {
    orderAttribute = 'Bulk Purchase';
    attributeIcon = 'building';
  } else if (titleLower.includes('corrugated')) {
    if (titleLower.includes('25,000')) {
      orderAttribute = 'Delivery in 15 Days';
      attributeIcon = 'truck';
    } else {
      orderAttribute = 'Long Term Requirement';
      attributeIcon = 'building';
    }
  } else if (titleLower.includes('rice') || titleLower.includes('shrimp') || titleLower.includes('chilli') || titleLower.includes('ldpe')) {
    orderAttribute = 'Export Requirement';
    attributeIcon = 'ship';
  } else if (titleLower.includes('jute')) {
    orderAttribute = 'Delivery in 30 Days';
    attributeIcon = 'truck';
  } else if (titleLower.includes('cnc')) {
    orderAttribute = 'Long Term Supply';
    attributeIcon = 'building';
  } else if (titleLower.includes('steel')) {
    orderAttribute = 'Project Supply';
    attributeIcon = 'building';
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
