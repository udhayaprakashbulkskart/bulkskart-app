import type { Product, Requirement, Quotation } from '@/types/types';

export type OpportunityPriority = 'high' | 'medium' | 'low';

export interface MatchedProduct {
  id: string;
  name: string;
  slug: string;
  categoryName?: string;
  price: number;
  priceCurrency: string;
  priceINR: number;
  moq: number;
  moqUnit: string;
  availableQuantity: number;
  estimatedDeliveryDays: number;
  matchScore: number;
  image?: string;
  unitCompatibility: boolean;
}

export interface MatchedOpportunity {
  id: string;
  requirement: Requirement;
  matchingProducts: MatchedProduct[];
  topMatchScore: number;
  priority: OpportunityPriority;
  estimatedBusinessValueINR: number;
  suggestedPricing: {
    min: number;
    max: number;
    recommended: number;
  };
  suggestedMOQ: number;
  suggestedDeliveryDays: number;
  reason: string;
  buyerLocation: string;
  buyerName: string;
  expectedPrice: string;
  timeline: string;
  createdAt: string;
}

export interface AIOpportunitySummary {
  totalOpportunities: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  averageMatchScore: number;
  potentialBusinessINR: number;
  potentialBusinessINRFormatted: string;
}

export interface SalesRecommendation {
  id: string;
  title: string;
  type: 'quote_waiting' | 'trending_product' | 'certification' | 'discount' | 'priority_buyer';
  message: string;
  urgency: 'high' | 'medium' | 'normal';
  ctaLabel: string;
  ctaLink: string;
  iconType: 'flame' | 'trending' | 'shield' | 'percent' | 'zap';
}

export interface AIQuotationDraft {
  requirementId: string;
  productId?: string;
  productName: string;
  unitPrice: number;
  currency: string;
  moq: number;
  moqUnit: string;
  quantity: number;
  deliveryDays: number;
  paymentTerms: string;
  deliveryTerms: string;
  notes: string;
  totalPrice: number;
}

export interface SuggestedChatReply {
  id: string;
  title: string;
  category: string;
  text: string;
  tag: string;
}

export type AIChatReply = SuggestedChatReply;

export interface AIMatchNotification {
  id: string;
  title: string;
  productName: string;
  buyerLocation: string;
  buyerName: string;
  requiredQuantity: string;
  quantity: string;
  expectedPrice: string;
  deliveryTimeline: string;
  matchPercentage: number;
  priority: OpportunityPriority;
  requirementId: string;
  ctaLink: string;
  createdAt: string;
  isRead?: boolean;
}
export function generateAIMatchNotifications(products: Product[] = [], requirements: Requirement[] = []): AIMatchNotification[] {
  if (!products.length || !requirements.length) return [];
  const opportunities = analyzeAndMatchOpportunities(products, requirements);
  return opportunities.slice(0, 5).map(opp => ({
    id: `notif-${opp.id}`,
    title: `New Requirement Match: ${opp.requirement.title}`,
    productName: opp.matchingProducts[0]?.name || opp.requirement.title,
    buyerLocation: opp.buyerLocation,
    buyerName: opp.buyerName,
    requiredQuantity: `${opp.requirement.quantity} ${opp.requirement.quantity_unit}`,
    quantity: `${opp.requirement.quantity} ${opp.requirement.quantity_unit}`,
    expectedPrice: opp.expectedPrice,
    deliveryTimeline: opp.timeline,
    matchPercentage: opp.topMatchScore,
    priority: opp.priority,
    requirementId: opp.requirement.id,
    ctaLink: `/requirements/${opp.requirement.id}`,
    createdAt: new Date().toISOString()
  }));
}

// Common generic words that should NOT be used for product identity matching
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'high', 'quality', 'wholesale', 'bulk',
  'factory', 'export', 'supply', 'pure', 'best', 'custom', 'industrial', 'standard',
  'grade', 'premium', 'cheap', 'direct', 'new', 'inr', 'usd', 'manufacturing',
  'manufacturer', 'supplier', 'company', 'ready', 'stock', 'top', 'pieces', 'pcs',
  'units', 'unit', 'piece', 'item', 'items', 'lot', 'lots', 'good', 'large', 'small',
  'genuine', 'original', 'sale', 'order', 'requirement', 'needed', 'wanted', 'urgent',
]);

/**
 * Normalizes text for meaningful keyword token matching
 */
export function tokenizeMeaningful(text: string = ''): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * Unit classification and normalization
 */
export interface UnitInfo {
  group: 'count' | 'weight' | 'length' | 'volume' | 'area' | 'packaging' | 'unknown';
  factor: number; // Factor relative to base unit of group (e.g. piece=1, dozen=12, kg=1, ton=1000)
  standard: string;
}

export function normalizeUnit(rawUnit: string = ''): UnitInfo {
  const u = rawUnit.toLowerCase().trim();

  // Count units
  if (['piece', 'pieces', 'pc', 'pcs', 'unit', 'units', 'item', 'items', 'nos', 'no'].includes(u)) {
    return { group: 'count', factor: 1, standard: 'Pieces' };
  }
  if (['dozen', 'dozens', 'dz'].includes(u)) {
    return { group: 'count', factor: 12, standard: 'Dozen' };
  }
  if (['set', 'sets', 'pair', 'pairs'].includes(u)) {
    return { group: 'count', factor: 1, standard: 'Sets' };
  }

  // Weight units
  if (['kg', 'kilogram', 'kilograms', 'kgs'].includes(u)) {
    return { group: 'weight', factor: 1, standard: 'Kg' };
  }
  if (['gram', 'grams', 'g', 'gms'].includes(u)) {
    return { group: 'weight', factor: 0.001, standard: 'Grams' };
  }
  if (['ton', 'tons', 'tonne', 'tonnes', 'mt', 'metric ton', 'metric tons'].includes(u)) {
    return { group: 'weight', factor: 1000, standard: 'Tons' };
  }

  // Length units
  if (['metre', 'metres', 'meter', 'meters', 'm'].includes(u)) {
    return { group: 'length', factor: 1, standard: 'Metres' };
  }
  if (['yard', 'yards', 'yd'].includes(u)) {
    return { group: 'length', factor: 0.9144, standard: 'Yards' };
  }
  if (['foot', 'feet', 'ft'].includes(u)) {
    return { group: 'length', factor: 0.3048, standard: 'Feet' };
  }

  // Volume units
  if (['litre', 'litres', 'liter', 'liters', 'l'].includes(u)) {
    return { group: 'volume', factor: 1, standard: 'Litres' };
  }
  if (['gallon', 'gallons', 'gal'].includes(u)) {
    return { group: 'volume', factor: 3.7854, standard: 'Gallons' };
  }

  // Packaging units
  if (['box', 'boxes', 'carton', 'cartons', 'pack', 'packs', 'roll', 'rolls', 'bag', 'bags'].includes(u)) {
    return { group: 'packaging', factor: 1, standard: 'Boxes' };
  }

  return { group: 'unknown', factor: 1, standard: rawUnit || 'Units' };
}

/**
 * Checks unit compatibility between requirement and product
 */
export function checkUnitCompatibility(reqUnitRaw: string, prodUnitRaw: string): { compatible: boolean; conversionFactor: number } {
  const r = normalizeUnit(reqUnitRaw);
  const p = normalizeUnit(prodUnitRaw);

  if (r.group === 'unknown' || p.group === 'unknown') {
    return { compatible: true, conversionFactor: 1 };
  }

  if (r.group === p.group) {
    const factor = r.factor / p.factor;
    return { compatible: true, conversionFactor: factor };
  }

  // If one is packaging (e.g. box) and the other is count (e.g. piece), allowed with factor 1
  if ((r.group === 'packaging' && p.group === 'count') || (r.group === 'count' && p.group === 'packaging')) {
    return { compatible: true, conversionFactor: 1 };
  }

  // Incompatible unit classes (e.g. length vs weight, count vs volume)
  return { compatible: false, conversionFactor: 0 };
}

/**
 * Calculates strict AI Match Score between a Manufacturer's Product and a Buyer Requirement.
 * Eliminates artificial base scores. Match must be genuinely earned.
 */
export function calculateProductMatchScore(
  product: Product,
  requirement: Requirement
): number {
  if (!product || !requirement) return 0;

  // 1. Category comparison
  const pCatName = (product.categories?.name || '').toLowerCase().trim();
  const rCatName = ((requirement as any).categories?.name || '').toLowerCase().trim();
  const rCatId = (requirement.category_id || '').toLowerCase().trim();
  const pCatId = (product.category_id || '').toLowerCase().trim();

  const sameCategoryId = pCatId && rCatId && pCatId === rCatId;
  const sameCategoryName = pCatName && rCatName && (pCatName === rCatName || pCatName.includes(rCatName) || rCatName.includes(pCatName));

  const pTokens = tokenizeMeaningful(`${product.name} ${product.description || ''}`);
  const rTokens = tokenizeMeaningful(`${requirement.title} ${requirement.description || ''}`);

  const pTitleTokens = tokenizeMeaningful(product.name);
  const rTitleTokens = tokenizeMeaningful(requirement.title);

  // Check title keyword overlap (highest significance)
  let titleOverlapCount = 0;
  rTitleTokens.forEach(token => {
    if (pTitleTokens.has(token)) titleOverlapCount++;
  });

  // Check overall text token overlap
  let totalOverlapCount = 0;
  rTokens.forEach(token => {
    if (pTokens.has(token)) totalOverlapCount++;
  });

  // Strict cross-category guard:
  // If categories are completely different and there are NO title tokens matching, this is an unrelated product.
  // For example: "TWS Earbuds" vs "Incense Sticks" or "Copper Bottle" -> 0 overlap -> score 0!
  if (!sameCategoryId && !sameCategoryName && titleOverlapCount === 0) {
    // Check if category name matches requirement title (e.g. "Electronics" and requirement says "Electronics")
    const pCatInReq = pCatName && requirement.title.toLowerCase().includes(pCatName);
    if (!pCatInReq && totalOverlapCount < 2) {
      return 0; // Completely unrelated!
    }
  }

  // 2. Unit Compatibility Check
  const reqUnit = requirement.quantity_unit || 'Units';
  const prodUnit = product.moq_unit || 'Units';
  const unitCheck = checkUnitCompatibility(reqUnit, prodUnit);

  if (!unitCheck.compatible && titleOverlapCount === 0) {
    // Completely incompatible units and no title match -> zero score
    return 0;
  }

  // Calculate composite score
  let score = 0;

  // A. Category matching (0 - 30 points)
  if (sameCategoryId || sameCategoryName) {
    score += 30;
  } else if (pCatName && requirement.title.toLowerCase().includes(pCatName)) {
    score += 20;
  }

  // B. Product Title Overlap (0 - 40 points)
  if (titleOverlapCount >= 3) {
    score += 40;
  } else if (titleOverlapCount === 2) {
    score += 32;
  } else if (titleOverlapCount === 1) {
    score += 22;
  }

  // C. Specifications / Description Overlap (0 - 15 points)
  const remainingOverlap = Math.max(0, totalOverlapCount - titleOverlapCount);
  if (remainingOverlap >= 3) {
    score += 15;
  } else if (remainingOverlap >= 1) {
    score += 8;
  }

  // D. Unit compatibility (0 - 10 points)
  if (unitCheck.compatible) {
    score += 10;
  } else {
    score -= 25; // Severe penalty for unit mismatch
  }

  // E. Quantity vs MOQ feasibility (-10 to +10 points)
  const reqQty = Number(requirement.quantity) || 1000;
  const prodMoq = Number(product.moq) || 100;
  if (reqQty >= prodMoq) {
    score += 10;
  } else if (reqQty >= prodMoq * 0.7) {
    score += 4;
  } else if (reqQty < prodMoq * 0.2) {
    score -= 10;
  }

  // F. Target price alignment (0 - 5 points)
  const reqTargetPrice = (requirement as any).target_price || requirement.budget_max;
  if (reqTargetPrice && product.price_min) {
    const target = Number(reqTargetPrice);
    const minP = Number(product.price_min);
    if (target >= minP * 0.7 && target <= minP * 2.0) {
      score += 5;
    }
  }

  // Clamp strictly: if score < 50, it does not qualify as an opportunity
  if (score < 50) return 0;
  return Math.min(98, score);
}

/**
 * Determines priority based on genuine score
 */
export function getOpportunityPriority(score: number): OpportunityPriority {
  if (score >= 85) return 'high';
  if (score >= 70) return 'medium';
  return 'low';
}

/**
 * Formats Indian Currency in Lakhs or Crores accurately
 */
export function formatPotentialBusinessINR(amount: number): string {
  if (!amount || amount <= 0) return '₹0';
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(0)}K`;
  }
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Matches all manufacturer products against active requirements and ranks opportunities.
 * Returns only genuine matches (no fake catalog injection, no cross-category mismatches).
 */
export function analyzeAndMatchOpportunities(
  products: Product[],
  requirements: Requirement[],
  inrRate: number = 83.5
): MatchedOpportunity[] {
  // STRICT RULE: If supplier has no products, return empty opportunities immediately
  if (!products || products.length === 0) {
    return [];
  }

  if (!requirements || requirements.length === 0) {
    return [];
  }

  const opportunities: MatchedOpportunity[] = [];

  requirements.forEach(req => {
    // Score requirement against each product in the supplier's real catalogue
    const scoredProducts: MatchedProduct[] = [];

    products.forEach(p => {
      const score = calculateProductMatchScore(p, req);
      // ONLY include products that scored >= 50%
      if (score >= 50) {
        const isUsd = !p.price_currency || p.price_currency.toUpperCase() === 'USD' || (p.price_min || 0) < 1000;
        const priceINR = isUsd ? (p.price_min || 50) * inrRate : (p.price_min || 250);
        const unitComp = checkUnitCompatibility(req.quantity_unit || 'Units', p.moq_unit || 'Units');

        scoredProducts.push({
          id: p.id,
          name: p.name,
          slug: p.slug,
          categoryName: p.categories?.name || 'General Wholesale',
          price: p.price_min || 250,
          priceCurrency: p.price_currency || 'INR',
          priceINR: Math.round(priceINR),
          moq: p.moq || 100,
          moqUnit: p.moq_unit || 'Units',
          availableQuantity: (p.moq || 100) * 10,
          estimatedDeliveryDays: 12,
          matchScore: score,
          image: p.images?.[0],
          unitCompatibility: unitComp.compatible,
        });
      }
    });

    // If no product in supplier catalogue matches this requirement, do NOT include it!
    if (scoredProducts.length === 0) {
      return;
    }

    // Sort matching products by score descending
    scoredProducts.sort((a, b) => b.matchScore - a.matchScore);
    const topMatch = scoredProducts[0];
    const topScore = topMatch.matchScore;
    const priority = getOpportunityPriority(topScore);

    // Business value estimation: quantity × unit price
    const qty = Number(req.quantity) || 1;
    const unitPriceINR = topMatch.priceINR;
    const estimatedBusinessValueINR = Math.round(qty * unitPriceINR);

    // Location & timeline resolution
    const buyerLocation = (req as any).destination_city || req.destination_country || 'India';
    const buyerName = (req as any).buyer_company_name || (req as any).buyer_name || 'Verified Buyer';
    const targetPriceVal = (req as any).target_price || req.budget_max;
    const expectedPrice = targetPriceVal
      ? `₹${Math.round(Number(targetPriceVal)).toLocaleString('en-IN')}`
      : `₹${unitPriceINR.toLocaleString('en-IN')} (Target Open)`;
    const timeline = (req as any).delivery_timeline || (req.deadline ? `By ${new Date(req.deadline).toLocaleDateString()}` : '15-20 Days Delivery');

    opportunities.push({
      id: `opp-${req.id}`,
      requirement: req,
      matchingProducts: scoredProducts.slice(0, 4),
      topMatchScore: topScore,
      priority,
      estimatedBusinessValueINR,
      suggestedPricing: {
        min: Math.round(unitPriceINR * 0.92),
        max: Math.round(unitPriceINR * 1.08),
        recommended: unitPriceINR,
      },
      suggestedMOQ: Math.min(topMatch.moq || 100, Math.max(10, Math.round(qty * 0.4))),
      suggestedDeliveryDays: 15,
      reason: topScore >= 85
        ? 'High specifications synergy: your factory catalogue matches buyer required volume and specs.'
        : 'Good category & specs alignment: your production capabilities meet requested requirements.',
      buyerLocation,
      buyerName,
      expectedPrice,
      timeline,
      createdAt: req.created_at || new Date().toISOString(),
    });
  });

  // Sort opportunities: High priority first, then highest match score
  opportunities.sort((a, b) => {
    const pOrder: Record<OpportunityPriority, number> = { high: 3, medium: 2, low: 1 };
    if (pOrder[b.priority] !== pOrder[a.priority]) {
      return pOrder[b.priority] - pOrder[a.priority];
    }
    return b.topMatchScore - a.topMatchScore;
  });

  return opportunities;
}

/**
 * Calculates summary metrics for AI Opportunity Card strictly from REAL opportunities
 */
export function generateAIOpportunitySummary(
  opportunities: MatchedOpportunity[]
): AIOpportunitySummary {
  if (!opportunities || opportunities.length === 0) {
    return {
      totalOpportunities: 0,
      highPriorityCount: 0,
      mediumPriorityCount: 0,
      lowPriorityCount: 0,
      averageMatchScore: 0,
      potentialBusinessINR: 0,
      potentialBusinessINRFormatted: '₹0',
    };
  }

  const total = opportunities.length;
  const high = opportunities.filter(o => o.priority === 'high').length;
  const med = opportunities.filter(o => o.priority === 'medium').length;
  const low = opportunities.filter(o => o.priority === 'low').length;

  const avgScore = Math.round(
    opportunities.reduce((acc, o) => acc + o.topMatchScore, 0) / total
  );

  const totalValue = opportunities.reduce((acc, o) => acc + o.estimatedBusinessValueINR, 0);

  return {
    totalOpportunities: total,
    highPriorityCount: high,
    mediumPriorityCount: med,
    lowPriorityCount: low,
    averageMatchScore: avgScore,
    potentialBusinessINR: totalValue,
    potentialBusinessINRFormatted: formatPotentialBusinessINR(totalValue),
  };
}

/**
 * Auto-generates AI Quotation Draft from Product and Requirement
 */
export function generateAIQuotationDraft(
  requirement: Requirement,
  product?: MatchedProduct | Product | null,
  inrRate: number = 83.5
): AIQuotationDraft {
  const reqQty = Number(requirement.quantity) || 1000;
  const unit = requirement.quantity_unit || (product as any)?.moq_unit || (product as any)?.moqUnit || 'Pieces';

  let unitPrice = 250;
  if (product && 'priceINR' in product && typeof product.priceINR === 'number') {
    unitPrice = product.priceINR;
  } else if (product && 'price_min' in product && product.price_min) {
    const isUsd = !product.price_currency || product.price_currency.toUpperCase() === 'USD' || product.price_min < 1000;
    unitPrice = Math.round(isUsd ? product.price_min * inrRate : product.price_min);
  } else if ((requirement as any).target_price || requirement.budget_max) {
    unitPrice = Math.round(Number((requirement as any).target_price || requirement.budget_max));
  }

  const moq = (product as any)?.moq || Math.min(500, Math.round(reqQty * 0.4));
  const deliveryDays = 15;
  const totalPrice = unitPrice * reqQty;

  const notes = `Direct factory quotation for ${requirement.title}. Strict quality inspection, standard industrial packaging included. Custom branding and export documentation supported.`;

  return {
    requirementId: requirement.id,
    productId: product?.id,
    productName: product?.name || requirement.title,
    unitPrice,
    currency: 'INR',
    moq,
    moqUnit: unit,
    quantity: reqQty,
    deliveryDays,
    paymentTerms: '30% Advance, 70% against BL/Dispatch (Escrow Supported)',
    deliveryTerms: `FOB ${(requirement as any).destination_city || requirement.destination_country || 'Origin Port'} / Door Delivery Available`,
    notes,
    totalPrice,
  };
}

/**
 * Generates Daily & Weekly Sales Insights for the Manufacturer
 */
export function generateAISalesInsights(
  products: Product[],
  requirements: Requirement[],
  quotations: Quotation[],
  opportunities: MatchedOpportunity[]
): SalesRecommendation[] {
  const highPriority = opportunities.filter(o => o.priority === 'high');

  const recommendations: SalesRecommendation[] = [];

  if (highPriority.length > 0) {
    recommendations.push({
      id: 'rec-1',
      title: 'High-Priority Quotation Queue',
      type: 'quote_waiting',
      message: `You have ${highPriority.length} high-priority requirement${highPriority.length > 1 ? 's' : ''} waiting for quotation with >85% match score.`,
      urgency: 'high',
      ctaLabel: 'Review & Send Quotes',
      ctaLink: '/dashboard/supplier/ai-assistant',
      iconType: 'flame',
    });
  }

  if (products.length > 0) {
    recommendations.push({
      id: 'rec-2',
      title: 'Promote Featured Catalogue Items',
      type: 'trending_product',
      message: 'Promoted products appear at the top of buyer searches and attract up to 3x more direct RFQs.',
      urgency: 'medium',
      ctaLabel: 'Promote Product',
      ctaLink: '/dashboard/supplier/products',
      iconType: 'trending',
    });
  }

  recommendations.push({
    id: 'rec-3',
    title: 'Verification & Trust Badge',
    type: 'certification',
    message: 'Uploading GST and business registration documents increases buyer quote conversion rates.',
    urgency: 'normal',
    ctaLabel: 'Verify Business Profile',
    ctaLink: '/dashboard/supplier/verification',
    iconType: 'shield',
  });

  return recommendations;
}

/**
 * Generates context-aware suggested buyer-chat replies
 */
export function generateAIChatReplies(
  requirementTitle?: string,
  productName?: string,
  price?: number,
  quantity?: number,
  unit: string = 'Pieces'
): SuggestedChatReply[] {
  const pName = productName || requirementTitle || 'our product';
  const pPrice = price ? `₹${price.toLocaleString('en-IN')}` : 'competitive wholesale rate';
  const pQty = quantity ? `${quantity.toLocaleString()} ${unit}` : 'your requested volume';

  return [
    {
      id: 'reply-1',
      title: 'Formal Specification & Availability',
      category: 'Inquiry',
      text: `Hello! Thank you for your inquiry regarding ${pName}. We have ready manufacturing capacity for ${pQty} at ${pPrice} per unit. Would you like us to share our technical datasheet and lab test reports?`,
      tag: 'Catalog & Specs',
    },
    {
      id: 'reply-2',
      title: 'Sample Request Terms',
      category: 'Sample',
      text: `We can dispatch evaluation samples for ${pName} within 2-3 business days. Please share your complete shipping address and preferred courier account so we can arrange the dispatch.`,
      tag: 'Sample Dispatch',
    },
    {
      id: 'reply-3',
      title: 'Bulk Pricing & Payment Terms',
      category: 'Pricing',
      text: `For ${pQty}, our best offer is ${pPrice}/${unit}. We accept payment via BulkSkart Escrow / LC / 30% Advance. We can deliver within 15-20 days. Please let us know if you would like to proceed with a formal Proforma Invoice.`,
      tag: 'Price Negotiation',
    },
  ];
}

/** A catalogue price in rupees: rupee prices as saved, US-dollar prices converted, 0 when unknown (never guessed). */
export function catalogueInr(amount: number | null | undefined, currency: string | null | undefined, inrRate = 83.5): number {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const code = (currency ?? '').trim().toUpperCase();
  if (code === 'INR' || code === '') return Math.round(value);
  if (code === 'USD') return Math.round(value * inrRate);
  return 0;
}
