/**
 * Smart match: a score from 0 to 100 for how well a verified supplier fits what the buyer asked for, with the
 * reasons. It is rule based (no hidden model): each criterion that can be measured gets points, criteria that cannot
 * be measured are left out, and the total is scaled to 100. Nothing here invents availability or demand: a criterion
 * with no data from the supplier scores nothing and says so.
 */
import type { MapSupplier, StockStatus } from './types';

export interface MatchInput {
  query?: string;
  /** buyer's order quantity: suppliers whose MOQ is well under it fit best */
  orderQty?: number | null;
  minCapacity?: number | null;
  radiusKm?: number | null;
  now?: number;
}

export interface MatchPart {
  key: 'product' | 'distance' | 'moq' | 'capacity' | 'availability' | 'fresh' | 'checks' | 'rating';
  label: string;
  points: number;
  max: number;
  reason: string;
}

export interface MatchResult {
  score: number;
  parts: MatchPart[];
}

const WEIGHTS = { product: 30, distance: 20, moq: 10, capacity: 10, availability: 10, fresh: 5, checks: 10, rating: 5 } as const;

const STOCK_POINTS: Record<StockStatus, number> = { in_stock: 1, limited: 0.6, made_to_order: 0.5, out_of_stock: 0 };
export const STOCK_LABEL: Record<StockStatus, string> = {
  in_stock: 'In stock',
  limited: 'Limited stock',
  made_to_order: 'Made to order',
  out_of_stock: 'Out of stock',
};

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);

function productPart(s: MapSupplier, query: string): MatchPart {
  const max = WEIGHTS.product;
  const q = query.trim().toLowerCase();
  const names = s.matched_products.map((p) => p.name.toLowerCase());
  if (names.some((n) => n.includes(q))) {
    return { key: 'product', label: 'Product', points: max, max, reason: `Lists "${s.matched_products.find((p) => p.name.toLowerCase().includes(q))?.name}"` };
  }
  if (s.matched_products.length > 0) {
    // matched on category or tags, or on some of the words
    const qw = words(q);
    const best = Math.max(0, ...names.map((n) => { const nw = new Set(words(n)); return qw.filter((w) => nw.has(w)).length / Math.max(qw.length, 1); }));
    const pts = Math.round(max * Math.max(0.6, best));
    return { key: 'product', label: 'Product', points: pts, max, reason: `${s.matched_products.length} related product${s.matched_products.length > 1 ? 's' : ''} (by category or tag)` };
  }
  return { key: 'product', label: 'Product', points: Math.round(max * 0.4), max, reason: 'Mentions it in the business profile; no matching listing yet' };
}

export function matchSupplier(s: MapSupplier, input: MatchInput): MatchResult {
  const now = input.now ?? Date.now();
  const parts: MatchPart[] = [];

  if (input.query?.trim()) parts.push(productPart(s, input.query));

  if (s.distance_km != null) {
    const max = WEIGHTS.distance;
    // full points within 10 km, falling to a quarter at the edge of the search (or 500 km for all India)
    const edge = Math.max(input.radiusKm ?? 500, 20);
    const f = s.distance_km <= 10 ? 1 : Math.max(0.25, 1 - ((s.distance_km - 10) / (edge - 10)) * 0.75);
    const approx = s.location_precision === 'city';
    parts.push({ key: 'distance', label: 'Distance', points: Math.round(max * f), max, reason: `${approx ? 'About ' : ''}${formatKm(s.distance_km)} from you${approx ? ' (city centre)' : ''}` });
  }

  if (input.orderQty && input.orderQty > 0) {
    const max = WEIGHTS.moq;
    if (s.min_moq == null) parts.push({ key: 'moq', label: 'MOQ', points: 0, max, reason: 'No MOQ listed' });
    else {
      const ratio = s.min_moq / input.orderQty;
      const f = ratio <= 0.5 ? 1 : ratio <= 1 ? 0.7 : 0;
      const unit = s.moq_unit ? ` ${s.moq_unit}` : '';
      parts.push({ key: 'moq', label: 'MOQ', points: Math.round(max * f), max, reason: ratio <= 1 ? `MOQ ${fmt(s.min_moq)}${unit}, within your ${fmt(input.orderQty)}` : `MOQ ${fmt(s.min_moq)}${unit} is above your ${fmt(input.orderQty)}` });
    }
  }

  if (input.minCapacity && input.minCapacity > 0) {
    const max = WEIGHTS.capacity;
    if (s.monthly_capacity == null) parts.push({ key: 'capacity', label: 'Capacity', points: 0, max, reason: 'Monthly capacity not listed' });
    else {
      const f = s.monthly_capacity >= input.minCapacity * 2 ? 1 : s.monthly_capacity >= input.minCapacity ? 0.8 : 0;
      parts.push({ key: 'capacity', label: 'Capacity', points: Math.round(max * f), max, reason: `${fmt(s.monthly_capacity)} ${s.capacity_unit ?? 'units'} a month` });
    }
  }

  {
    const max = WEIGHTS.availability;
    if (s.stock_status) parts.push({ key: 'availability', label: 'Availability', points: Math.round(max * STOCK_POINTS[s.stock_status]), max, reason: STOCK_LABEL[s.stock_status] });
    else parts.push({ key: 'availability', label: 'Availability', points: 0, max, reason: 'Not updated by the supplier' });
  }

  if (s.availability_updated_at) {
    const max = WEIGHTS.fresh;
    const days = (now - new Date(s.availability_updated_at).getTime()) / 86_400_000;
    const f = days <= 7 ? 1 : days <= 30 ? 0.6 : 0.2;
    parts.push({ key: 'fresh', label: 'Up to date', points: Math.round(max * f), max, reason: `Availability updated ${timeAgo(s.availability_updated_at, now)}` });
  }

  {
    const max = WEIGHTS.checks;
    const checked = [s.cin_verified && 'CIN/LLPIN', s.gst_verified && 'GSTIN', s.udyam_verified && 'Udyam', s.registry_verified && 'Company registry'].filter(Boolean) as string[];
    if (s.verified === false) {
      parts.push({ key: 'checks', label: 'Verification', points: 0, max, reason: 'Not verified by BulkSkart yet' });
    } else {
      const f = checked.length >= 2 ? 1 : checked.length === 1 ? 0.7 : 0.5;
      parts.push({ key: 'checks', label: 'Verification', points: Math.round(max * f), max, reason: checked.length ? `${checked.join(' + ')} checked by BulkSkart` : 'Verified by BulkSkart' });
    }
  }

  if ((s.review_count ?? 0) > 0 && s.rating != null) {
    const max = WEIGHTS.rating;
    parts.push({ key: 'rating', label: 'Rating', points: Math.round(max * Math.min(Number(s.rating) / 5, 1)), max, reason: `${Number(s.rating).toFixed(1)}★ from ${s.review_count} review${s.review_count === 1 ? '' : 's'}` });
  }

  const got = parts.reduce((a, p) => a + p.points, 0);
  const max = parts.reduce((a, p) => a + p.max, 0);
  return { score: max ? Math.round((got / max) * 100) : 0, parts };
}

const fmt = (n: number) => Number(n).toLocaleString('en-IN');

export function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString('en-IN')} km`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86_400);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
