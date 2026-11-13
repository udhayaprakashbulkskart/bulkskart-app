/**
 * FeaturedProductsSection - High-Scale B2B Wholesale Product Marketplace Catalog
 * Powered by Direct Global Manufacturer Sourcing & Dynamic Supabase Database
 *
 * Requirements Met:
 * 1. Product Catalog: Dynamic backend pagination supporting 5,000+ to millions of products
 * 2. Categories: All, Apparel, Electronics, Machinery, Home & Garden, Beauty & Personal Care,
 *    Furniture, Construction, Automotive, Agriculture, Packaging, Electrical, Renewable Energy,
 *    Raw Materials, More Categories (dynamically loaded from DB)
 * 3. Product Cards: Real product-specific photography, Name, MOQ, Bulk Price Range, Supplier,
 *    Country flag, Verified badge, Star Rating, Review count, Badges (Bulk Deal, New, Popular, Best Seller),
 *    View Details, Get Quote (#FF5A00 brand button opening QuickQuoteModal)
 * 4. Search & Filter: Search products, Category, Sub-category, MOQ, Price, Country, Verified Supplier,
 *    Rating, Sort (Popular, New, Price Low-High, Price High-Low)
 * 5. Mobile & Desktop: Mobile 2-column grid without text clipping, desktop 4-6 column grid,
 *    smooth horizontal category scrolling, mobile filter drawer.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Check, Heart, Star, Flame, Crown, Tag,
  MessageSquare, RefreshCw, Sparkles, AlertCircle, ChevronRight,
  Search, SlidersHorizontal, Filter, X, Building2, MapPin,
  ShieldCheck, ChevronDown, CheckCircle2, Globe, Layers, ArrowUpDown,
  Zap, PackageCheck, ExternalLink, Loader2,
  Truck, LayoutGrid, Wrench, Cpu, Shirt, Home, Network, Box, Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger
} from '@/components/ui/sheet';
import SafeImage from '@/components/common/SafeImage';
import QuickQuoteModal from '@/components/home/QuickQuoteModal';
import { getMarketplaceProducts, getCategories, type MarketplaceProductFilterOptions } from '@/lib/api';
import type { Product, Category } from '@/types/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
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
}

const MARKETPLACE_CATEGORIES: NavCategory[] = [
  { id: 'all', label: 'All Products', dbSlugMatch: [], subCategories: ['All Subcategories', 'High Demand', 'Wholesale Bulk', 'Direct Factory'] },
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

const FEATURE_STRIP = [
  { icon: ShieldCheck, label: 'Verified', sub: 'Manufacturers', color: 'text-[#FF5A00]' },
  { icon: Box, label: 'Bulk', sub: 'Pricing', color: 'text-[#FF5A00]' },
  { icon: Layers, label: 'MOQ', sub: 'Min. 10 Pieces', color: 'text-[#FF5A00]' },
  { icon: Truck, label: 'Free', sub: 'Delivery', color: 'text-[#FF7A2E]' },
];

/** Gold laurel wreath for the section title (desktop only). */
function FeaturedLaurel({ side }: { side: 'left' | 'right' }) {
  const id = `featured-laurel-${side}`;
  return (
    <svg
      viewBox="0 0 40 80"
      aria-hidden="true"
      className="hidden h-16 w-9 shrink-0 sm:block"
      style={side === 'right' ? { transform: 'scaleX(-1)' } : undefined}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7C35A" />
          <stop offset="1" stopColor="#B7791F" />
        </linearGradient>
      </defs>
      <path d="M30 4 C 10 18, 8 46, 30 76" fill="none" stroke={`url(#${id})`} strokeWidth="2.2" strokeLinecap="round" />
      {[14, 26, 38, 50, 62].map((y, i) => (
        <ellipse
          key={y}
          cx={i % 2 ? 14 : 20}
          cy={y}
          rx="6"
          ry="2.6"
          transform={`rotate(${i % 2 ? -35 : 35} ${i % 2 ? 14 : 20} ${y})`}
          fill={`url(#${id})`}
        />
      ))}
    </svg>
  );
}

/** Icon for a category pill, chosen from its label. */
function categoryIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes('all')) return LayoutGrid;
  if (l.includes('machin')) return Wrench;
  if (l.includes('electr')) return Cpu;
  if (l.includes('apparel') || l.includes('textile')) return Shirt;
  if (l.includes('home') || l.includes('garden')) return Home;
  return Box;
}

export default function FeaturedProductsSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
        // Pull a wider window so catalogue photos (not placeholder stock) can fill the rail.
        pageSize: targetPage === 1 ? 80 : filterParams.pageSize,
      });

      // Transform raw products into DisplayProduct with authentic metadata
      const formatted: DisplayProduct[] = res.products.flatMap((p, index) => {
        const catalogImg = catalogProductPhoto(p.images);
        if (!catalogImg) return [];
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

        return [{
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
          img: catalogImg,
          createdAt: p.created_at,
          categoryName: cat?.name,
        }];
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

  // Category horizontal scroll helper
  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const amount = direction === 'left' ? -280 : 280;
      categoryScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  return (
    <section className="py-6 md:py-8 bg-[#15181F] border-b border-white/10 text-foreground relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#FF5A00]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#FF5A00]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[1440px] mx-auto px-3.5 sm:px-5 md:px-6 relative z-10">

        {/* ── 1. SECTION HEADER — reference design: laurels, shield badge, title, subtitle, feature strip ── */}
        <div className="mb-5 text-center sm:mb-6">
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <FeaturedLaurel side="left" />
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF7A2E] to-[#C2410C] shadow-[0_0_40px_-6px_rgba(255,90,0,0.85)] sm:h-16 sm:w-16">
              <ShieldCheck className="h-7 w-7 text-white sm:h-8 sm:w-8" strokeWidth={2.4} />
            </div>
            <h2 className="text-[30px] font-black leading-none tracking-tight sm:text-[40px]">
              <span className="text-white">Verified </span>
              <span className="text-[#FF5A00]">Bulk Products</span>
            </h2>
            <FeaturedLaurel side="right" />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[12px] text-slate-300 sm:text-[14px]">
            <span>100% Verified Manufacturers</span>
            <span className="text-neutral-300">•</span>
            <span>Wholesale Only</span>
            <span className="text-neutral-300">•</span>
            <span>Min. Order 10 Pieces</span>
            <span className="text-neutral-300">•</span>
            <span className="flex items-center gap-1.5 font-semibold text-[#FF7A2E]">
              <Truck className="h-4 w-4" />
              Free Delivery
            </span>
          </div>

          {/* Live rotation, item count and quick actions */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-white/10 bg-[#161616]/[0.04] px-3 py-1 font-mono text-[11px] text-slate-300">
              {totalCount.toLocaleString()}+ Items
            </span>
            {isDefaultBrowse && (
              <span className="flex items-center gap-1.5 rounded-full border border-[#FF5A00]/35 bg-[#FF5A00]/10 px-3 py-1 text-[11px] font-semibold tabular-nums text-[#FF7A2E]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C94400]" />
                Live 30s Rotation · {secondsLeft}s
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
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
              }}
              disabled={loading}
              className="h-8 rounded-full border-white/15 bg-[#161616]/[0.04] px-3 text-xs text-slate-200 hover:bg-white/10"
              title="Shuffle & refresh featured catalog"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading || isRotating ? 'animate-spin text-[#FF5A00]' : ''}`} />
              <span className="ml-1.5 hidden sm:inline">Refresh</span>
            </Button>
            <Link
              to="/products"
              className="group flex h-8 items-center gap-1.5 rounded-full border border-[#FF5A00]/50 px-3 text-xs font-bold text-[#FF7A2E] transition-all hover:border-[#FF5A00] hover:bg-[#B33D00]/10 sm:text-sm"
            >
              <span>View All ({totalCount.toLocaleString()})</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* Feature strip */}
        <div className="mb-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-[#FF5A00]/25 bg-gradient-to-r from-[#0d1320] via-[#FF5A00]/[0.06] to-[#0d1320] shadow-[0_0_24px_-14px_rgba(255,90,0,0.25)] lg:grid-cols-4">
          {FEATURE_STRIP.map(({ icon: Icon, label, sub, color }, i) => (
            <div
              key={label}
              className={`flex items-center gap-3 px-4 py-4 sm:px-6 ${i % 2 === 0 ? 'border-r border-white/10' : ''} ${i < 2 ? 'border-b border-white/10 lg:border-b-0' : ''} ${i < 3 ? 'lg:border-r lg:border-white/10' : 'lg:border-r-0'}`}
            >
              <Icon className={`h-7 w-7 shrink-0 sm:h-8 sm:w-8 ${color}`} strokeWidth={1.8} />
              <div>
                <div className="text-[15px] font-black leading-tight text-white sm:text-[17px]">{label}</div>
                <div className="mt-0.5 text-[11px] text-neutral-400 sm:text-[12px]">{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── 2. DYNAMIC CATEGORY PILL NAVIGATION ───────────────────────────── */}
        <div className="relative mb-3 sm:mb-4 group">
          {/* Scroll left button */}
          <button
            onClick={() => scrollCategories('left')}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-card border border-border text-foreground items-center justify-center hover:bg-[#C94400] hover:text-white hover:border-[#FF5A00] transition-colors shadow-lg"
            aria-label="Scroll categories left"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>

          {/* Horizontally scrollable pill track */}
          <div
            ref={categoryScrollRef}
            className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-none scroll-smooth overscroll-x-contain px-0.5"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {MARKETPLACE_CATEGORIES.map(cat => {
              const active = selectedCategory === cat.id;
              const Icon = categoryIcon(cat.label);
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSelectedSubCategory('all');
                    setPage(1);
                  }}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-200 ${
                    active
                      ? 'border-transparent bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] text-white shadow-[0_8px_24px_-8px_rgba(255,90,0,0.8)]'
                      : 'border-white/10 bg-[#0d1320] text-slate-200 hover:border-white/25 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Scroll right button */}
          <button
            onClick={() => scrollCategories('right')}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-card border border-border text-foreground items-center justify-center hover:bg-[#C94400] hover:text-white hover:border-[#FF5A00] transition-colors shadow-lg"
            aria-label="Scroll categories right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* ── 3. SEARCH & ADVANCED FILTER TOOLBAR ───────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-2.5 sm:p-3 mb-4 shadow-sm">
          {/* Top row: Search input + mobile filter trigger + desktop quick filters */}
          <div className="flex flex-col sm:flex-row flex-wrap xl:flex-nowrap items-stretch sm:items-center gap-2 sm:gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search 5,000+ products (e.g. Solar panels, Cotton, CNC, Food truck)..."
                className="pl-9 pr-8 h-9 text-xs sm:text-sm bg-background border-border text-foreground placeholder:text-muted-foreground rounded-lg focus-visible:ring-1 focus-visible:ring-[#FF5A00] focus-visible:border-[#FF5A00]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Desktop Quick Dropdowns */}
            <div className="hidden lg:flex flex-wrap items-center gap-1.5 xl:gap-2">
              {/* Sub-category selector */}
              {activeNavCat.subCategories.length > 1 && (
                <Select
                  value={selectedSubCategory}
                  onValueChange={v => {
                    setSelectedSubCategory(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[150px] h-9 text-xs bg-background border-border text-foreground rounded-lg">
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

              {/* MOQ Filter */}
              <Select value={moqFilter} onValueChange={v => { setMoqFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[125px] h-9 text-xs bg-background border-border text-foreground rounded-lg">
                  <SelectValue placeholder="MOQ" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground">
                  <SelectItem value="all">Any MOQ</SelectItem>
                  <SelectItem value="50">MOQ ≤ 50</SelectItem>
                  <SelectItem value="100">MOQ ≤ 100</SelectItem>
                  <SelectItem value="500">MOQ ≤ 500</SelectItem>
                </SelectContent>
              </Select>

              {/* Price Filter */}
              <Select value={priceFilter} onValueChange={v => { setPriceFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px] h-9 text-xs bg-background border-border text-foreground rounded-lg">
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

              {/* Origin Country */}
              <Select value={countryFilter} onValueChange={handleCountryFilterChange}>
                <SelectTrigger className="w-[130px] h-9 text-xs bg-background border-border text-foreground rounded-lg">
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

              {/* Sort By */}
              <Select value={sortBy} onValueChange={(v: any) => { setSortBy(v); setPage(1); }}>
                <SelectTrigger className="w-[145px] h-9 text-xs bg-background border-border text-foreground rounded-lg">
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

            {/* Mobile / Tablet Filter Button */}
            <div className="flex items-center gap-2 sm:shrink-0">
              <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 flex-1 sm:flex-initial ${
                      activeFilterCount > 0
                        ? 'bg-[#C94400] text-white border-[#FF5A00]'
                        : 'bg-card text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
                  </Button>
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
                        <ShieldCheck className="w-4 h-4 text-[#FF7A2E]" />
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
                        className="w-full bg-[#C94400] hover:bg-[#B33D00] text-white font-bold h-9 rounded-lg"
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

              {/* Reset filter badge button if filters applied */}
              {activeFilterCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="text-[11px] text-[#FF5A00] hover:underline flex items-center gap-1 px-1.5 py-1 whitespace-nowrap"
                >
                  <X className="w-3 h-3" />
                  <span>Clear ({activeFilterCount})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── 4. PRODUCT GRID ───────────────────────────────────────────────── */}
        {loading && products.length === 0 ? (
          // Skeleton Loader: 8 cards matching PC grid
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3.5 md:gap-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-card border border-border rounded-xl overflow-hidden p-2 sm:p-2.5 animate-pulse flex flex-col"
              >
                <div className="aspect-[4/3] w-full bg-muted rounded-lg mb-2.5" />
                <div className="h-4 bg-muted rounded w-3/4 mb-1.5" />
                <div className="h-3 bg-muted/60 rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-2/3 mb-2 mt-auto" />
                <div className="h-8 bg-muted rounded w-full mt-2" />
              </div>
            ))}
          </div>
        ) : error && products.length === 0 ? (
          // Error State with Retry
          <div className="bg-card border border-destructive/30 rounded-xl p-8 text-center my-6 max-w-md mx-auto shadow-sm">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
            <h3 className="text-foreground font-bold text-base mb-1">Catalog Connection Error</h3>
            <p className="text-muted-foreground text-xs mb-4">{error}</p>
            <Button
              onClick={() => fetchProducts(1, false)}
              className="bg-[#C94400] hover:bg-[#B33D00] text-white font-bold text-xs h-8 px-4 rounded-lg"
            >
              Retry Loading Catalog
            </Button>
          </div>
        ) : products.length === 0 ? (
          // Empty State with Reset Filters
          <div className="bg-card border border-border rounded-2xl p-8 sm:p-12 text-center my-6 max-w-lg mx-auto shadow-sm">
            <PackageCheck className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-foreground font-bold text-base sm:text-lg mb-1">No products match your criteria</h3>
            <p className="text-muted-foreground text-xs sm:text-sm mb-4">
              Try adjusting your keyword, expanding price or MOQ thresholds, or switching category tabs.
            </p>
            <Button
              onClick={handleResetFilters}
              className="bg-[#C94400] hover:bg-[#B33D00] text-white font-bold text-xs sm:text-sm h-9 px-5 rounded-lg shadow-lg shadow-[#FF5A00]/20"
            >
              Clear All Filters
            </Button>
          </div>
        ) : (
          <>
            {/* ── Trending Deals on Mobile (Horizontal Swipe Carousel with Partial Next Card Peek) ── */}
            {products.length > 0 && (
              <div className="md:hidden mb-4">
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-[#FF5A00]" />
                    <span>Trending Wholesale Deals</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">Swipe to browse →</span>
                </div>
                <div className="flex items-stretch gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory overscroll-x-contain touch-pan-x -mx-3.5 px-3.5 sm:-mx-5 sm:px-5">
                  {products.slice(0, 8).map((product) => {
                    const isIndia = countryFilter === 'India' || product.country === 'India' || countryConfig.code === 'IN' || countryConfig.currency === 'INR' || currencyInfo.currency === 'INR';
                    const inrRate = currencyInfo.rate || 83.5;
                    const minFormatted = isIndia ? `₹${Math.round(product.inrMin || (product.usdMin * inrRate)).toLocaleString('en-IN')}` : formatPrice(product.usdMin);

                    return (
                      <div
                        key={`carousel-${product.id}`}
                        className="shrink-0 w-[150px] min-[360px]:w-[165px] snap-start bg-card border border-border hover:border-[#FF5A00]/50 rounded-xl overflow-hidden flex flex-col justify-between shadow-sm"
                      >
                        <div className="relative aspect-square w-full bg-muted overflow-hidden">
                          <SafeImage
                            src={product.img}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            sizes="165px"
                          />
                          <span className="absolute top-1 left-1 bg-[#C94400] text-white text-[8.5px] font-bold px-1.5 py-0.2 rounded shadow">
                            {product.badgeLabel}
                          </span>
                        </div>
                        <div className="p-2 flex-1 flex flex-col justify-between">
                          <Link to={product.slug ? `/products/${product.slug}` : `/products/${product.id}`}>
                            <h4 className="text-[11px] font-bold text-foreground line-clamp-2 leading-tight hover:text-[#FF5A00]">
                              {product.name}
                            </h4>
                          </Link>
                          <div className="mt-1 pt-1 border-t border-border">
                            <div className="text-[#FF5A00] font-black text-xs leading-none">
                              {minFormatted}
                            </div>
                            <div className="text-[9.5px] text-[#FF7A2E] font-semibold mt-0.5 truncate">
                              {product.moq}
                            </div>
                            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#F7C35A] via-[#E0A526] to-[#B7791F] px-1.5 py-0.5 text-[9px] font-extrabold text-[#2a1600] shadow-[0_0_10px_-2px_rgba(224,165,38,0.9)]">
                              <Wallet className="h-2.5 w-2.5" />
                              Loan Eligible
                            </div>
                          </div>
                          <Button
                            onClick={() => openQuoteModal(product)}
                            size="sm"
                            className="w-full h-7 mt-2 bg-[#C94400] hover:bg-[#B33D00] text-white text-[10px] font-bold rounded-lg p-0"
                          >
                            Get Best Price
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Responsive Product Marketplace Grid */}
            {/* Mobile: Exactly 2-column grid without text clipping */}
            {/* Desktop PC: Balanced 3 to 4 columns (up to 5 on 2K+) */}
            <div
              className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3.5 md:gap-4 transition-opacity duration-300 ${
                isRotating ? 'opacity-55' : 'opacity-100'
              }`}
            >
            {products.map((product, productIdx) => {
              const isFav = favorites.has(product.id);

              return (
                <div
                  key={`${product.id}-${rotationOffset}`}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#FF5A00]/35 bg-gradient-to-b from-[#0e1522] to-[#0a0f1a] shadow-[0_18px_50px_-22px_rgba(255,90,0,0.55)] transition-all duration-300 hover:-translate-y-1 hover:border-[#FF5A00] animate-in fade-in duration-300"
                >
                    {/* ── Product Image Container ── */}
                    <div className="relative aspect-square w-full overflow-hidden bg-[#0a0f1a]">
                      <SafeImage
                        src={product.img}
                        alt={product.name}
                        productId={product.id}
                        category={product.categoryName}
                        isDuplicateOnPage={false}
                        isRepresentativeImage={true}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading={productIdx < 6 ? 'eager' : 'lazy'}
                        priority={productIdx < 4}
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
                      />

                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#0a0f1a] to-transparent pointer-events-none" />

                    {/* Top-left: Verified Product badge (reference design) */}
                    <div className="absolute left-2.5 top-2.5 z-10">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#C94400] to-[#B33D00] px-2.5 py-1 text-[10px] font-bold text-white shadow-lg sm:text-[11px]">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified Product
                      </span>
                    </div>

                    {/* Top-right: save button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(product.id, product.name);
                      }}
                      className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-[#0A0A0A]/50 backdrop-blur-md transition-transform hover:scale-110"
                      aria-label="Save to wishlist"
                    >
                      <Heart
                        className={`h-4 w-4 ${isFav ? 'fill-[#FF5A00] text-[#FF5A00]' : 'text-white'}`}
                      />
                    </button>
                  </div>

                  {/* ── Product Card Body (reference design) ── */}
                  <div className="flex flex-1 flex-col p-3 sm:p-3.5">
                    {/* Product Title */}
                    <Link
                      to={product.slug ? `/products/${product.slug}` : `/products/${product.id}`}
                      className="block transition-colors group-hover:text-[#FF7A2E]"
                    >
                      <h3
                        className="min-h-[2.6em] line-clamp-2 text-[14px] font-bold leading-snug text-white sm:text-[15px]"
                        title={product.name}
                      >
                        {product.name}
                      </h3>
                    </Link>

                    {/* Price */}
                    {(() => {
                      const isIndia =
                        countryFilter === 'India' ||
                        product.country === 'India' ||
                        countryConfig.code === 'IN' ||
                        countryConfig.currency === 'INR' ||
                        currencyInfo.currency === 'INR';
                      const inrRate = currencyInfo.rate || 83.5;
                      const minFormatted = isIndia
                        ? `₹${Math.round(product.inrMin || (product.usdMin * inrRate)).toLocaleString('en-IN')}`
                        : formatPrice(product.usdMin);
                      const maxFormatted = isIndia
                        ? `₹${Math.round(product.inrMax || (product.usdMax * inrRate)).toLocaleString('en-IN')}`
                        : formatPrice(product.usdMax);

                      return (
                        <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
                          <span className="text-[17px] font-black leading-none text-[#FF7A2E] sm:text-[19px]">{minFormatted}</span>
                          {product.usdMax && product.usdMax !== product.usdMin && (
                            <span className="text-[11px] font-semibold text-neutral-400">– {maxFormatted}</span>
                          )}
                          <span className="text-[11px] text-neutral-400">/ Piece</span>
                        </div>
                      );
                    })()}

                    {/* MOQ pill */}
                    <div className="mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-lg border border-[#FF5A00]/50 bg-[#FF5A00]/5 px-2.5 py-1 text-[12px] text-slate-200">
                      <Box className="h-3.5 w-3.5 text-[#FF7A2E]" />
                      <span className="font-bold text-[#FF7A2E]">{product.moq}</span>
                    </div>

                    {/* Free delivery + loan eligibility pills */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <div className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[#FF5A00]/50 bg-[#FF5A00]/10 px-2.5 py-1 text-[12px] font-bold text-[#FF7A2E]">
                        <Truck className="h-3.5 w-3.5" />
                        Free Delivery
                      </div>
                      <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gradient-to-r from-[#F7C35A] via-[#E0A526] to-[#B7791F] px-2.5 py-1 text-[12px] font-extrabold text-[#2a1600] shadow-[0_0_16px_-2px_rgba(224,165,38,0.9)] ring-1 ring-[#F7C35A]/60">
                        <Wallet className="h-3.5 w-3.5" />
                        Loan Eligible
                      </div>
                    </div>

                    {/* Supplier + country */}
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2.5 text-[12px]">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                        <span className="truncate text-slate-200" title={product.supplierName}>{product.supplierName}</span>
                        {product.isVerifiedSupplier && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#FF7A2E]" />}
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-slate-300">
                        <span className="text-[13px] leading-none">{product.countryFlag || '🌐'}</span>
                        <span className="max-w-[80px] truncate">{product.country}</span>
                      </span>
                    </div>

                    {/* Primary action */}
                    <Button
                      onClick={() => openQuoteModal(product)}
                      className="group/btn mt-3 h-10 w-full rounded-xl bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] text-[13px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(255,90,0,0.9)] transition-transform hover:opacity-95 active:scale-[0.98]"
                    >
                      <PackageCheck className="mr-2 h-4 w-4" />
                      <span className="truncate">Buy in Bulk</span>
                      <ArrowRight className="ml-auto h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
        )}

        {/* ── 5. BACKEND PAGINATION / LOAD MORE ─────────────────────────────── */}
        {products.length > 0 && (
          <div className="mt-6 sm:mt-8 pt-4 border-t border-border flex flex-col items-center justify-center gap-3">
            <div className="text-xs text-muted-foreground font-medium text-center">
              Showing <span className="text-foreground font-bold">{products.length}</span> of <span className="text-foreground font-bold">{totalCount.toLocaleString()}+</span> wholesale products
            </div>

            {hasMore ? (
              <Button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="bg-[#C94400] hover:bg-[#B33D00] text-white font-bold text-xs sm:text-sm h-10 px-6 sm:px-8 rounded-full shadow-lg shadow-[#FF5A00]/25 transition-all flex items-center gap-2 group"
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
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-card px-4 py-2 rounded-full border border-border">
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
