/**
 * Products for the landing hero carousel.
 *
 * Real catalogue products with a photo come first. The kept sample catalogue (with its self-hosted, credited photos in
 * /public/verified-bulk-products) fills the ring so it is never empty. "Top Sellers" are the catalogue items marked
 * Best Seller, Popular or Trending; real products join that list once they carry one of those badges.
 */
import { getMarketplaceProducts } from '@/lib/api';
import { CURATED_INDUSTRIAL_PRODUCTS } from '@/data/curatedIndustrialProducts';
import { catalogProductPhoto, VERIFIED_BULK_CURATED_PHOTOS } from '@/data/verifiedBulkProductPhotos';
import type { Product } from '@/types/types';
import { isVerifiedProduct } from '@/lib/verifiedProduct';

export interface HeroProduct {
  id: string;
  name: string;
  supplier: string;
  country: string;
  verified: boolean;
  /** stored price range and its currency, formatted for the visitor when shown */
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  moq: string;
  img: string;
  to: string;
  badge: string;
  topSeller: boolean;
}

/** How many cards the ring holds. */
export const HERO_RING_SIZE = 16;

const TOP_SELLER_BADGES = new Set(['best_seller', 'popular', 'trending']);

export function fromCatalogue(): HeroProduct[] {
  return CURATED_INDUSTRIAL_PRODUCTS.flatMap((item) => {
    const img = VERIFIED_BULK_CURATED_PHOTOS[item.id];
    if (!img) return [];
    return [{
      id: item.id,
      name: item.name,
      supplier: item.supplierName,
      country: item.country,
      verified: item.isVerifiedSupplier,
      priceMin: item.inrMin || null,
      priceMax: item.inrMax || null,
      currency: 'INR',
      moq: item.moq.replace(/^MOQ:\s*/i, ''),
      img,
      to: `/products/${item.slug}`,
      badge: item.badgeLabel,
      topSeller: TOP_SELLER_BADGES.has(item.badgeType),
    }];
  });
}

export function fromProducts(products: Product[]): HeroProduct[] {
  return products.flatMap((p) => {
    const img = catalogProductPhoto(p.images);
    if (!img) return [];
    const company = p.companies;
    return [{
      id: p.id,
      name: p.name,
      supplier: company?.company_name || 'Verified supplier',
      country: company?.country || 'India',
      verified: company?.verification_status === 'verified' || isVerifiedProduct(p),
      priceMin: p.price_min ?? null,
      priceMax: p.price_max ?? null,
      currency: p.price_currency || 'INR',
      moq: p.moq ? `${p.moq} ${p.moq_unit || 'pcs'}` : '',
      img,
      to: p.slug ? `/products/${p.slug}` : `/products/${p.id}`,
      badge: '',
      topSeller: false,
    }];
  });
}

/** The hour we are in (changes on the hour, the same for every visitor). */
export const currentHour = (now = Date.now()) => Math.floor(now / 3600e3);

/** Milliseconds until the next hour starts. */
export const msToNextHour = (now = Date.now()) => 3600e3 - (now % 3600e3);

/**
 * `size` items from the list for this hour: the starting place moves on by `size` every hour and wraps round, so each
 * hour shows the next products and every product comes round in turn. Lists no longer than `size` are only rotated.
 */
export function hourlyWindow<T>(list: T[], size: number, hour: number): T[] {
  if (size <= 0 || list.length === 0) return [];
  const start = list.length <= size ? hour % list.length : (hour * size) % list.length;
  return Array.from({ length: Math.min(size, list.length) }, (_, i) => list[(start + i) % list.length]);
}

/** The two lists the hero can show: this hour's products, and the top sellers. */
export function heroLists(real: HeroProduct[], catalogue: HeroProduct[], hour = currentHour()) {
  const seen = new Set<string>();
  const unique = (list: HeroProduct[]) =>
    list.filter((item) => {
      const key = item.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const all = unique([...real, ...catalogue]);
  // Featured: a new set every hour. Real products first (rotating through all of them), then the catalogue fills any
  // empty places (also rotating), so the scroll changes hour by hour.
  const realList = all.filter((item) => !item.id.startsWith('curated-'));
  const catalogueList = [...all.filter((item) => item.id.startsWith('curated-') && !item.topSeller), ...all.filter((item) => item.id.startsWith('curated-') && item.topSeller)];
  const fromReal = hourlyWindow(realList, HERO_RING_SIZE, hour);
  const featured = [...fromReal, ...hourlyWindow(catalogueList, HERO_RING_SIZE - fromReal.length, hour)];
  const top = all.filter((item) => item.topSeller).slice(0, HERO_RING_SIZE);
  return { featured, top: top.length >= 6 ? top : featured };
}

/** Products for this hour's scroll, from a wide pool so the hours do not repeat soon. */
export async function loadHeroProducts(hour = currentHour()): Promise<ReturnType<typeof heroLists>> {
  const catalogue = fromCatalogue();
  try {
    const res = await getMarketplaceProducts({ page: 1, pageSize: 48, sortBy: 'popular' });
    return heroLists(fromProducts(res.products ?? []), catalogue, hour);
  } catch {
    return heroLists([], catalogue, hour);
  }
}
