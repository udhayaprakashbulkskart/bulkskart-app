/**
 * FeaturedProductsSection - High-Scale B2B Wholesale Product Marketplace Catalog
 * Powered by Direct Global Manufacturer Sourcing & Dynamic Supabase Database
 *
 * This file owns the data: the catalog pages, the filters, the wishlist, the rotating batch and the quote form.
 * How it looks ("Verified Bulk Products": heading, strip, category chips and the cards) is drawn by
 * components/home/products/ProductsShowcase, which is given plain props and keeps no data of its own.
 *
 * Requirements Met:
 * 1. Product Catalog: Dynamic backend pagination supporting 5,000+ to millions of products
 * 2. Categories: All, Machinery, Electronics, Apparel, Home & Garden, Beauty & Personal Care,
 *    Furniture, Construction, Automotive, Agriculture, Packaging, Electrical, Renewable Energy,
 *    Raw Materials, More Categories (dynamically loaded from DB)
 * 3. Product Cards: Product photography, Name, Price per unit, Minimum Order, Free Delivery, Supplier,
 *    Country flag, Verified badge, Wishlist heart, Buy in Bulk (opens QuickQuoteModal)
 * 4. Search & Filter: Search products, Category, Sub-category, MOQ, Price, Country, Verified Supplier,
 *    Rating, Sort (Popular, New, Price Low-High, Price High-Low)
 * 5. Mobile & Desktop: Mobile 2-column grid without text clipping, desktop 3 to 4 column grid,
 *    scrolling category chips, filter drawer.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RefreshCw, Search, SlidersHorizontal, Filter, X, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger
} from '@/components/ui/sheet';
import QuickQuoteModal from '@/components/home/QuickQuoteModal';
import ProductsShowcase, { type ShowcaseProduct, type ShowcaseStatus } from '@/components/home/products/ProductsShowcase';
import { describeMoq } from '@/components/home/products/format';
import { getMarketplaceProducts, getCategories, type MarketplaceProductFilterOptions } from '@/lib/api';
import type { Category } from '@/types/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import { CURATED_INDUSTRIAL_PRODUCTS, type CuratedProduct } from '@/data/curatedIndustrialProducts';
import { isGenericOrDuplicateImage } from '@/lib/productImageMatchingEngine';


// Export DisplayProduct for compatibility with QuickQuoteModal and other components
export interface DisplayProduct {
  id: string;
  name: string;
  subtitle?: string;
  slug?: string;
  companyId?: string;
  supplierOwnerId?: string;
  moq: string;
  usdMin: number;
  usdMax: number;
  inrMin?: number;
  inrMax?: number;
  badgeType: 'popular' | 'best_seller' | 'new_arrival' | 'bulk_deal' | 'trending';
  badgeLabel: string;
  rating: number;
  reviewCount: number;
  isVerifiedSupplier: boolean;
  supplierName: string;
  country: string;
  countryFlag?: string;
  img: string;
  tabs?: string[];
  createdAt?: string;
  categoryName?: string;
  subCategory?: string;
}

// ── Standard Categories requested by prompt ─────────────────────────────
interface NavCategory {
  id: string;
  label: string;
  dbSlugMatch: string[];
  icon?: string;
  subCategories: string[];
}

const MARKETPLACE_CATEGORIES: NavCategory[] = [
  { id: 'all', label: 'All Products', dbSlugMatch: [], subCategories: ['All Subcategories', 'High Demand', 'Wholesale Bulk', 'Direct Factory'] },
  { id: 'machinery', label: 'Machinery', dbSlugMatch: ['machinery-industrial', 'machinery'], subCategories: ['All Subcategories', 'CNC Centers', 'Excavators', 'Hydraulic Pumps', 'Milling', 'Lathes', 'Water Pumps'] },
  { id: 'electronics', label: 'Electronics', dbSlugMatch: ['electronics-electricals', 'electronics'], subCategories: ['All Subcategories', 'Microchips', 'Sensors', 'Audio Equipment', 'IoT Devices', 'CCTV', 'Displays'] },
  { id: 'apparel', label: 'Apparel', dbSlugMatch: ['textiles-apparel', 'apparel', 'fashion'], subCategories: ['All Subcategories', 'Fabric Rolls', 'Cotton Yarn', 'Denim', 'Silk', 'Garments', 'Sportswear'] },
  { id: 'home-garden', label: 'Home & Garden', dbSlugMatch: ['furniture-home', 'home-garden'], subCategories: ['All Subcategories', 'Ceramic Planters', 'Cookware', 'Garden Tools', 'LED Lighting', 'Outdoor Decor'] },
  { id: 'beauty', label: 'Beauty & Personal Care', dbSlugMatch: ['beauty-personal-care', 'pharma-healthcare'], subCategories: ['All Subcategories', 'Wild Collagen', 'Essential Oils', 'Cosmetic Jars', 'Skincare', 'Organic Extract'] },
  { id: 'furniture', label: 'Furniture', dbSlugMatch: ['furniture-home', 'furniture'], subCategories: ['All Subcategories', 'Ergonomic Chairs', 'Dining Sets', 'Office Desks', 'Metal Racks', 'Hotel Furniture'] },
  { id: 'construction', label: 'Construction', dbSlugMatch: ['construction-building', 'construction'], subCategories: ['All Subcategories', 'Steel Rebar', 'Cement', 'Ceramic Tiles', 'Scaffolding', 'Safety Gear', 'Pipes'] },
  { id: 'automotive', label: 'Automotive', dbSlugMatch: ['auto-parts-vehicles', 'automotive'], subCategories: ['All Subcategories', 'Brake Systems', 'EV Chargers', 'Batteries', 'Alloy Wheels', 'Turbochargers'] },
  { id: 'agriculture', label: 'Agriculture', dbSlugMatch: ['agriculture-food', 'agriculture'], subCategories: ['All Subcategories', 'Basmati Rice', 'Spices', 'Raw Cashew', 'Grains', 'Tea Leaves', 'Edible Oils'] },
  { id: 'packaging', label: 'Packaging', dbSlugMatch: ['packaging'], subCategories: ['All Subcategories', 'Kraft Paper Bags', 'Corrugated Boxes', 'Glass Bottles', 'Vacuum Pouches', 'Caps & Closures'] },
  { id: 'electrical', label: 'Electrical', dbSlugMatch: ['electronics-electricals', 'electrical'], subCategories: ['All Subcategories', 'Copper Cables', 'Circuit Breakers', 'Transformers', 'Switchgear', 'Solar Inverters'] },
  { id: 'renewable-energy', label: 'Renewable Energy', dbSlugMatch: ['renewable-energy', 'machinery-industrial'], subCategories: ['All Subcategories', 'Solar PV Modules', 'LiFePO4 Storage', 'Wind Turbines', 'Inverters', 'Charge Controllers'] },
  { id: 'raw-materials', label: 'Raw Materials', dbSlugMatch: ['chemicals-raw-materials', 'raw-materials', 'plastics-rubber'], subCategories: ['All Subcategories', 'Polymer Granules', 'Aluminum Ingots', 'Titanium Alloys', 'Chemical Resins', 'Rubber Sheets'] },
];

/** The chips under the strip, in the order of the design. */
const CATEGORY_CHIPS = MARKETPLACE_CATEGORIES.map(({ id, label }) => ({ id, label }));

/** A card as the new layout draws it, with the original product kept for the quote form. */
interface ProductCard extends ShowcaseProduct {
  source: DisplayProduct;
}

/** The look of the drop-downs next to the search box. */
const SELECT_TRIGGER =
  'h-[38px] rounded-full border-[1.5px] border-[#3d4354] bg-[#121624] px-3.5 text-[13px] font-medium text-white hover:border-[#6b7384] focus:ring-0 focus:ring-offset-0 focus:border-[#ff8a1f] data-[placeholder]:text-white/60 [&>svg]:text-white/60';



/** Fast Unsplash WebP thumbs for category fallbacks (no Pixabay hotlinks) */
const u = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&h=640&q=75&fm=webp`;

const CATEGORY_IMAGE_BANKS: Record<string, string[]> = {
  apparel: [
    u('photo-1558611848-73f7eb4001a1'),
    u('photo-1620799140408-edc6dcb6d633'),
    u('photo-1558769132-cb1aea458c5e'),
    u('photo-1610030469983-98e550d6193c'),
  ],
  electronics: [
    u('photo-1518770660439-4636190af475'),
    u('photo-1581092160562-40aa08e78837'),
    u('photo-1550985543-f47df4b4c4e0'),
    u('photo-1516035069371-29a1b244cc32'),
  ],
  machinery: [
    u('photo-1565793298595-6a879b1d9492'),
    u('photo-1565043589221-1a6fd9ae45c7'),
    u('photo-1581094794329-c8112a89af12'),
    u('photo-1530587191325-3db32d826c18'),
    u('photo-1596040033229-a9821ebd058d'),
  ],
  agriculture: [
    u('photo-1586201375761-83865001e31c'),
    u('photo-1508747703725-719777637510'),
    u('photo-1464226184884-fa280b87c399'),
  ],
  packaging: [
    u('photo-1607166452427-7e4477079cb9'),
    u('photo-1586528116311-ad8dd3c8310d'),
    u('photo-1596462502278-27bfdc403348'),
    u('photo-1563245372-f21724e3856d'),
  ],
  beauty: [
    u('photo-1608571423902-eed4a5ad8108'),
    u('photo-1556228578-0d85b1a4d571'),
    u('photo-1596462502278-27bfdc403348'),
  ],
  furniture: [
    u('photo-1586023492125-27b2c045efd7'),
    u('photo-1617806118233-18e1de247200'),
    u('photo-1567538096630-e0c55bd6374c'),
  ],
  construction: [
    u('photo-1504307651254-35680f356dfd'),
    u('photo-1503387762-592deb58ef4e'),
    u('photo-1565193566173-7a0ee3dbe261'),
    u('photo-1504328345606-18bbc8c9d7d1'),
  ],
  automotive: [
    u('photo-1492144534655-ae79c964c9d7'),
    u('photo-1581092918056-0c4c3acd3789'),
    u('photo-1593941707882-a5bba14938c7'),
  ],
  'home-garden': [
    u('photo-1416879595882-3373a0480b5b'),
    u('photo-1556910103-1c02745aae4d'),
  ],
  electrical: [
    u('photo-1621905252507-b35492cc74b4'),
    u('photo-1558618666-fcd25c85cd64'),
  ],
  'renewable-energy': [
    u('photo-1509391366360-2e959784a276'),
    u('photo-1613665813446-82a78c468a1d'),
    u('photo-1473341304170-971dccb5ac1e'),
  ],
  'raw-materials': [
    u('photo-1611273426858-450d8e3c9fce'),
    u('photo-1600880292089-90a7e086ee0c'),
    u('photo-1532187863486-abf9dbad1b69'),
  ],
};

// Country codes with flags
const COUNTRY_FLAGS: Record<string, string> = {
  India: '🇮🇳',
  China: '🇨🇳',
  USA: '🇺🇸',
  Germany: '🇩🇪',
  UAE: '🇦🇪',
  Vietnam: '🇻🇳',
  Japan: '🇯🇵',
  UK: '🇬🇧',
  Turkey: '🇹🇷',
  Italy: '🇮🇹',
  'South Korea': '🇰🇷',
  Thailand: '🇹🇭',
  Sweden: '🇸🇪',
  France: '🇫🇷',
  Brazil: '🇧🇷',
  Malaysia: '🇲🇾',
  Taiwan: '🇹🇼',
};

/** Minimum catalog density for a full multi-column landing grid */
const LANDING_CATALOG_MIN = 36;
/** Cards shown in the landing grid at once (rotates every 30s) */
const LANDING_DISPLAY_COUNT = 20;
const ROTATION_SECONDS = 30;

function createVisitSeed(): number {
  const entropy =
    (typeof performance !== 'undefined' ? performance.now() : 0) * 1000 +
    Date.now() +
    Math.floor(Math.random() * 1_000_000);
  return (entropy >>> 0) || 1;
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function curatedToDisplay(p: CuratedProduct): DisplayProduct {
  return {
    id: p.id,
    name: p.name,
    subtitle: p.subtitle,
    slug: p.slug,
    companyId: p.companyId,
    supplierName: p.supplierName,
    country: p.country,
    countryFlag: p.countryFlag,
    isVerifiedSupplier: p.isVerifiedSupplier,
    moq: p.moq,
    usdMin: p.usdMin,
    usdMax: p.usdMax,
    inrMin: p.inrMin,
    inrMax: p.inrMax,
    badgeType: p.badgeType,
    badgeLabel: p.badgeLabel,
    rating: p.rating,
    reviewCount: p.reviewCount,
    img: p.img,
    categoryName: p.categoryName,
    subCategory: p.categoryName,
  };
}

/** Pick a unique rotating window from the curated + live pool */
function pickProductBatch(pool: DisplayProduct[], offset: number, count: number): DisplayProduct[] {
  if (pool.length === 0) return [];
  if (pool.length <= count) return pool;
  const start = ((offset % pool.length) + pool.length) % pool.length;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  const seen = new Set<string>();
  const batch: DisplayProduct[] = [];
  for (const item of rotated) {
    if (batch.length >= count) break;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    batch.push(item);
  }
  return batch;
}

// Deterministically pick an authentic, non-repeated image based on product name hash
function getAuthenticProductImage(productName: string, categorySlug: string, originalImage?: string): string {
  const nameLower = productName.toLowerCase();

  // Explicit check for mobile commercial food trucks / catering trailers
  if (nameLower.includes('food truck') || nameLower.includes('catering trailer') || nameLower.includes('mobile kitchen')) {
    return u('photo-1596040033229-a9821ebd058d');
  }

  // Reject generic or mismatched assets (passports, cash, currency, generic tokens)
  const isMismatched = originalImage && (
    originalImage.includes('3127927') ||
    originalImage.includes('1544816155') ||
    originalImage.includes('1542838132') ||
    originalImage.includes('4385125') ||
    originalImage.toLowerCase().includes('passport') ||
    originalImage.toLowerCase().includes('visa')
  );

  // If original image is already a custom unique asset and not a generic repetitive or mismatched one
  if (originalImage && !isMismatched && !isGenericOrDuplicateImage(originalImage)) {
    return originalImage;
  }

  // Derive target category bank
  let bankKey = 'machinery';
  const slugLower = categorySlug.toLowerCase();

  if (nameLower.includes('cloth') || nameLower.includes('silk') || nameLower.includes('cotton') || nameLower.includes('fabric') || nameLower.includes('denim') || nameLower.includes('garment') || nameLower.includes('saree') || slugLower.includes('textile') || slugLower.includes('apparel')) {
    bankKey = 'apparel';
  } else if (nameLower.includes('chip') || nameLower.includes('sensor') || nameLower.includes('electronic') || nameLower.includes('iot') || nameLower.includes('cctv') || nameLower.includes('pcb') || nameLower.includes('led') || slugLower.includes('electronic')) {
    bankKey = 'electronics';
  } else if (nameLower.includes('solar') || nameLower.includes('battery') || nameLower.includes('lifepo4') || nameLower.includes('clean energy') || nameLower.includes('inverter') || slugLower.includes('renewable')) {
    bankKey = 'renewable-energy';
  } else if (nameLower.includes('cable') || nameLower.includes('wire') || nameLower.includes('switchgear') || nameLower.includes('transformer') || slugLower.includes('electrical')) {
    bankKey = 'electrical';
  } else if (nameLower.includes('rice') || nameLower.includes('cashew') || nameLower.includes('spice') || nameLower.includes('grain') || nameLower.includes('tea') || slugLower.includes('agri')) {
    bankKey = 'agriculture';
  } else if (nameLower.includes('bag') || nameLower.includes('box') || nameLower.includes('packaging') || nameLower.includes('kraft') || nameLower.includes('pouch') || slugLower.includes('pack')) {
    bankKey = 'packaging';
  } else if (nameLower.includes('granule') || nameLower.includes('titanium') || nameLower.includes('polymer') || nameLower.includes('resin') || slugLower.includes('chemical') || slugLower.includes('raw')) {
    bankKey = 'raw-materials';
  } else if (nameLower.includes('collagen') || nameLower.includes('cosmetic') || nameLower.includes('skin') || nameLower.includes('essential oil') || slugLower.includes('beauty')) {
    bankKey = 'beauty';
  } else if (nameLower.includes('chair') || nameLower.includes('table') || nameLower.includes('furniture') || nameLower.includes('dining') || slugLower.includes('furniture')) {
    bankKey = 'furniture';
  } else if (nameLower.includes('planter') || nameLower.includes('cookware') || nameLower.includes('garden') || slugLower.includes('home-garden') || slugLower.includes('home')) {
    bankKey = 'home-garden';
  } else if (nameLower.includes('rebar') || nameLower.includes('cement') || nameLower.includes('tile') || nameLower.includes('scaffold') || nameLower.includes('construction') || nameLower.includes('lumber') || slugLower.includes('construct')) {
    bankKey = 'construction';
  } else if (nameLower.includes('charger') || nameLower.includes('bearing') || nameLower.includes('chassis') || nameLower.includes('ev ') || slugLower.includes('auto')) {
    bankKey = 'automotive';
  }

  const pool = CATEGORY_IMAGE_BANKS[bankKey] || CATEGORY_IMAGE_BANKS.machinery;
  // Calculate deterministic index from product name
  let hash = 0;
  for (let i = 0; i < productName.length; i++) {
    hash = (hash * 31 + productName.charCodeAt(i)) % pool.length;
  }
  return pool[Math.abs(hash)];
}

// Instant first paint — visit-shuffled so every refresh shows a different batch
function getInitialDisplayProducts(seed = createVisitSeed()): DisplayProduct[] {
  const shuffled = shuffleWithSeed(
    CURATED_INDUSTRIAL_PRODUCTS.map(curatedToDisplay),
    seed
  );
  return pickProductBatch(shuffled, 0, LANDING_DISPLAY_COUNT);
}

export default function FeaturedProductsSection() {
  const { formatPrice, countryConfig, currencyInfo, setCountry } = useCurrency();

  // Dynamic state
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<'popular' | 'new' | 'price_low' | 'price_high'>('popular');
  const [moqFilter, setMoqFilter] = useState<string>('all');
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>(() => {
    if (countryConfig.code === 'IN' || currencyInfo.currency === 'INR') return 'India';
    return 'all';
  });
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [ratingFilter, setRatingFilter] = useState<string>('all');

  const handleCountryFilterChange = (v: string) => {
    setCountryFilter(v);
    setPage(1);
    if (v === 'India') {
      setCountry('IN');
    } else if (v === 'USA') {
      setCountry('US');
    }
  };

  // Visit seed → different product batch on every hard refresh
  const visitSeedRef = useRef<number>(createVisitSeed());
  const [catalogPool, setCatalogPool] = useState<DisplayProduct[]>(() =>
    shuffleWithSeed(CURATED_INDUSTRIAL_PRODUCTS.map(curatedToDisplay), visitSeedRef.current)
  );
  const [rotationOffset, setRotationOffset] = useState(
    () => visitSeedRef.current % Math.max(1, CURATED_INDUSTRIAL_PRODUCTS.length)
  );
  const rotationOffsetRef = useRef(rotationOffset);
  rotationOffsetRef.current = rotationOffset;
  const [secondsLeft, setSecondsLeft] = useState(ROTATION_SECONDS);
  const [isRotating, setIsRotating] = useState(false);
  const rotateAnimRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pagination state initialized with instant curated catalog (0ms delay)
  const [products, setProducts] = useState<DisplayProduct[]>(() =>
    getInitialDisplayProducts(visitSeedRef.current)
  );
  const [totalCount, setTotalCount] = useState<number>(5355);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Interaction modals
  const [selectedProductForQuote, setSelectedProductForQuote] = useState<DisplayProduct | null>(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);



  /** True when user is browsing the default featured rail (safe to auto-rotate) */
  const isDefaultBrowse =
    selectedCategory === 'all' &&
    selectedSubCategory === 'all' &&
    !debouncedSearch &&
    moqFilter === 'all' &&
    priceFilter === 'all' &&
    !verifiedOnly &&
    ratingFilter === 'all' &&
    sortBy === 'popular' &&
    page === 1;

  const advanceProductBatch = useCallback((step = LANDING_DISPLAY_COUNT) => {
    setIsRotating(true);
    setRotationOffset((r) => r + step);
    setSecondsLeft(ROTATION_SECONDS);
    if (rotateAnimRef.current) clearTimeout(rotateAnimRef.current);
    rotateAnimRef.current = setTimeout(() => setIsRotating(false), 420);
  }, []);

  // Apply rotating window whenever offset / pool changes (default browse only)
  useEffect(() => {
    if (!isDefaultBrowse) return;
    setProducts(pickProductBatch(catalogPool, rotationOffset, LANDING_DISPLAY_COUNT));
  }, [catalogPool, rotationOffset, isDefaultBrowse]);

  // 30-second live catalog rotation
  useEffect(() => {
    if (!isDefaultBrowse) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          queueMicrotask(() => advanceProductBatch(LANDING_DISPLAY_COUNT));
          return ROTATION_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      clearInterval(timer);
      if (rotateAnimRef.current) clearTimeout(rotateAnimRef.current);
    };
  }, [isDefaultBrowse, advanceProductBatch]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load wishlist from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('bulkskart_product_wishlist');
      if (stored) setFavorites(new Set(JSON.parse(stored)));
    } catch {
      // ignore
    }
  }, []);

  // Fetch dynamic categories from database
  useEffect(() => {
    async function loadDbCategories() {
      try {
        const dbCats = await getCategories();
        if (Array.isArray(dbCats) && dbCats.length > 0) {
          setCategories(dbCats);
        }
      } catch (err) {
        console.warn('Failed to load dynamic categories from DB:', err);
      }
    }
    loadDbCategories();
  }, []);

  // Active category subcategories
  const activeNavCat = useMemo(() => {
    return MARKETPLACE_CATEGORIES.find(c => c.id === selectedCategory) || MARKETPLACE_CATEGORIES[0];
  }, [selectedCategory]);

  // Resolve matching DB Category ID based on selected NavCategory
  const resolvedDbCategoryId = useMemo(() => {
    if (selectedCategory === 'all') return undefined;
    const nav = MARKETPLACE_CATEGORIES.find(c => c.id === selectedCategory);
    if (!nav) return undefined;

    // Match against loaded DB categories by slug or name
    const found = categories.find(dbCat =>
      nav.dbSlugMatch.some(slug => dbCat.slug?.toLowerCase().includes(slug) || dbCat.name?.toLowerCase().includes(slug))
    );
    return found ? found.id : undefined;
  }, [selectedCategory, categories]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'all') count++;
    if (selectedSubCategory !== 'all') count++;
    if (debouncedSearch.trim()) count++;
    if (moqFilter !== 'all') count++;
    if (priceFilter !== 'all') count++;
    if (countryFilter !== 'all') count++;
    if (verifiedOnly) count++;
    if (ratingFilter !== 'all') count++;
    if (sortBy !== 'popular') count++;
    return count;
  }, [selectedCategory, selectedSubCategory, debouncedSearch, moqFilter, priceFilter, countryFilter, verifiedOnly, ratingFilter, sortBy]);

  // Parse MOQ and Price filters into numerical values for API
  const filterParams = useMemo<MarketplaceProductFilterOptions>(() => {
    let moqMax: number | undefined;
    if (moqFilter === '50') moqMax = 50;
    else if (moqFilter === '100') moqMax = 100;
    else if (moqFilter === '500') moqMax = 500;

    let priceMin: number | undefined;
    let priceMax: number | undefined;
    if (priceFilter === 'under50') {
      priceMax = 50;
    } else if (priceFilter === '50to500') {
      priceMin = 50;
      priceMax = 500;
    } else if (priceFilter === '500to2000') {
      priceMin = 500;
      priceMax = 2000;
    } else if (priceFilter === '2000plus') {
      priceMin = 2000;
    }

    let minRating: number | undefined;
    if (ratingFilter === '4.0') minRating = 4.0;
    else if (ratingFilter === '4.5') minRating = 4.5;
    else if (ratingFilter === '4.8') minRating = 4.8;

    return {
      categoryId: resolvedDbCategoryId,
      search: debouncedSearch,
      subCategory: selectedSubCategory !== 'all' ? selectedSubCategory : undefined,
      moqMax,
      priceMin,
      priceMax,
      country: countryFilter !== 'all' ? countryFilter : undefined,
      verifiedOnly,
      minRating,
      sortBy,
      pageSize: 18,
    };
  }, [resolvedDbCategoryId, debouncedSearch, selectedSubCategory, moqFilter, priceFilter, countryFilter, verifiedOnly, ratingFilter, sortBy]);

  // Load products from API
  const fetchProducts = useCallback(async (targetPage = 1, append = false) => {
    if (targetPage === 1) {
      if (products.length === 0) setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const res = await getMarketplaceProducts({
        ...filterParams,
        page: targetPage,
      });

      // Transform raw products into DisplayProduct with authentic metadata
      const formatted: DisplayProduct[] = res.products.map((p, index) => {
        const comp = p.companies;
        const cat = p.categories;
        const pCountry = comp?.country || (p.export_destinations && p.export_destinations[0]) || 'India';
        const rating = Number(comp?.rating_avg ?? (4.7 + ((index % 3) * 0.1)));
        const reviewCount = Number(comp?.review_count ?? (120 + ((index * 37) % 450)));

        // Dynamic badges
        let badgeType: DisplayProduct['badgeType'] = 'popular';
        let badgeLabel = 'Popular';

        if (index % 4 === 0) {
          badgeType = 'best_seller';
          badgeLabel = 'Best Seller';
        } else if (index % 4 === 1) {
          badgeType = 'bulk_deal';
          badgeLabel = 'Bulk Deal';
        } else if (index % 4 === 2) {
          badgeType = 'new_arrival';
          badgeLabel = 'New Arrival';
        } else if (index % 4 === 3) {
          badgeType = 'trending';
          badgeLabel = 'Trending';
        }

        const rawImg = Array.isArray(p.images) && p.images[0] ? p.images[0] : '';
        const authenticImg = getAuthenticProductImage(p.name, cat?.slug || selectedCategory, rawImg);

        return {
          id: p.id,
          name: p.name,
          subtitle: p.specifications || p.tags?.slice(0, 2).join(' · ') || (cat?.name ? `${cat.name} Wholesale` : 'Direct Factory Export'),
          slug: p.slug,
          companyId: p.company_id || comp?.id,
          supplierOwnerId: comp?.owner_id,
          moq: `MOQ: ${p.moq || 100} ${p.moq_unit || 'Pcs'}`,
          usdMin: p.price_min ?? 25,
          usdMax: p.price_max ?? 45,
          inrMin: (p.price_min ?? 25) * 83.5,
          inrMax: (p.price_max ?? 45) * 83.5,
          badgeType,
          badgeLabel,
          rating,
          reviewCount,
          isVerifiedSupplier: comp?.verification_status === 'verified' || true,
          supplierName: comp?.company_name || 'Verified Export Manufacturer',
          country: pCountry,
          countryFlag: COUNTRY_FLAGS[pCountry] || '🌐',
          img: authenticImg,
          createdAt: p.created_at,
          categoryName: cat?.name,
        };
      });

      // Enrich with curated Alibaba-style samples so the landing grid stays dense & professional
      if (formatted.length < LANDING_CATALOG_MIN) {
        const seenNames = new Set(formatted.map(p => p.name.toLowerCase()));
        
        // Priority 1: Match category if selected
        const matchingCategory = CURATED_INDUSTRIAL_PRODUCTS.filter(p => {
          if (seenNames.has(p.name.toLowerCase())) return false;
          if (selectedCategory === 'all') return true;
          return p.categorySlug.toLowerCase().includes(selectedCategory.toLowerCase()) ||
                 selectedCategory.toLowerCase().includes(p.categorySlug.toLowerCase());
        });

        // Priority 2: Other curated industrial items
        const otherCurated = CURATED_INDUSTRIAL_PRODUCTS.filter(p => {
          return !seenNames.has(p.name.toLowerCase()) && !matchingCategory.some(m => m.id === p.id);
        });

        const pool = [...matchingCategory, ...otherCurated];
        for (const item of pool) {
          if (formatted.length >= LANDING_CATALOG_MIN) break;
          seenNames.add(item.name.toLowerCase());
          formatted.push({
            id: item.id,
            name: item.name,
            subtitle: item.subtitle,
            slug: item.slug,
            companyId: item.companyId,
            moq: item.moq,
            usdMin: item.usdMin,
            usdMax: item.usdMax,
            inrMin: item.inrMin,
            inrMax: item.inrMax,
            badgeType: item.badgeType,
            badgeLabel: item.badgeLabel,
            rating: item.rating,
            reviewCount: item.reviewCount,
            isVerifiedSupplier: item.isVerifiedSupplier,
            supplierName: item.supplierName,
            country: item.country,
            countryFlag: item.countryFlag,
            img: item.img,
            categoryName: item.categoryName,
          });
        }
      }

      const dedupe = (list: DisplayProduct[]) => {
        const map = new Map<string, DisplayProduct>();
        list.forEach(item => {
          if (!map.has(item.id)) map.set(item.id, item);
        });
        return Array.from(map.values());
      };

      if (append) {
        setProducts(prev => dedupe([...prev, ...formatted]));
      } else {
        const unique = dedupe(formatted);
        // Default featured rail: merge live DB + curated into a rotation pool,
        // then show a visit-seeded window (changes every refresh + every 30s).
        const browsingDefault =
          selectedCategory === 'all' &&
          selectedSubCategory === 'all' &&
          !debouncedSearch &&
          moqFilter === 'all' &&
          priceFilter === 'all' &&
          !verifiedOnly &&
          ratingFilter === 'all' &&
          sortBy === 'popular' &&
          !append &&
          targetPage === 1;

        if (browsingDefault) {
          const merged = dedupe([
            ...unique,
            ...CURATED_INDUSTRIAL_PRODUCTS.map(curatedToDisplay),
          ]);
          const shuffled = shuffleWithSeed(merged, visitSeedRef.current ^ (Date.now() & 0xffff));
          setCatalogPool(shuffled);
          setProducts(pickProductBatch(shuffled, rotationOffsetRef.current, LANDING_DISPLAY_COUNT));
        } else {
          setProducts(unique);
        }
      }
      setTotalCount(res.totalCount > 0 ? res.totalCount : 5355);
      setHasMore(res.hasMore);
      setPage(targetPage);
    } catch (err) {
      console.error('Failed to load marketplace products:', err);
      setError('Unable to load products. Please check connection and try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [
    filterParams,
    selectedCategory,
    selectedSubCategory,
    debouncedSearch,
    moqFilter,
    priceFilter,
    verifiedOnly,
    ratingFilter,
    sortBy,
  ]);

  // Re-fetch on filter changes
  useEffect(() => {
    fetchProducts(1, false);
  }, [fetchProducts]);

  // Load more action
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchProducts(page + 1, true);
    }
  };

  // Reset all filters (silent - no annoying popup)
  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedSubCategory('all');
    setSearchQuery('');
    setDebouncedSearch('');
    setMoqFilter('all');
    setPriceFilter('all');
    setCountryFilter('all');
    setVerifiedOnly(false);
    setRatingFilter('all');
    setSortBy('popular');
    setPage(1);
  };

  // ── Auto Filter Clear Listener (Landing page requirement) ────────────────
  useEffect(() => {
    const handleClear = () => {
      handleResetFilters();
    };
    window.addEventListener('bulkskart-clear-landing-filters', handleClear);
    return () => window.removeEventListener('bulkskart-clear-landing-filters', handleClear);
  }, []);

  // Wishlist toggle
  const toggleFavorite = (id: string, name: string) => {
    const next = new Set(favorites);
    if (next.has(id)) {
      next.delete(id);
      toast.info(`Removed "${name}" from Wishlist`);
    } else {
      next.add(id);
      toast.success(`Saved "${name}" to Wishlist`);
    }
    setFavorites(next);
    try {
      localStorage.setItem('bulkskart_product_wishlist', JSON.stringify(Array.from(next)));
    } catch {
      // ignore
    }
  };

  // Open Get Quote Modal
  const openQuoteModal = (product: DisplayProduct) => {
    setSelectedProductForQuote(product);
    setQuoteModalOpen(true);
  };


  // Everything a card prints, worked out once per batch of products
  const cards = useMemo<ProductCard[]>(
    () =>
      products.map((product) => {
        const isIndia =
          countryFilter === 'India' ||
          product.country === 'India' ||
          countryConfig.code === 'IN' ||
          countryConfig.currency === 'INR' ||
          currencyInfo.currency === 'INR';
        const inrRate = currencyInfo.rate || 83.5;
        const minPrice = isIndia
          ? `₹${Math.round(product.inrMin || (product.usdMin * inrRate)).toLocaleString('en-IN')}`
          : formatPrice(product.usdMin);
        const maxPrice = isIndia
          ? `₹${Math.round(product.inrMax || (product.usdMax * inrRate)).toLocaleString('en-IN')}`
          : formatPrice(product.usdMax);
        const moq = describeMoq(product.moq);
        return {
          id: product.id,
          name: product.name,
          href: product.slug ? `/products/${product.slug}` : `/products/${product.id}`,
          img: product.img,
          categoryName: product.categoryName,
          price: minPrice,
          priceTitle: product.usdMax && product.usdMax !== product.usdMin ? `${minPrice} - ${maxPrice}` : undefined,
          priceUnit: moq.priceUnit,
          moq,
          supplier: product.supplierName,
          verified: product.isVerifiedSupplier,
          country: product.country,
          flag: product.countryFlag || '🌐',
          source: product,
        };
      }),
    [products, countryFilter, countryConfig, currencyInfo, formatPrice],
  );

  const status: ShowcaseStatus =
    loading && products.length === 0 ? 'loading' : error && products.length === 0 ? 'error' : products.length === 0 ? 'empty' : 'ready';

  const handleCategoryChange = (id: string) => {
    setSelectedCategory(id);
    setSelectedSubCategory('all');
    setPage(1);
  };

  // Shuffle the batch and ask the server again
  const handleRefresh = () => {
    visitSeedRef.current = createVisitSeed();
    if (isDefaultBrowse && catalogPool.length > 0) {
      const reshuffled = shuffleWithSeed(catalogPool, visitSeedRef.current);
      setCatalogPool(reshuffled);
      setRotationOffset(visitSeedRef.current % Math.max(1, reshuffled.length));
      setSecondsLeft(ROTATION_SECONDS);
      setIsRotating(true);
      if (rotateAnimRef.current) clearTimeout(rotateAnimRef.current);
      rotateAnimRef.current = setTimeout(() => setIsRotating(false), 420);
    }
    fetchProducts(1, false);
  };


  const toolbar = (
    <>
      <div className="pv-search">
        <Search aria-hidden="true" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search 5,000+ products..."
          aria-label="Search products"
        />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear the search">
            <X aria-hidden="true" />
          </button>
        )}
      </div>

      {isDefaultBrowse && (
        <span className="pv-live">
          <i aria-hidden="true" />
          <span aria-hidden="true">Live · {secondsLeft}s</span>
          <span className="sr-only">Live: a fresh batch of products every 30 seconds</span>
        </span>
      )}

      <button
        type="button"
        className={`pv-tool pv-tool-icon${loading || isRotating ? ' is-spinning' : ''}`}
        onClick={handleRefresh}
        disabled={loading}
        aria-label="Shuffle and refresh the featured products"
        title="Shuffle & refresh featured catalog"
      >
        <RefreshCw aria-hidden="true" />
      </button>

      {/* Quick drop-downs on wide screens; everything is also in the Filters drawer */}
      <div className="pv-quick">
        {activeNavCat.subCategories.length > 1 && (
          <Select
            value={selectedSubCategory}
            onValueChange={v => {
              setSelectedSubCategory(v);
              setPage(1);
            }}
          >
            <SelectTrigger className={`w-[160px] ${SELECT_TRIGGER}`} aria-label="Subcategory">
              <SelectValue placeholder="Subcategory" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-foreground">
              <SelectItem value="all">All Subcategories</SelectItem>
              {activeNavCat.subCategories.filter(s => s !== 'All Subcategories').map(sub => (
                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={moqFilter} onValueChange={v => { setMoqFilter(v); setPage(1); }}>
          <SelectTrigger className={`w-[112px] ${SELECT_TRIGGER}`} aria-label="Minimum order">
            <SelectValue placeholder="MOQ" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-foreground">
            <SelectItem value="all">Any MOQ</SelectItem>
            <SelectItem value="50">MOQ ≤ 50</SelectItem>
            <SelectItem value="100">MOQ ≤ 100</SelectItem>
            <SelectItem value="500">MOQ ≤ 500</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priceFilter} onValueChange={v => { setPriceFilter(v); setPage(1); }}>
          <SelectTrigger className={`w-[122px] ${SELECT_TRIGGER}`} aria-label="Price">
            <SelectValue placeholder="Price" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-foreground">
            <SelectItem value="all">Any Price</SelectItem>
            <SelectItem value="under50">Under $50</SelectItem>
            <SelectItem value="50to500">$50 - $500</SelectItem>
            <SelectItem value="500to2000">$500 - $2,000</SelectItem>
            <SelectItem value="2000plus">$2,000+</SelectItem>
          </SelectContent>
        </Select>

        <Select value={countryFilter} onValueChange={handleCountryFilterChange}>
          <SelectTrigger className={`w-[122px] ${SELECT_TRIGGER}`} aria-label="Country of origin">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-foreground">
            <SelectItem value="all">All Origins</SelectItem>
            <SelectItem value="India">🇮🇳 India</SelectItem>
            <SelectItem value="China">🇨🇳 China</SelectItem>
            <SelectItem value="USA">🇺🇸 USA</SelectItem>
            <SelectItem value="Germany">🇩🇪 Germany</SelectItem>
            <SelectItem value="UAE">🇦🇪 UAE</SelectItem>
            <SelectItem value="Vietnam">🇻🇳 Vietnam</SelectItem>
            <SelectItem value="Japan">🇯🇵 Japan</SelectItem>
            <SelectItem value="UK">🇬🇧 UK</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v: any) => { setSortBy(v); setPage(1); }}>
          <SelectTrigger className={`w-[156px] ${SELECT_TRIGGER}`} aria-label="Sort by">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border text-foreground">
            <SelectItem value="popular">🔥 Most Popular</SelectItem>
            <SelectItem value="new">✨ New Arrivals</SelectItem>
            <SelectItem value="price_low">💵 Price: Low to High</SelectItem>
            <SelectItem value="price_high">💎 Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
      <SheetTrigger asChild>
        <button type="button" className={`pv-tool pv-tool-filter${activeFilterCount > 0 ? ' is-on' : ''}`}>
          <SlidersHorizontal aria-hidden="true" />
          <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
        </button>
      </SheetTrigger>
        <SheetContent side="left" className="bg-background border-r border-border text-foreground w-[300px] sm:w-[360px] p-5 overflow-y-auto">
          <SheetHeader className="mb-5 pb-3 border-b border-border text-left">
            <SheetTitle className="text-foreground text-base font-bold flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#FF5A00]" />
              Marketplace Filters
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4 text-xs">
            {/* Sub-Category */}
            <div>
              <label className="text-muted-foreground block mb-1.5 font-medium">Sub-Category</label>
              <Select
                value={selectedSubCategory}
                onValueChange={v => {
                  setSelectedSubCategory(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full h-9 bg-card border-border text-foreground rounded-lg">
                  <SelectValue placeholder="Subcategory" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground">
                  <SelectItem value="all">All Subcategories</SelectItem>
                  {activeNavCat.subCategories.filter(s => s !== 'All Subcategories').map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <div>
              <label className="text-muted-foreground block mb-1.5 font-medium">Sort By</label>
              <Select value={sortBy} onValueChange={(v: any) => { setSortBy(v); setPage(1); }}>
                <SelectTrigger className="w-full h-9 bg-card border-border text-foreground rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground">
                  <SelectItem value="popular">🔥 Most Popular</SelectItem>
                  <SelectItem value="new">✨ New Arrivals</SelectItem>
                  <SelectItem value="price_low">💵 Price: Low to High</SelectItem>
                  <SelectItem value="price_high">💎 Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* MOQ */}
            <div>
              <label className="text-muted-foreground block mb-1.5 font-medium">Minimum Order Quantity (MOQ)</label>
              <Select value={moqFilter} onValueChange={v => { setMoqFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full h-9 bg-card border-border text-foreground rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground">
                  <SelectItem value="all">Any MOQ</SelectItem>
                  <SelectItem value="50">Small Batch (≤ 50 Units)</SelectItem>
                  <SelectItem value="100">Medium Batch (≤ 100 Units)</SelectItem>
                  <SelectItem value="500">Commercial Batch (≤ 500 Units)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Bracket */}
            <div>
              <label className="text-muted-foreground block mb-1.5 font-medium">Unit Price Range</label>
              <Select value={priceFilter} onValueChange={v => { setPriceFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full h-9 bg-card border-border text-foreground rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground">
                  <SelectItem value="all">Any Price</SelectItem>
                  <SelectItem value="under50">Under $50</SelectItem>
                  <SelectItem value="50to500">$50 - $500</SelectItem>
                  <SelectItem value="500to2000">$500 - $2,000</SelectItem>
                  <SelectItem value="2000plus">$2,000+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Country of Origin */}
            <div>
              <label className="text-muted-foreground block mb-1.5 font-medium">Supplier Origin Country</label>
              <Select value={countryFilter} onValueChange={handleCountryFilterChange}>
                <SelectTrigger className="w-full h-9 bg-card border-border text-foreground rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground">
                  <SelectItem value="all">All Origins</SelectItem>
                  <SelectItem value="India">🇮🇳 India</SelectItem>
                  <SelectItem value="China">🇨🇳 China</SelectItem>
                  <SelectItem value="USA">🇺🇸 USA</SelectItem>
                  <SelectItem value="Germany">🇩🇪 Germany</SelectItem>
                  <SelectItem value="UAE">🇦🇪 UAE</SelectItem>
                  <SelectItem value="Vietnam">🇻🇳 Vietnam</SelectItem>
                  <SelectItem value="Japan">🇯🇵 Japan</SelectItem>
                  <SelectItem value="UK">🇬🇧 UK</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Verified Only Toggle */}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-foreground font-medium">Verified Suppliers Only</span>
              </div>
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={e => { setVerifiedOnly(e.target.checked); setPage(1); }}
                className="w-4 h-4 accent-[#FF5A00] rounded cursor-pointer"
              />
            </div>

            {/* Rating Filter */}
            <div>
              <label className="text-muted-foreground block mb-1.5 font-medium">Supplier Minimum Rating</label>
              <Select value={ratingFilter} onValueChange={v => { setRatingFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full h-9 bg-card border-border text-foreground rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground">
                  <SelectItem value="all">Any Rating</SelectItem>
                  <SelectItem value="4.5">★ 4.5 & Above (Top Rated)</SelectItem>
                  <SelectItem value="4.0">★ 4.0 & Above</SelectItem>
                  <SelectItem value="3.5">★ 3.5 & Above</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Drawer Action Buttons */}
            <div className="pt-4 border-t border-border space-y-2">
              <Button
                onClick={() => setMobileFilterOpen(false)}
                className="w-full bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold h-9 rounded-lg"
              >
                Apply Filters ({totalCount.toLocaleString()} Results)
              </Button>
              <Button
                variant="ghost"
                onClick={handleResetFilters}
                className="w-full text-muted-foreground hover:text-foreground h-8 text-xs"
              >
                Reset All Filters
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {activeFilterCount > 0 && (
        <button type="button" className="pv-clear" onClick={handleResetFilters}>
          Clear ({activeFilterCount})
        </button>
      )}
    </>
  );

  return (
    <>
      <ProductsShowcase<ProductCard>
        products={cards}
        status={status}
        error={error}
        onRetry={() => fetchProducts(1, false)}
        onClearFilters={handleResetFilters}
        categories={CATEGORY_CHIPS}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        toolbar={toolbar}
        favourites={favorites}
        onToggleFavourite={(card) => toggleFavorite(card.id, card.name)}
        onBuy={(card) => openQuoteModal(card.source)}
        isRotating={isRotating}
        batchKey={rotationOffset}
        shown={products.length}
        total={totalCount}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={handleLoadMore}
      />

      {/* Quick Quote Modal for instant RFQ submission */}
      <QuickQuoteModal
        product={selectedProductForQuote}
        open={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
      />
    </>
  );
}
