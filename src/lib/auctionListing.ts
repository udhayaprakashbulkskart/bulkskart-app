/**
 * Auctions as they are stored, for the auction lists. Nothing here is simulated: no sample lots, no
 * rolling end times, no invented bid counts, seller names or stock photos. Where the seller left
 * something out the field is null and the card leaves it out.
 */
import { supabase } from '@/db/supabase';
import { formatMoney, productCurrency } from '@/lib/productPrice';

export type AuctionPhaseKey = 'scheduled' | 'live' | 'ended' | 'sold' | 'unsold' | 'review' | 'cancelled';

export interface AuctionListing {
  id: string;
  auctionNumber: string;
  auctionType: 'reverse' | 'forward';
  title: string;
  description: string;
  totalQuantity: number | null;
  moq: number | null;
  quantityUnit: string;
  /** per unit, in `currency` */
  startingPrice: number | null;
  reservePrice: number | null;
  currentHighestBid: number | null;
  minBidIncrement: number | null;
  totalBids: number;
  highestBidderName: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
  currency: string;
  deliveryLocation: string | null;
  /** the seller's own photo, or null */
  image: string | null;
  sellerId: string | null;
  sellerCompanyId: string | null;
  /** the seller's company name, when it could be read */
  sellerName: string | null;
  categoryId: string | null;
}

/**
 * Keys that an importer of lots from other websites wrote into `specifications`. An auction a BulkSkart seller
 * creates never has them. Such imported lots are not shown anywhere on BulkSkart.
 */
const IMPORTED_LOT_KEYS = ['external_listing', 'source_url', 'source_name', 'source_auction_id', 'seller_org', 'reference_no'] as const;

function specRecord(specifications: unknown): Record<string, unknown> | null {
  if (specifications && typeof specifications === 'object' && !Array.isArray(specifications)) return specifications as Record<string, unknown>;
  if (typeof specifications !== 'string' || !specifications.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(specifications) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * True for a lot copied from another website (for example a government e-marketplace) rather than listed by a seller
 * here. A lot with a BulkSkart seller is always the seller's own, whatever its text says.
 */
export function isImportedAuction(
  row: { specifications?: unknown; description?: unknown; seller_id?: unknown; seller_company_id?: unknown } | null | undefined,
): boolean {
  if (!row || row.seller_id || row.seller_company_id) return false;
  const specs = specRecord(row.specifications);
  if (specs && IMPORTED_LOT_KEYS.some((key) => specs[key] !== undefined && specs[key] !== null && specs[key] !== '')) return true;
  const specText = typeof row.specifications === 'string' ? row.specifications : specs ? JSON.stringify(specs) : '';
  const text = `${typeof row.description === 'string' ? row.description : ''} ${specText}`;
  // case-sensitive "GeM" (the portal's own spelling), so "gem stones" are not caught
  return /\bGeM\b/.test(text) || /gem\.gov\.in/i.test(text);
}

/** Leaves imported lots out in the query itself, so a page of results is never filled with them. */
export function withoutImportedAuctions<Q extends { is: (column: string, value: null) => Q }>(query: Q): Q {
  return query.is('specifications->>external_listing', null).is('specifications->>source_url', null);
}

/** Stock-photo hosts: a picture from these was put there by the old site, not uploaded by the seller. */
const STOCK_HOSTS = /(^|\.)(unsplash\.com|pixabay\.com|pexels\.com)$/i;

export function isStockPhoto(url: string): boolean {
  try {
    return STOCK_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** The first picture the seller uploaded. */
export function sellerPhoto(images: unknown): string | null {
  const list = Array.isArray(images) ? images : typeof images === 'string' ? [images] : [];
  for (const item of list) {
    const url = typeof item === 'string' ? item.trim() : '';
    if (!url) continue;
    if (/^https?:\/\//i.test(url) && !isStockPhoto(url)) return url;
    if (url.startsWith('/') || url.startsWith('data:image/')) return url;
  }
  return null;
}

function num(value: unknown): number | null {
  const n = Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(n) ? null : n;
}

function text(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  return s || null;
}

export function toAuctionListing(row: any, sellerName: string | null = null): AuctionListing {
  return {
    id: String(row.id),
    auctionNumber: text(row.auction_number) ?? `AUC-${String(row.id).replace(/-/g, '').slice(0, 6).toUpperCase()}`,
    auctionType: row.auction_type === 'forward' ? 'forward' : 'reverse',
    title: text(row.title) ?? 'Untitled lot',
    description: text(row.description) ?? '',
    totalQuantity: num(row.total_quantity),
    moq: num(row.moq),
    quantityUnit: text(row.quantity_unit) ?? 'units',
    startingPrice: num(row.starting_price),
    reservePrice: num(row.reserve_price),
    currentHighestBid: num(row.current_highest_bid),
    minBidIncrement: num(row.min_bid_increment),
    totalBids: num(row.total_bids) ?? 0,
    highestBidderName: text(row.highest_bidder_name),
    startTime: text(row.start_time),
    endTime: text(row.end_time),
    status: text(row.status) ?? 'live',
    currency: productCurrency(row.currency),
    deliveryLocation: text(row.delivery_location),
    image: sellerPhoto(row.images),
    sellerId: text(row.seller_id),
    sellerCompanyId: text(row.seller_company_id),
    sellerName,
    categoryId: text(row.category_id),
  };
}

/** Where an auction stands right now, from its status and its own start and end times. */
export function auctionPhase(
  auction: Pick<AuctionListing, 'status' | 'startTime' | 'endTime'>,
  now = Date.now(),
): { key: AuctionPhaseKey; label: string; ended: boolean } {
  const status = auction.status.toLowerCase();
  if (status === 'cancelled') return { key: 'cancelled', label: 'Cancelled', ended: true };
  if (status === 'awarded' || status === 'completed' || status === 'sold') return { key: 'sold', label: 'Sold', ended: true };
  if (status === 'no_winner' || status === 'unsold') return { key: 'unsold', label: 'Not sold', ended: true };
  if (status === 'under_review') return { key: 'review', label: 'Under review', ended: true };
  const start = auction.startTime ? new Date(auction.startTime).getTime() : null;
  const end = auction.endTime ? new Date(auction.endTime).getTime() : null;
  if (status === 'scheduled' || (start !== null && start > now)) return { key: 'scheduled', label: 'Starts soon', ended: false };
  if (end === null || end <= now) return { key: 'ended', label: 'Ended', ended: true };
  return { key: 'live', label: 'Live', ended: false };
}

/** Seconds until the auction ends (0 when it has ended or has no end time). */
export function secondsLeft(endTime: string | null, now = Date.now()): number {
  if (!endTime) return 0;
  const end = new Date(endTime).getTime();
  return Number.isFinite(end) ? Math.max(0, Math.floor((end - now) / 1000)) : 0;
}

export function auctionMoney(amount: number | null, currency: string): string | null {
  if (amount === null || amount <= 0) return null;
  return formatMoney({ amount, currency, approximate: false });
}

/** Company names for the given seller company ids (missing ones are simply absent). */
async function sellerNames(companyIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const ids = [...new Set(companyIds.filter(Boolean))];
  if (!ids.length) return names;
  const { data } = await supabase.from('companies').select('id, company_name').in('id', ids);
  for (const row of (data ?? []) as { id: string; company_name: string | null }[]) {
    if (row.company_name?.trim()) names.set(row.id, row.company_name.trim());
  }
  return names;
}

/** The newest auctions listed by BulkSkart sellers, with their company names. Imported lots are left out. */
export async function getAuctionListings(limit = 120): Promise<{ rows: AuctionListing[]; error: string | null }> {
  const { data, error } = await withoutImportedAuctions(supabase.from('auctions').select('*'))
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { rows: [], error: error.message };
  const raw = (Array.isArray(data) ? data : []).filter((row) => !isImportedAuction(row));
  const names = await sellerNames(raw.map((row) => row.seller_company_id)).catch(() => new Map<string, string>());
  return { rows: raw.map((row) => toAuctionListing(row, names.get(row.seller_company_id) ?? null)), error: null };
}
