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
      verified: company?.verification_status === 'verified',
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

/** The two lists the hero can show: every product, and the top sellers. */
export function heroLists(real: HeroProduct[], catalogue: HeroProduct[]) {
  const seen = new Set<string>();
  const unique = (list: HeroProduct[]) =>
    list.filter((item) => {
      const key = item.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const all = unique([...real, ...catalogue]);
  // Featured: real products first, then the catalogue spread across categories (every other item keeps neighbours varied)
  const featured = [...all.filter((item) => !item.id.startsWith('curated-')), ...all.filter((item) => item.id.startsWith('curated-') && !item.topSeller), ...all.filter((item) => item.id.startsWith('curated-') && item.topSeller)].slice(0, HERO_RING_SIZE);
  const top = all.filter((item) => item.topSeller).slice(0, HERO_RING_SIZE);
  return { featured, top: top.length >= 6 ? top : featured };
}

export async function loadHeroProducts(): Promise<ReturnType<typeof heroLists>> {
  const catalogue = fromCatalogue();
  try {
    const res = await getMarketplaceProducts({ page: 1, pageSize: 40, sortBy: 'popular' });
    return heroLists(fromProducts(res.products ?? []), catalogue);
  } catch {
    return heroLists([], catalogue);
  }
}
