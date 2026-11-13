/**
 * Pixabay API Integration for BulkSkart B2B Marketplace
 * Backend proxy via Supabase Edge Function 'pixabay-product-image'
 * PIXABAY_API_KEY is securely stored in backend environment variables.
 * Never exposed or hardcoded in frontend code.
 */
import { supabase } from '@/db/supabase';
import {
  buildQueriesForProduct,
  checkHitRelevance,
  selectBestRelevantHit,
  PRODUCT_NOUNS_CATALOG,
  NounDefinition,
} from '@/lib/productImageRelevance';

export interface PixabayImageHit {
  id: number;
  pageURL?: string;
  type?: string;
  tags?: string;
  previewURL: string;
  webformatURL: string;
  largeImageURL?: string;
  user?: string;
}

export interface PixabaySearchResponse {
  total: number;
  hits: PixabayImageHit[];
}

export interface PixabayProductResolutionResult {
  has_image: boolean;
  source: 'seller' | 'storage' | 'pixabay_stored' | 'placeholder';
  url?: string | null;
  pixabay_asset_id?: string | null;
  matched_tag?: string | null;
  query?: string;
  is_representative?: boolean;
  reason?: string;
}

export type PixabayCategory =
  | 'backgrounds'
  | 'fashion'
  | 'nature'
  | 'science'
  | 'education'
  | 'feelings'
  | 'health'
  | 'people'
  | 'religion'
  | 'places'
  | 'animals'
  | 'industry'
  | 'computer'
  | 'food'
  | 'sports'
  | 'transportation'
  | 'travel'
  | 'buildings'
  | 'business'
  | 'music'
  | 'all';

export interface PixabaySearchParams {
  q?: string;
  lang?: string;
  category?: PixabayCategory;
  image_type?: 'all' | 'photo' | 'illustration' | 'vector';
  orientation?: 'all' | 'horizontal' | 'vertical';
  safesearch?: boolean;
  order?: 'popular' | 'latest';
  page?: number;
  per_page?: number;
}

export function mapToPixabayCategory(categoryName?: string | null): PixabayCategory {
  if (!categoryName) return 'industry';
  const c = categoryName.toLowerCase();
  if (c.includes('electronic') || c.includes('computer') || c.includes('tech') || c.includes('software')) return 'computer';
  if (c.includes('apparel') || c.includes('textile') || c.includes('fabric') || c.includes('clothing') || c.includes('fashion') || c.includes('garment')) return 'fashion';
  if (c.includes('food') || c.includes('agri') || c.includes('grain') || c.includes('spice') || c.includes('coffee') || c.includes('tea')) return 'food';
  if (c.includes('vehicle') || c.includes('auto') || c.includes('freight') || c.includes('logistics') || c.includes('ship') || c.includes('truck')) return 'transportation';
  if (c.includes('construct') || c.includes('building') || c.includes('cement') || c.includes('steel') || c.includes('tile')) return 'buildings';
  if (c.includes('pharma') || c.includes('health') || c.includes('medical') || c.includes('surgical')) return 'health';
  if (c.includes('chemical') || c.includes('solar') || c.includes('science') || c.includes('polymer')) return 'science';
  if (c.includes('trade') || c.includes('market') || c.includes('business') || c.includes('corporate')) return 'business';
  return 'industry';
}

const RAW_CACHED_PIXABAY_IMAGES: Record<string, { url: string; alt: string; photographer?: string }> = {
  machinery: {
    url: 'https://cdn.pixabay.com/photo/2017/04/02/09/08/bulldozer-2195329_1280.jpg',
    alt: 'Heavy industrial machinery and plant equipment',
    photographer: 'Pixabay'
  },
  electrical: {
    url: 'https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg',
    alt: 'Industrial copper cables and electrical wiring',
    photographer: 'Pixabay'
  },
  electronics: {
    url: 'https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg',
    alt: 'Printed circuit board and semiconductor components',
    photographer: 'Pixabay'
  },
  textiles: {
    url: 'https://cdn.pixabay.com/photo/2016/11/19/18/06/feet-1840619_1280.jpg',
    alt: 'Spun yarn bobbins and woven textile fabrics',
    photographer: 'Pixabay'
  },
  packaging: {
    url: 'https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg',
    alt: 'Warehouse storage corrugated boxes and shipping cartons',
    photographer: 'Pixabay'
  },
  agriculture: {
    url: 'https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg',
    alt: 'Golden wheat grain harvest field',
    photographer: 'Pixabay'
  },
  chemicals: {
    url: 'https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg',
    alt: 'Chemical laboratory glass test tubes and research flask',
    photographer: 'Pixabay'
  },
  metals: {
    url: 'https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg',
    alt: 'Industrial metal fabrication, welding, and steel processing',
    photographer: 'Pixabay'
  },
  construction: {
    url: 'https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg',
    alt: 'Construction building site cranes and engineering structure',
    photographer: 'Pixabay'
  },
  automotive: {
    url: 'https://cdn.pixabay.com/photo/2017/03/27/14/56/auto-2179220_1280.jpg',
    alt: 'Automotive vehicle engine spare parts and components',
    photographer: 'Pixabay'
  },
  solar: {
    url: 'https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg',
    alt: 'Photovoltaic solar panels and renewable energy equipment',
    photographer: 'Pixabay'
  },
  default: {
    url: 'https://cdn.pixabay.com/photo/2017/04/02/09/08/bulldozer-2195329_1280.jpg',
    alt: 'BulkSkart B2B wholesale marketplace trade commodities',
    photographer: 'Pixabay'
  }
};

const DEFAULT_PIXABAY_IMAGE = {
  url: 'https://cdn.pixabay.com/photo/2017/04/02/09/08/bulldozer-2195329_1280.jpg',
  alt: 'BulkSkart B2B wholesale marketplace trade commodities',
  photographer: 'Pixabay'
};

// Safe Proxy wrapper: ensures accessing ANY key (e.g. solar, plastics, unknown) never returns undefined
export const PRE_CACHED_PIXABAY_IMAGES: Record<string, { url: string; alt: string; photographer?: string }> = typeof Proxy !== 'undefined'
  ? new Proxy(RAW_CACHED_PIXABAY_IMAGES, {
      get(target, prop) {
        if (typeof prop === 'string' && prop in target) {
          return target[prop];
        }
        return DEFAULT_PIXABAY_IMAGE;
      }
    })
  : RAW_CACHED_PIXABAY_IMAGES;

export async function searchPixabay(
  params: PixabaySearchParams | string,
  category?: PixabayCategory
): Promise<PixabaySearchResponse> {
  const query = typeof params === 'string' ? params : params.q || '';
  const cat = typeof params === 'object' && params.category ? params.category : category;

  try {
    const { data, error } = await supabase.functions.invoke('pixabay-product-image', {
      body: {
        action: 'search_pixabay',
        query,
        category: cat,
      },
    });

    if (error || !data || data.code !== 'SUCCESS') {
      return { total: 0, hits: [] };
    }

    return {
      total: data.data?.hits?.length || 0,
      hits: data.data?.hits || [],
    };
  } catch (err) {
    console.warn('searchPixabay error:', err);
    return { total: 0, hits: [] };
  }
}

export async function syncAllPostsAndCompanies(): Promise<{
  total_photos_added: number;
  products_synced: number;
  requirements_synced: number;
  companies_synced: number;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('pixabay-product-image', {
      body: { action: 'sync_all' },
    });
    if (error || !data || data.code !== 'SUCCESS') {
      return { total_photos_added: 0, products_synced: 0, requirements_synced: 0, companies_synced: 0 };
    }
    return data.data;
  } catch (err) {
    console.warn('syncAllPostsAndCompanies error:', err);
    return { total_photos_added: 0, products_synced: 0, requirements_synced: 0, companies_synced: 0 };
  }
}

export async function fetchLatestImageSyncLogs(limit = 10): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('image_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data;
  } catch (err) {
    console.warn('fetchLatestImageSyncLogs error:', err);
    return [];
  }
}

// In-memory resolution cache to avoid redundant network calls per session
const resolvedProductCache = new Map<string, PixabayProductResolutionResult>();

// After a failed backend call, skip further calls for this long.
const PIXABAY_BREAKER_MS = 10 * 60 * 1000;
let pixabayBackendDownUntil = 0;

/**
 * Resolve single product image via Edge Function with strict tag relevance
 */
export async function resolveProductImageBackend(
  productId: string,
  productName: string,
  categoryName?: string,
  excludeUrls: string[] = []
): Promise<PixabayProductResolutionResult> {
  const cacheKey = `${productId}_${productName}`;
  if (resolvedProductCache.has(cacheKey)) {
    return resolvedProductCache.get(cacheKey)!;
  }

  const fallback: PixabayProductResolutionResult = {
    has_image: false,
    source: 'placeholder',
    reason: 'backend_error_or_no_match',
  };

  // Backend currently returns 500 (PIXABAY_API_KEY not configured). Stop calling it for a while
  // so each product card does not fire a failing request.
  if (Date.now() < pixabayBackendDownUntil) return fallback;

  try {
    const { data, error } = await supabase.functions.invoke('pixabay-product-image', {
      body: {
        action: 'resolve_product_image',
        product_id: productId,
        product_name: productName,
        category_name: categoryName,
        exclude_urls: excludeUrls,
      },
    });

    if (error || !data || data.code !== 'SUCCESS') {
      if (error) pixabayBackendDownUntil = Date.now() + PIXABAY_BREAKER_MS;
      console.warn('Backend image resolution error:', error || data?.message);
      resolvedProductCache.set(cacheKey, fallback);
      return fallback;
    }

    const result = data.data as PixabayProductResolutionResult;
    resolvedProductCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('Backend call failed:', err);
    return {
      has_image: false,
      source: 'placeholder',
      reason: 'network_failure',
    };
  }
}

/**
 * Identify product type category icon and label for neutral placeholders
 */
export function getProductTypeCategory(
  title?: string,
  category?: string
): { type: string; iconName: string; label: string } {
  const t = (title || '').toLowerCase();
  const c = (category || '').toLowerCase();

  // Try exact noun catalog first
  for (const def of PRODUCT_NOUNS_CATALOG) {
    const reg = new RegExp(`\\b${def.noun}s?\\b`, 'i');
    if (reg.test(t)) {
      return {
        type: def.noun,
        iconName: def.iconName || 'Package',
        label: `${def.noun.charAt(0).toUpperCase() + def.noun.slice(1)} Item`,
      };
    }
  }

  if (c.includes('jewel') || c.includes('gem') || t.includes('gold') || t.includes('silver') || t.includes('diamond')) {
    return { type: 'jewellery', iconName: 'Gem', label: 'Jewellery' };
  }
  if (c.includes('textile') || c.includes('apparel') || c.includes('cloth') || c.includes('fashion') || t.includes('fabric')) {
    return { type: 'textile', iconName: 'Shirt', label: 'Textiles' };
  }
  if (c.includes('machin') || c.includes('motor') || c.includes('pump') || c.includes('press') || c.includes('blower') || t.includes('industrial')) {
    return { type: 'machinery', iconName: 'Cog', label: 'Machinery' };
  }
  if (c.includes('electr') || c.includes('cable') || c.includes('wire') || t.includes('circuit') || t.includes('transformer')) {
    return { type: 'electrical', iconName: 'Cpu', label: 'Electrical' };
  }
  if (c.includes('food') || c.includes('agri') || c.includes('spice') || c.includes('grain') || c.includes('oil') || c.includes('rice')) {
    return { type: 'agriculture', iconName: 'Wheat', label: 'Agri & Food' };
  }
  if (c.includes('construct') || c.includes('building') || c.includes('hardware') || t.includes('pipe') || t.includes('valve')) {
    return { type: 'hardware', iconName: 'HardHat', label: 'Hardware' };
  }
  if (c.includes('pharma') || c.includes('medic') || c.includes('chemical') || t.includes('tablet') || t.includes('capsule')) {
    return { type: 'pharma', iconName: 'FlaskConical', label: 'Chemicals & Pharma' };
  }

  return { type: 'general', iconName: 'Package', label: 'Commercial Goods' };
}
