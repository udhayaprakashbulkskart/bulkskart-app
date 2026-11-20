/**
 * FeaturedProductsSection - "Verified Bulk Products" on the home page, laid out from the design picture:
 * banner (title, line, Explore Products, boxes on a pallet), four promises, category chips with a scroll
 * arrow, "Trending Wholesale Deals" with View All, and two-per-row cards on phones (picture, ribbon badge,
 * save, name, bulk price with the minimum-order price struck through and the saving, MOQ, Free Delivery,
 * Loan Eligible, Buy in Bulk). Products come from the catalogue, filled out with the sample catalogue,
 * rotate every 30 seconds and load more on request. Search and filters live on the Products page.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Heart, Flame, AlertCircle, ChevronRight, ShieldCheck, ChevronDown, CheckCircle2, Layers,
  Zap, PackageCheck, Loader2, Truck, LayoutGrid, Wrench, Cpu, Shirt, Home, Box, CookingPot, Monitor, ShoppingCart,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import SafeImage from '@/components/common/SafeImage';
import LoanEligibleTag from '@/components/common/LoanEligibleTag';
import QuickQuoteModal from '@/components/home/QuickQuoteModal';
import { getMarketplaceProducts, getCategories, type MarketplaceProductFilterOptions } from '@/lib/api';
import type { Category } from '@/types/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import { shortMoq } from '@/lib/moqText';
import { CURATED_INDUSTRIAL_PRODUCTS, type CuratedProduct } from '@/data/curatedIndustrialProducts';
import { catalogProductPhoto, VERIFIED_BULK_CURATED_PHOTOS } from '@/data/verifiedBulkProductPhotos';

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
  /** Words that put a product in this group when the database has no category for it. */
  keywords?: RegExp;
}

const KITCHEN_WORDS = /\b(kitchen\w*|cook\w*|dinnerware|tableware|crockery|cutlery|utensils?|sinks?|stoves?|fryers?|ovens?|burners?|tandoor)\b/i;

const MARKETPLACE_CATEGORIES: NavCategory[] = [
  { id: 'all', label: 'All Products', dbSlugMatch: [], subCategories: ['All Subcategories', 'High Demand', 'Wholesale Bulk', 'Direct Factory'] },
  { id: 'kitchen', label: 'Kitchen', dbSlugMatch: ['kitchen'], subCategories: ['All Subcategories', 'Cookware', 'Kitchen Sinks', 'Dinnerware', 'Commercial Kitchen'], keywords: KITCHEN_WORDS },
  { id: 'apparel', label: 'Apparel', dbSlugMatch: ['textiles-apparel', 'apparel', 'fashion'], subCategories: ['All Subcategories', 'Fabric Rolls', 'Cotton Yarn', 'Denim', 'Silk', 'Garments', 'Sportswear'] },
  { id: 'electronics', label: 'Electronics', dbSlugMatch: ['electronics-electricals', 'electronics'], subCategories: ['All Subcategories', 'Microchips', 'Sensors', 'Audio Equipment', 'IoT Devices', 'CCTV', 'Displays'] },
  { id: 'machinery', label: 'Machinery', dbSlugMatch: ['machinery-industrial', 'machinery'], subCategories: ['All Subcategories', 'CNC Centers', 'Excavators', 'Hydraulic Pumps', 'Milling', 'Lathes', 'Water Pumps'] },
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
    img: VERIFIED_BULK_CURATED_PHOTOS[p.id] || p.img,
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

// Instant first paint — visit-shuffled so every refresh shows a different batch
function getInitialDisplayProducts(seed = createVisitSeed()): DisplayProduct[] {
  const shuffled = shuffleWithSeed(
    CURATED_INDUSTRIAL_PRODUCTS.map(curatedToDisplay),
    seed
  );
  return pickProductBatch(shuffled, 0, LANDING_DISPLAY_COUNT);
}

/** The four promises under the banner, as in the design picture. */
const FEATURE_STRIP = [
  { icon: ShieldCheck, label: 'Verified', sub: 'Manufacturers' },
  { icon: Layers, label: 'Low MOQ', sub: '(Min. 10 Pcs)' },
  { icon: Truck, label: 'Free', sub: 'Delivery' },
  { icon: Zap, label: 'Best', sub: 'Wholesale Price' },
];

/** Icon for a category pill, chosen from its label. */
function categoryIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes('all')) return LayoutGrid;
  if (l.includes('kitchen')) return CookingPot;
  if (l.includes('machin')) return Wrench;
  if (l === 'electronics') return Monitor;
  if (l.includes('electr')) return Cpu;
  if (l.includes('apparel') || l.includes('textile')) return Shirt;
  if (l.includes('home') || l.includes('garden')) return Home;
  return Box;
}

export default function FeaturedProductsSection() {
  const { formatPrice, countryConfig, currencyInfo } = useCurrency();

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
  const [, setSecondsLeft] = useState(ROTATION_SECONDS);
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
  const [chipsScrolled, setChipsScrolled] = useState(false);

  // Category scroll container reference
  const categoryScrollRef = useRef<HTMLDivElement>(null);

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

  /** Words for a chip with no database category of its own (Kitchen). */
  const categoryWords = MARKETPLACE_CATEGORIES.find((c) => c.id === selectedCategory)?.keywords;

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
        // Pull a wider window so catalogue photos (not placeholder stock) can fill the rail.
        pageSize: targetPage === 1 ? 80 : filterParams.pageSize,
      });

      // Transform raw products into DisplayProduct with authentic metadata
      const formatted: DisplayProduct[] = res.products.flatMap((p) => {
        const catalogImg = catalogProductPhoto(p.images);
        if (!catalogImg) return [];
        const comp = p.companies;
        const cat = p.categories;
        const pCountry = comp?.country || (p.export_destinations && p.export_destinations[0]) || 'India';
        // Only real figures: no rating or reviews until buyers have left some.
        const rating = Number(comp?.rating_avg ?? 0) || 0;
        const reviewCount = Number(comp?.review_count ?? 0) || 0;
        // Prices are in the currency the supplier saved (rupees when none is given).
        const priceCur = (p.price_currency || 'INR').toUpperCase();
        const toUsd = (v: number | null | undefined) => (v && v > 0 ? (priceCur === 'USD' ? v : priceCur === 'INR' ? v / 83.5 : v) : 0);
        const toInr = (v: number | null | undefined) => (v && v > 0 ? (priceCur === 'INR' ? v : priceCur === 'USD' ? v * 83.5 : v) : 0);

        // Badges only from real facts: a product added in the last 30 days is a new arrival.
        const isNew = p.created_at ? Date.now() - new Date(p.created_at).getTime() < 30 * 864e5 : false;
        const badgeType: DisplayProduct['badgeType'] = 'new_arrival';
        const badgeLabel = isNew ? 'New Arrival' : '';

        return [{
          id: p.id,
          name: p.name,
          subtitle: p.specifications || p.tags?.slice(0, 2).join(' · ') || (cat?.name ? `${cat.name} Wholesale` : 'Direct Factory Export'),
          slug: p.slug,
          companyId: p.company_id || comp?.id,
          supplierOwnerId: comp?.owner_id,
          moq: `MOQ: ${p.moq || 100} ${p.moq_unit || 'Pcs'}`,
          usdMin: toUsd(p.price_min),
          usdMax: toUsd(p.price_max),
          inrMin: toInr(p.price_min),
          inrMax: toInr(p.price_max),
          badgeType,
          badgeLabel,
          rating,
          reviewCount,
          isVerifiedSupplier: comp?.verification_status === 'verified',
          supplierName: comp?.company_name || 'Supplier',
          country: pCountry,
          countryFlag: COUNTRY_FLAGS[pCountry] || '🌐',
          img: catalogImg,
          createdAt: p.created_at,
          categoryName: cat?.name,
        }];
      }).filter((p) => !categoryWords || Boolean(resolvedDbCategoryId) || categoryWords.test(`${p.name} ${p.subtitle} ${p.categoryName ?? ''}`));

      // Enrich with curated Alibaba-style samples so the landing grid stays dense & professional
      if (formatted.length < LANDING_CATALOG_MIN) {
        const seenNames = new Set(formatted.map(p => p.name.toLowerCase()));
        
        // Priority 1: Match category if selected
        const matchingCategory = CURATED_INDUSTRIAL_PRODUCTS.filter(p => {
          if (seenNames.has(p.name.toLowerCase())) return false;
          if (selectedCategory === 'all') return true;
          if (categoryWords) return categoryWords.test(`${p.name} ${p.subtitle}`);
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
            img: VERIFIED_BULK_CURATED_PHOTOS[item.id] || item.img,
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
    categoryWords,
    resolvedDbCategoryId,
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

  /**
   * Price shown on a card: the bulk price (lowest in the product's own range), the price at the minimum order
   * (highest in the range) struck through, and the saving between the two. Nothing is shown that the range lacks.
   */
  const priceParts = (product: DisplayProduct) => {
    if (!product.usdMin) return { now: 'Price on request', was: '', off: 0 };
    const isIndia =
      countryFilter === 'India' ||
      product.country === 'India' ||
      countryConfig.code === 'IN' ||
      countryConfig.currency === 'INR' ||
      currencyInfo.currency === 'INR';
    const inrRate = currencyInfo.rate || 83.5;
    const low = isIndia ? Math.round(product.inrMin || product.usdMin * inrRate) : product.usdMin;
    const high = isIndia ? Math.round(product.inrMax || product.usdMax * inrRate) : product.usdMax;
    const show = (v: number) => (isIndia ? `₹${v.toLocaleString('en-IN')}` : formatPrice(v));
    const off = high > low ? Math.round((1 - low / high) * 100) : 0;
    return { now: show(low), was: off > 0 ? show(high) : '', off };
  };

  // Category horizontal scroll helper
  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const amount = direction === 'left' ? -280 : 280;
      categoryScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-black py-3 text-white sm:py-6 md:py-8" aria-labelledby="verified-bulk-products-title">
      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-2 sm:px-5 md:px-6">

        {/* ── 1. BANNER — from the design picture: title, line, Explore Products, dots, boxes on a pallet ── */}
        <div className="relative overflow-hidden rounded-[14px] border border-white/10 bg-[radial-gradient(120%_150%_at_0%_0%,#2b1406_0%,#0e0e0e_48%,#060606_100%)] sm:rounded-2xl">
          <div className="pointer-events-none absolute inset-y-0 right-0 [mask-image:linear-gradient(to_right,transparent,black_14%)]">
            <img
              src="/home-design/vbp-banner.jpg"
              alt=""
              width={420}
              height={312}
              loading="lazy"
              decoding="async"
              className="h-full w-auto max-w-none"
            />
          </div>
          <div className="relative z-10 flex min-h-[132px] flex-col justify-center py-2.5 pl-6 pr-3 sm:min-h-[210px] sm:pl-10 lg:min-h-[250px] lg:pl-14">
            <h2 id="verified-bulk-products-title" className="text-[26px] font-black leading-[1.04] tracking-tight min-[400px]:text-[27px] sm:text-[42px] lg:text-[52px]">
              <span className="block text-white">Verified</span>
              <span className="block text-[#FF6A00]">Bulk Products</span>
            </h2>
            <p className="mt-1.5 max-w-[205px] text-[10.5px] leading-[1.3] text-neutral-200 min-[400px]:max-w-[215px] sm:mt-2.5 sm:max-w-[380px] sm:text-[15px] lg:max-w-[600px] lg:text-[17px]">
              Source directly from verified manufacturers at wholesale prices
            </p>
            <div className="mt-2.5 flex items-center gap-7 sm:mt-4 sm:gap-12">
              <Link
                to="/products"
                className="group inline-flex h-7 items-center gap-2 rounded-full bg-gradient-to-r from-[#FF7A1A] to-[#F05A00] px-3.5 text-[11px] font-bold text-white shadow-[0_8px_22px_-8px_rgba(255,90,0,0.9)] transition-transform hover:scale-[1.03] sm:h-11 sm:gap-3 sm:px-6 sm:text-[15px]"
              >
                Explore Products
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 sm:h-4 sm:w-4" />
              </Link>
              {/* Dots follow the live product rotation (a new set every 30 seconds) */}
              <span className="flex items-center gap-1.5 sm:gap-2" aria-hidden="true">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className={`h-1.5 w-1.5 rounded-full transition-colors sm:h-2 sm:w-2 ${dot === Math.floor(rotationOffset / LANDING_DISPLAY_COUNT) % 3 ? 'bg-[#FF6A00]' : 'bg-white/45'}`}
                  />
                ))}
              </span>
            </div>
          </div>
        </div>

        {/* Promises */}
        <div className="mt-2.5 flex items-center justify-between gap-1 px-1 sm:mt-4 sm:justify-around sm:px-2 lg:mt-5">
          {FEATURE_STRIP.map(({ icon: Icon, label, sub }, i) => (
            <React.Fragment key={label}>
              {i > 0 && <span className="h-5 w-px shrink-0 bg-white/25 sm:h-8" aria-hidden="true" />}
              <div className="flex min-w-0 items-center gap-1 min-[380px]:gap-1.5 sm:gap-3">
                <Icon className="h-4 w-4 shrink-0 text-[#FF6A00] min-[380px]:h-[19px] min-[380px]:w-[19px] sm:h-8 sm:w-8" strokeWidth={1.9} />
                <div className="min-w-0 text-[8.5px] leading-[1.3] text-white min-[380px]:text-[9px] min-[400px]:text-[9.5px] sm:text-[14px] lg:text-[15px]">
                  <div className="font-semibold">{label}</div>
                  <div className="whitespace-nowrap text-neutral-200">{sub}</div>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* ── 2. CATEGORY CHIPS ─────────────────────────────────────────────── */}
        <div className="mt-[18px] flex items-center gap-1 min-[400px]:gap-1.5 sm:mt-6 sm:gap-2">
          {chipsScrolled && (
            <button
              type="button"
              onClick={() => scrollCategories('left')}
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/40 bg-black text-white transition-colors hover:border-[#FF6A00] hover:text-[#FF6A00] md:flex"
              aria-label="Scroll categories left"
            >
              <ChevronRight className="h-5 w-5 rotate-180" />
            </button>
          )}
          <div
            ref={categoryScrollRef}
            onScroll={(e) => setChipsScrolled(e.currentTarget.scrollLeft > 4)}
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-smooth overscroll-x-contain min-[400px]:gap-1.5 sm:gap-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {MARKETPLACE_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              const Icon = categoryIcon(cat.label);
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSelectedSubCategory('all');
                    setPage(1);
                  }}
                  className={`flex h-[28px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[10.5px] font-semibold transition-colors min-[400px]:px-2.5 sm:h-10 sm:gap-2 sm:px-4 sm:text-[14px] ${
                    active
                      ? 'border-transparent bg-gradient-to-r from-[#FF7A1A] to-[#F05A00] text-white shadow-[0_8px_22px_-10px_rgba(255,90,0,0.9)]'
                      : 'border-white/40 bg-black text-white hover:border-[#FF6A00] hover:text-[#FF8A3D]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 sm:h-[18px] sm:w-[18px]" strokeWidth={1.9} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => scrollCategories('right')}
            className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full border border-white/40 bg-black text-white transition-colors hover:border-[#FF6A00] hover:text-[#FF6A00] sm:h-10 sm:w-10"
            aria-label="More categories"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* ── 3. TRENDING WHOLESALE DEALS ───────────────────────────────────── */}
        <div className="mb-3 mt-5 flex items-center justify-between gap-2 sm:mb-5 sm:mt-8">
          <h3 className="flex min-w-0 items-center gap-1.5 text-[16px] font-black tracking-tight min-[400px]:text-[17px] sm:gap-2.5 sm:text-[26px]">
            <Flame className="h-5 w-5 shrink-0 fill-[#FF6A00] text-[#FF8A3D] sm:h-7 sm:w-7" />
            <span className="truncate">
              Trending Wholesale <span className="text-[#FF6A00]">Deals</span>
            </span>
          </h3>
          <Link
            to="/products"
            className="group flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border border-[#FF6A00] px-2.5 text-[10.5px] font-bold text-[#FF6A00] transition-colors hover:bg-[#FF6A00]/10 sm:h-10 sm:gap-2 sm:px-5 sm:text-[14px]"
          >
            View All
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 sm:h-4 sm:w-4" />
          </Link>
        </div>

        {/* ── 4. PRODUCT GRID ───────────────────────────────────────────────── */}
        {loading && products.length === 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="flex animate-pulse flex-col overflow-hidden rounded-[11px] border border-white/15 bg-[#0b0b0b] sm:rounded-2xl">
                <div className="aspect-[16/9] w-full bg-white/10" />
                <div className="flex flex-col gap-2 p-2.5">
                  <div className="h-3.5 w-3/4 rounded bg-white/10" />
                  <div className="h-5 w-1/2 rounded bg-white/10" />
                  <div className="h-3 w-2/3 rounded bg-white/10" />
                  <div className="mt-1 h-8 w-full rounded-full bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : error && products.length === 0 ? (
          <div className="mx-auto my-6 max-w-md rounded-xl border border-[#FF5A00]/30 bg-[#0b0b0b] p-8 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-[#FF6A00]" />
            <h3 className="mb-1 text-base font-bold text-white">Catalog Connection Error</h3>
            <p className="mb-4 text-xs text-neutral-400">{error}</p>
            <Button
              onClick={() => fetchProducts(1, false)}
              className="h-8 rounded-lg bg-[#C94400] px-4 text-xs font-bold text-white hover:bg-[#B33D00]"
            >
              Retry Loading Catalog
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="mx-auto my-6 max-w-lg rounded-2xl border border-white/15 bg-[#0b0b0b] p-8 text-center sm:p-12">
            <PackageCheck className="mx-auto mb-3 h-12 w-12 text-neutral-600" />
            <h3 className="mb-1 text-base font-bold text-white sm:text-lg">No products in this category yet</h3>
            <p className="mb-4 text-xs text-neutral-400 sm:text-sm">Try another category, or browse every product.</p>
            <Button
              onClick={handleResetFilters}
              className="h-9 rounded-lg bg-[#C94400] px-5 text-xs font-bold text-white hover:bg-[#B33D00] sm:text-sm"
            >
              Show All Products
            </Button>
          </div>
        ) : (
          <div
            className={`grid grid-cols-2 gap-2 transition-opacity duration-300 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 ${
              isRotating ? 'opacity-55' : 'opacity-100'
            }`}
          >
            {products.map((product, productIdx) => {
              const isFav = favorites.has(product.id);
              const price = priceParts(product);
              const href = product.slug ? `/products/${product.slug}` : `/products/${product.id}`;
              return (
                <article
                  key={`${product.id}-${rotationOffset}`}
                  className="group flex flex-col overflow-hidden rounded-[11px] border border-white/20 bg-[#0b0b0b] transition-colors duration-300 animate-in fade-in hover:border-[#FF6A00]/70 sm:rounded-2xl"
                >
                  {/* Picture, ribbon and save */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#141414]">
                    <Link to={href} tabIndex={-1} aria-hidden="true" className="block h-full w-full">
                      <SafeImage
                        src={product.img}
                        alt={product.name}
                        productId={product.id}
                        category={product.categoryName}
                        isDuplicateOnPage={false}
                        isRepresentativeImage={true}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading={productIdx < 6 ? 'eager' : 'lazy'}
                        priority={productIdx < 4}
                        sizes="(max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 340px"
                      />
                    </Link>
                    {product.badgeLabel && (
                      <span className="pointer-events-none absolute left-1 top-2 z-10 sm:left-1.5 sm:top-3">
                        <span className="relative block rounded-r-full rounded-tl-[5px] bg-gradient-to-r from-[#FF7A1A] to-[#F05A00] py-[3px] pl-2 pr-2.5 text-[9.5px] font-extrabold leading-none text-white shadow-[0_4px_10px_-4px_rgba(0,0,0,0.8)] sm:py-1.5 sm:pl-3 sm:pr-4 sm:text-[12px]">
                          {product.badgeLabel}
                        </span>
                        <span className="absolute -bottom-[4px] left-0 h-[4px] w-[5px] bg-[#8A2E00] [clip-path:polygon(0_0,100%_0,100%_100%)]" />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(product.id, product.name);
                      }}
                      className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-black/60 backdrop-blur-sm transition-transform hover:scale-110 sm:right-2.5 sm:top-2.5 sm:h-9 sm:w-9"
                      aria-label={isFav ? 'Remove from wishlist' : 'Save to wishlist'}
                      aria-pressed={isFav}
                    >
                      <Heart className={`h-3.5 w-3.5 sm:h-[18px] sm:w-[18px] ${isFav ? 'fill-[#FF6A00] text-[#FF6A00]' : 'text-white'}`} />
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col px-2 pb-2.5 pt-2 min-[400px]:px-2.5 sm:px-4 sm:pb-4 sm:pt-3">
                    <Link to={href} className="transition-colors hover:text-[#FF8A3D]">
                      <h4 className="line-clamp-2 min-h-[2.4em] text-[12px] font-extrabold leading-[1.2] text-white min-[400px]:text-[12.5px] sm:text-[16px]" title={product.name}>
                        {product.name}
                      </h4>
                    </Link>

                    {/* Bulk price, the price at the minimum order, and the saving between them */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 sm:mt-2.5 sm:gap-x-2.5">
                      <span className={`font-black leading-none tracking-tight text-[#FF6A00] ${!product.usdMin ? 'text-[13px] sm:text-[16px]' : price.now.length > 8 ? 'text-[15px] min-[400px]:text-[16px] sm:text-[21px]' : 'text-[17px] min-[400px]:text-[19px] sm:text-[26px]'}`}>
                        {price.now}
                      </span>
                      {price.was && (
                        <s className="text-[9px] font-semibold text-neutral-400 min-[400px]:text-[9.5px] sm:text-[13px]">{price.was}</s>
                      )}
                      {price.off > 0 && (
                        <span
                          className="ml-auto rounded-full bg-[#F05A00] px-1.5 py-[3px] text-[9px] font-extrabold leading-none text-white min-[400px]:px-2 min-[400px]:text-[9.5px] sm:px-3 sm:py-1.5 sm:text-[12px]"
                          title="Bulk price compared with the price at the minimum order"
                        >
                          {price.off}% OFF
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-1 border-t border-white/15 pt-2 text-[9px] text-white min-[400px]:gap-1.5 min-[400px]:text-[9.5px] sm:mt-3 sm:gap-2.5 sm:pt-3 sm:text-[13px]">
                      <span className="flex min-w-0 items-center gap-1 sm:gap-1.5" title={product.moq}>
                        <Box className="h-3 w-3 shrink-0 text-[#FF6A00] sm:h-4 sm:w-4" strokeWidth={1.9} />
                        <span className="truncate">{shortMoq(product.moq)}</span>
                      </span>
                      <span className="h-3 w-px shrink-0 bg-white/30 sm:h-4" aria-hidden="true" />
                      <span className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                        <Truck className="h-3 w-3 shrink-0 text-[#FF6A00] sm:h-4 sm:w-4" strokeWidth={1.9} />
                        Free Delivery
                      </span>
                    </div>

                    <LoanEligibleTag link size="sm" tone="gold" className="mt-2 sm:mt-3 sm:px-3 sm:py-1 sm:text-[12.5px]" />

                    <div className="mt-auto pt-2.5 sm:pt-4">
                    <Button
                      onClick={() => openQuoteModal(product)}
                      className="group/btn h-[30px] w-full rounded-full bg-gradient-to-r from-[#FF7A1A] to-[#F05A00] px-3 text-[12px] font-bold text-white shadow-[0_8px_20px_-10px_rgba(255,90,0,0.9)] transition-transform hover:opacity-95 active:scale-[0.98] sm:h-11 sm:px-5 sm:text-[15px]"
                    >
                      <ShoppingCart className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                      <span className="mx-auto truncate">Buy in Bulk</span>
                      <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover/btn:translate-x-0.5 sm:h-5 sm:w-5" />
                    </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ── 5. BACKEND PAGINATION / LOAD MORE ─────────────────────────────── */}
        {products.length > 0 && (
          <div className="mt-5 flex flex-col items-center justify-center gap-3 border-t border-white/10 pt-4 sm:mt-8">
            <div className="text-center text-xs font-medium text-neutral-400">
              Showing <span className="font-bold text-white">{products.length}</span> of <span className="font-bold text-white">{totalCount.toLocaleString()}+</span> wholesale products
            </div>

            {hasMore ? (
              <Button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="group flex h-10 items-center gap-2 rounded-full border border-[#FF6A00] bg-black px-6 text-xs font-bold text-[#FF8A3D] transition-colors hover:bg-[#FF6A00]/10 sm:px-8 sm:text-sm"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading Catalog Products...</span>
                  </>
                ) : (
                  <>
                    <span>Load More Products</span>
                    <ChevronDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
                  </>
                )}
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-[#0b0b0b] px-4 py-2 text-xs text-neutral-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#FF7A2E]" />
                <span>You've reached the end of the filtered catalog. Explore more in the complete Products Directory.</span>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Quick Quote Modal for instant RFQ submission ─────────────────── */}
      <QuickQuoteModal
        product={selectedProductForQuote}
        open={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
      />
    </section>
  );
}
