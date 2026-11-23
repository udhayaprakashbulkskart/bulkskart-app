/**
 * Live Verified Supplier Map (/supplier-map).
 *
 * Buyers anywhere in the world find manufacturers near them (or anywhere). Only businesses that pass every check are
 * returned by the database
 * (map_search_suppliers, migration 00071): registration approved by an admin, factory location verified, active
 * supplier account, at least one active product, not suspended. This page cannot add anyone to the map.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDownWideNarrow, ArrowLeft, BadgeCheck, Crosshair, Factory, List, Loader2, Map as MapIcon, MapPin, RefreshCw,
  Navigation2, Plus, Search, SlidersHorizontal, X,
} from 'lucide-react';
import { toast } from 'sonner';
import MainLayout from '@/components/layouts/MainLayout';
import PageMeta from '@/components/common/PageMeta';
import InstantQuoteDialog from '@/components/common/InstantQuoteDialog';
import ListBusinessPrompt from '@/components/supplierMap/ListBusinessPrompt';
import { SupplierCard, SupplierDetailPanel } from '@/components/supplierMap/SupplierCards';
import type { Bounds } from '@/components/supplierMap/SupplierLeafletMap';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { onMapChange, searchSuppliers, supplierDetail } from '@/lib/supplierMap/api';
import { matchSupplier, type MatchResult, timeAgo } from '@/lib/supplierMap/matchScore';
import { answerListingPrompt, LIST_BUSINESS_SIGNUP_HREF, listBusinessHref, markListingOffered, type PromptAnswer, shouldOfferListing } from '@/lib/supplierMap/listBusinessPrompt';
import { COUNTRY_NAMES, findPlace, normaliseBounds, type Place, placeLabel, RADIUS_OPTIONS, searchPlaces } from '@/lib/supplierMap/places';
import { mapDbError } from '@/lib/supplierMap/registration';
import type { MapProduct, MapSupplier, MapSupplierDetail } from '@/lib/supplierMap/types';
import { cn } from '@/lib/utils';

const SupplierLeafletMap = lazy(() => import('@/components/supplierMap/SupplierLeafletMap'));

const PAGE = 100;
type Sort = 'match' | 'distance' | 'rating';
interface Buyer { lat: number; lng: number; label: string }
interface Filters { category: string; country: string; orderQty: string; minCapacity: string; verified: boolean; gst: boolean; cin: boolean; udyam: boolean }
const NO_FILTERS: Filters = { category: '', country: '', orderQty: '', minCapacity: '', verified: false, gst: false, cin: false, udyam: false };
const num = (v: string) => (v.trim() && Number(v) > 0 ? Number(v) : null);

function useIsDesktop() {
  const q = '(min-width: 1024px)';
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

export default function SupplierMapPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const desktop = useIsDesktop();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // ── search state (q, city and radius are kept in the address so a search can be shared) ──
  const initialCity = findPlace(params.get('city') ?? '');
  const [input, setInput] = useState(params.get('q') ?? '');
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [buyer, setBuyer] = useState<Buyer | null>(initialCity ? { lat: initialCity.lat, lng: initialCity.lng, label: placeLabel(initialCity) } : null);
  const [radius, setRadius] = useState<number | null>(() => {
    const r = Number(params.get('r'));
    return initialCity && RADIUS_OPTIONS.some((o) => o.km === r) ? r : null;
  });
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [area, setArea] = useState<Bounds | null>(null);
  const [moved, setMoved] = useState<Bounds | null>(null);
  const [sort, setSort] = useState<Sort>('match');
  const [view, setView] = useState<'map' | 'list'>('map');
  const [showFilters, setShowFilters] = useState(false);
  const [showPlaces, setShowPlaces] = useState(false);
  const [pendingRadius, setPendingRadius] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [centre, setCentre] = useState<{ lat: number; lng: number } | null>(null);
  const [prompt, setPrompt] = useState(false);

  // ── results ──
  const [rows, setRows] = useState<MapSupplier[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [, tick] = useState(0);
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);

  // ── selection ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<MapSupplierDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [quote, setQuote] = useState<{ s: MapSupplier; p: MapProduct } | null>(null);

  const req = useRef(0);
  const carousel = useRef<HTMLDivElement>(null);

  const searchParams = useMemo(
    () => ({
      query,
      lat: buyer?.lat ?? null,
      lng: buyer?.lng ?? null,
      radiusKm: area ? null : radius,
      category: filters.category || null,
      country: filters.country || null,
      maxMoq: num(filters.orderQty),
      minCapacity: num(filters.minCapacity),
      requireGst: filters.gst,
      requireCin: filters.cin,
      requireUdyam: filters.udyam,
      verifiedOnly: filters.verified,
      bounds: area ? normaliseBounds(area) : null,
    }),
    [query, buyer, radius, filters, area],
  );

  const run = useCallback(async (opts: { refit: boolean; silent?: boolean }) => {
    const id = ++req.current;
    if (!opts.silent) setLoading(true);
    const { rows: r, total: t, error: e } = await searchSuppliers({ ...searchParams, limit: PAGE, offset: 0 });
    if (id !== req.current) return;
    setLoading(false);
    if (e) {
      setError(mapDbError(e));
      if (!opts.silent) setRows([]);
      return;
    }
    setError(null);
    setRows(r);
    setTotal(t);
    setUpdatedAt(Date.now());
    if (opts.refit) setFitKey((k) => k + 1);
  }, [searchParams]);

  // a new search frames the results; "search this area" keeps the view
  const areaRef = useRef(area);
  useEffect(() => {
    const areaChanged = areaRef.current !== area;
    areaRef.current = area;
    run({ refit: !areaChanged || !area });
    setMoved(null);
  }, [run, area]);

  // keep q / city / radius in the address
  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (buyer && findPlace(buyer.label)) next.set('city', buyer.label);
    if (buyer && radius) next.set('r', String(radius));
    setParams(next, { replace: true });
  }, [query, buyer, radius, setParams]);

  // typing searches after a short pause
  useEffect(() => {
    const t = setTimeout(() => {
      const v = input.trim();
      if (v !== query && (v.length === 0 || v.length >= 2)) {
        setArea(null);
        setQuery(v);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [input, query]);

  // live: approvals, availability, products and suspensions show up without reloading
  const runRef = useRef(run);
  runRef.current = run;
  const selRef = useRef(selectedId);
  selRef.current = selectedId;
  useEffect(() => onMapChange(() => {
    runRef.current({ refit: false, silent: true });
    if (selRef.current) loadDetailRef.current(selRef.current);
  }), []);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    supabase.from('categories').select('name,slug').is('parent_id', null).eq('is_active', true).order('name').then(({ data }) => setCategories((data ?? []) as { slug: string; name: string }[]));
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    const { detail: d } = await supplierDetail(id, buyer?.lat, buyer?.lng);
    if (selRef.current !== id) return;
    setDetailLoading(false);
    setDetail(d);
    // the supplier left the map (suspended, location changed) while open
    if (!d) {
      setOpen(false);
      setSelectedId(null);
    }
  }, [buyer]);
  const loadDetailRef = useRef(loadDetail);
  loadDetailRef.current = loadDetail;

  const select = useCallback((id: string, openDetails = true) => {
    setSelectedId(id);
    if (openDetails) {
      setOpen(true);
      setDetail(null);
      loadDetail(id);
    }
  }, [loadDetail]);

  // the selected supplier is no longer in the results
  useEffect(() => {
    if (selectedId && !rows.some((r) => r.company_id === selectedId)) {
      setSelectedId(null);
      setOpen(false);
    }
  }, [rows, selectedId]);

  const loadMore = async () => {
    setLoadingMore(true);
    const id = req.current;
    const { rows: r, error: e } = await searchSuppliers({ ...searchParams, limit: PAGE, offset: rows.length });
    setLoadingMore(false);
    if (id !== req.current || e) return;
    setRows((prev) => [...prev, ...r.filter((x) => !prev.some((p) => p.company_id === x.company_id))]);
  };

  // ── match scores and order ──
  const matchInput = useMemo(() => ({ query, orderQty: num(filters.orderQty), minCapacity: num(filters.minCapacity), radiusKm: radius }), [query, filters, radius]);
  const scored = useMemo(() => rows.map((s) => ({ s, m: matchSupplier(s, matchInput) })), [rows, matchInput]);
  const showMatch = Boolean(query || buyer || num(filters.orderQty) || num(filters.minCapacity));
  const sorted = useMemo(() => {
    const list = [...scored];
    const by = sort === 'match' && showMatch ? 'match' : sort === 'match' ? (buyer ? 'distance' : 'rating') : sort;
    if (by === 'match') list.sort((a, b) => b.m.score - a.m.score || (a.s.distance_km ?? 1e9) - (b.s.distance_km ?? 1e9));
    else if (by === 'distance') list.sort((a, b) => (a.s.distance_km ?? 1e9) - (b.s.distance_km ?? 1e9));
    else list.sort((a, b) => (Number(b.s.rating) || 0) - (Number(a.s.rating) || 0) || (b.s.review_count ?? 0) - (a.s.review_count ?? 0));
    return list;
  }, [scored, sort, showMatch, buyer]);
  const matchOf = (id: string): MatchResult | null => (showMatch ? scored.find((x) => x.s.company_id === id)?.m ?? null : null);
  const selected = rows.find((r) => r.company_id === selectedId) ?? null;

  // ── location ──
  const setBuyerAt = (b: Buyer) => {
    setBuyer(b);
    setArea(null);
    if (pendingRadius !== null) setRadius(pendingRadius);
    setPendingRadius(null);
    setShowPlaces(false);
    setPlaceQuery('');
  };
  const choosePlace = (p: Place) => setBuyerAt({ lat: p.lat, lng: p.lng, label: placeLabel(p) });
  const useMapCentre = () => {
    if (centre) setBuyerAt({ lat: centre.lat, lng: centre.lng, label: 'Map centre' });
  };
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('This browser cannot share its location. Pick your city instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setBuyerAt({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Your location' });
      },
      () => {
        setLocating(false);
        toast.error('Location not shared. Pick your city instead.');
        setShowPlaces(true);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  };
  const pickRadius = (km: number | null) => {
    setArea(null);
    if (km !== null && !buyer) {
      setPendingRadius(km);
      setShowPlaces(true);
      return;
    }
    setRadius(km);
  };

  const openQuote = async (s: MapSupplier, p?: MapProduct) => {
    let product: MapProduct | undefined = p ?? s.matched_products[0] ?? (selectedId === s.company_id ? detail?.products?.[0] : undefined);
    if (!product) product = (await supplierDetail(s.company_id)).detail?.products?.[0];
    if (!product) {
      // no products listed yet: ask through a requirement addressed to this manufacturer
      navigate(`/post-requirement?supplier=${encodeURIComponent(s.company_id)}${query ? `&q=${encodeURIComponent(query)}` : ''}`);
      return;
    }
    setQuote({ s, p: product });
  };

  const activeFilterCount = [filters.category, filters.country, filters.orderQty, filters.minCapacity].filter(Boolean).length + [filters.verified, filters.gst, filters.cin, filters.udyam].filter(Boolean).length;
  const clearAll = () => {
    setInput('');
    setQuery('');
    setFilters(NO_FILTERS);
    setDraft(NO_FILTERS);
    setRadius(null);
    setArea(null);
  };

  // phones: swiping the cards picks the supplier on the map
  const onCarouselScroll = () => {
    const el = carousel.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    if (!first) return;
    const step = first.offsetWidth + 12;
    const i = Math.round(el.scrollLeft / step);
    const s = sorted[i]?.s;
    if (s && s.company_id !== selectedId) select(s.company_id, false);
  };
  useEffect(() => {
    if (desktop || !selectedId || !carousel.current) return;
    const i = sorted.findIndex((x) => x.s.company_id === selectedId);
    const el = carousel.current.children[i] as HTMLElement | undefined;
    if (el && Math.abs(el.offsetLeft - carousel.current.scrollLeft - (carousel.current.clientWidth - el.offsetWidth) / 2) > 8) {
      carousel.current.scrollTo({ left: el.offsetLeft - (carousel.current.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
    }
  }, [selectedId, desktop]);

  // ── layout height: the map fills the window under the site header ──
  const shell = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const fit = () => {
      if (!shell.current) return;
      const top = shell.current.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(window.innerHeight - top, 480));
    };
    fit();
    window.addEventListener('resize', fit);
    const t = setTimeout(fit, 300);
    return () => {
      window.removeEventListener('resize', fit);
      clearTimeout(t);
    };
  }, []);

  // ── "List your business": for visitors who are not signed in (and manufacturers not yet listed) ──
  const listHref = listBusinessHref(profile?.role, Boolean(user));
  // signed-out visitors register; manufacturers already signed in finish their map listing
  const registerHref = listHref ?? LIST_BUSINESS_SIGNUP_HREF;
  const registerLabel = profile?.role === 'supplier' ? 'Put my factory on the map' : 'Register your factory';
  const searched = Boolean(query || buyer || area || activeFilterCount > 0);
  useEffect(() => {
    if (prompt || loading || quote || (open && !desktop)) return;
    if (!shouldOfferListing({ signedIn: Boolean(user), authLoading, searched })) return;
    // let them see the results first; sooner when nothing matched
    const t = setTimeout(() => {
      markListingOffered();
      setPrompt(true);
    }, rows.length === 0 ? 1200 : 3500);
    return () => clearTimeout(t);
  }, [prompt, loading, quote, open, desktop, user, authLoading, searched, rows.length]);
  const answerPrompt = useCallback((a: PromptAnswer) => {
    answerListingPrompt(a);
    setPrompt(false);
  }, []);

  // ── pieces ──
  const searchBar = (
    <div className="pointer-events-auto flex w-full items-center gap-2">
      {!desktop && (
        <button type="button" aria-label="Back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="flex h-12 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#111113]/95 text-white shadow-xl">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
      <label className="relative flex min-w-0 flex-1 items-center">
        <span className="sr-only">Search a product or manufacturer</span>
        <Search className="pointer-events-none absolute left-3.5 z-10 h-[18px] w-[18px] text-[#FF5A00]" aria-hidden="true" />
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setArea(null);
              setQuery(input.trim());
            }
          }}
          placeholder="Search products, e.g. cotton t-shirts"
          className="h-12 w-full rounded-2xl border border-white/10 bg-[#111113]/95 pl-10 pr-3 text-[14px] text-white shadow-xl outline-none backdrop-blur placeholder:text-white/45 focus:border-[#FF5A00] dark:bg-[#111113]/95"
        />
      </label>
      <button type="button" onClick={() => { setDraft(filters); setShowFilters((v) => !v); setShowPlaces(false); }}
        aria-expanded={showFilters} aria-label={`Filters${activeFilterCount ? ` (${activeFilterCount} on)` : ''}`}
        className={cn('relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-xl backdrop-blur', showFilters || activeFilterCount ? 'border-[#FF5A00] bg-[#FF5A00] text-white' : 'border-white/10 bg-[#111113]/95 text-white hover:border-[#FF5A00]')}>
        <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
        {activeFilterCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10.5px] font-black text-[#FF5A00]">{activeFilterCount}</span>}
      </button>
      {!desktop && (
        <button type="button" onClick={() => setView(view === 'map' ? 'list' : 'map')} aria-label={view === 'map' ? 'Show as a list' : 'Show the map'}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#111113]/95 text-white shadow-xl hover:border-[#FF5A00]">
          {view === 'map' ? <List className="h-5 w-5" aria-hidden="true" /> : <MapIcon className="h-5 w-5" aria-hidden="true" />}
        </button>
      )}
    </div>
  );

  const chips = (
    <div className="pointer-events-auto flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible">
      <button type="button" onClick={() => { setShowPlaces((v) => !v); setShowFilters(false); }} aria-expanded={showPlaces}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-[#111113]/95 px-3 text-[12.5px] font-bold text-white shadow-lg hover:border-[#FF5A00]">
        <MapPin className="h-3.5 w-3.5 text-[#FF5A00]" aria-hidden="true" /> <span className="max-w-[180px] truncate">{buyer ? buyer.label : 'Set your location'}</span>
      </button>
      {RADIUS_OPTIONS.map((o) => {
        const on = !area && (o.km === null ? radius === null : radius === o.km && Boolean(buyer));
        return (
          <button key={o.label} type="button" onClick={() => pickRadius(o.km)} aria-pressed={on}
            className={cn('inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-[12.5px] font-bold shadow-lg', on ? 'border-[#FF5A00] bg-[#FF5A00] text-white' : 'border-white/10 bg-[#111113]/95 text-white hover:border-[#FF5A00]')}>
            {o.label}
          </button>
        );
      })}
    </div>
  );

  const placesPanel = showPlaces && (
    <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-card p-3 shadow-2xl">
      <div className="flex items-center justify-between">
        <p className="text-[13.5px] font-black">Where are you buying from?</p>
        <button type="button" onClick={() => { setShowPlaces(false); setPendingRadius(null); }} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
      <p className="text-[11.5px] text-muted-foreground">Used only to measure distance. It is not saved or shared.</p>
      <button type="button" onClick={useMyLocation} disabled={locating}
        className="mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#FF5A00] text-[13px] font-bold text-white hover:bg-[#E04E00] disabled:opacity-60">
        {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" aria-hidden="true" />} Use my current location
      </button>
      <label className="mt-2.5 block text-[12px] font-semibold">
        Or search a city or country
        <span className="relative mt-1 flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input type="search" value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)} placeholder="e.g. Dubai, Shenzhen, Tiruppur, Germany"
            onKeyDown={(e) => { if (e.key === 'Enter') { const p = searchPlaces(placeQuery, 1)[0]; if (p) choosePlace(p); } }}
            className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-[13.5px] outline-none focus:border-[#FF5A00]" />
        </span>
      </label>
      {placeQuery.trim() && (
        <ul className="mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-border" aria-label="Places">
          {searchPlaces(placeQuery).map((p) => (
            <li key={placeLabel(p)}>
              <button type="button" onClick={() => choosePlace(p)} className="flex min-h-[40px] w-full items-center gap-2 px-3 text-left text-[13px] hover:bg-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF5A00]" aria-hidden="true" />
                <span className="font-semibold">{p.name}</span>
                <span className="truncate text-muted-foreground">{[p.region, p.country].filter(Boolean).join(', ')}</span>
              </button>
            </li>
          ))}
          {searchPlaces(placeQuery).length === 0 && (
            <li className="px-3 py-2.5 text-[12px] text-muted-foreground">Not in our list. Move the map there and use "Centre of the map", or share your location.</li>
          )}
        </ul>
      )}
      {centre && (
        <button type="button" onClick={useMapCentre} className="mt-2 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-border text-[12.5px] font-bold hover:border-[#FF5A00]">
          <Navigation2 className="h-4 w-4 text-[#FF5A00]" aria-hidden="true" /> Use the centre of the map
        </button>
      )}
      {buyer && (
        <button type="button" onClick={() => { setBuyer(null); setRadius(null); setShowPlaces(false); }} className="mt-2 text-[12px] font-semibold text-muted-foreground underline-offset-2 hover:underline">
          Clear my location
        </button>
      )}
    </div>
  );

  const filtersPanel = showFilters && (
    <form
      className="pointer-events-auto w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-3.5 shadow-2xl"
      onSubmit={(e) => { e.preventDefault(); setFilters(draft); setArea(null); setShowFilters(false); }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[13.5px] font-black">Filters</p>
        <button type="button" onClick={() => setShowFilters(false)} aria-label="Close filters" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
      <label className="block text-[12px] font-semibold">
        Category
        <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-[13.5px] outline-none focus:border-[#FF5A00]">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </label>
      <label className="block text-[12px] font-semibold">
        Factory country
        <select value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-[13.5px] outline-none focus:border-[#FF5A00]">
          <option value="">All countries</option>
          {COUNTRY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[12px] font-semibold">
          Your order quantity
          <input inputMode="numeric" value={draft.orderQty} onChange={(e) => setDraft({ ...draft, orderQty: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 500"
            className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-[13.5px] outline-none focus:border-[#FF5A00]" />
          <span className="mt-0.5 block text-[10.5px] font-normal text-muted-foreground">Shows MOQ at or below this</span>
        </label>
        <label className="block text-[12px] font-semibold">
          Monthly capacity, at least
          <input inputMode="numeric" value={draft.minCapacity} onChange={(e) => setDraft({ ...draft, minCapacity: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 10000"
            className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-[13.5px] outline-none focus:border-[#FF5A00]" />
        </label>
      </div>
      <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-border px-3">
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold"><BadgeCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" /> Verified by BulkSkart only</span>
        <input type="checkbox" checked={draft.verified} onChange={(e) => setDraft({ ...draft, verified: e.target.checked })} className="h-5 w-5 accent-[#FF5A00]" />
      </label>
      <fieldset>
        <legend className="text-[12px] font-semibold">Indian registration checked by BulkSkart</legend>
        <p className="text-[10.5px] text-muted-foreground">Narrow to verified Indian businesses whose:</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {([['cin', 'CIN / LLPIN'], ['gst', 'GSTIN'], ['udyam', 'Udyam']] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={draft[k]} onClick={() => setDraft({ ...draft, [k]: !draft[k] })}
              className={cn('inline-flex min-h-[36px] items-center gap-1 rounded-full border px-3 text-[12px] font-bold', draft[k] ? 'border-emerald-500 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' : 'border-border hover:border-emerald-500')}>
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => { setDraft(NO_FILTERS); setFilters(NO_FILTERS); setShowFilters(false); }} className="min-h-[44px] flex-1 rounded-xl border border-border text-[13px] font-bold hover:border-[#FF5A00]">Clear</button>
        <button type="submit" className="min-h-[44px] flex-[2] rounded-xl bg-[#FF5A00] text-[13px] font-black text-white hover:bg-[#E04E00]">Show suppliers</button>
      </div>
    </form>
  );

  const live = (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground" aria-live="polite">
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
      Live{updatedAt ? ` · updated ${timeAgo(new Date(updatedAt).toISOString())}` : ''}
    </span>
  );

  const countLine = loading ? 'Searching…' : error ? '' : `${total.toLocaleString('en-IN')}${filters.verified ? ' verified' : ''} manufacturer${total === 1 ? '' : 's'}${query ? ` for "${query}"` : ''}${buyer && radius && !area ? ` within ${radius} km of ${buyer.label}` : area ? ' in this area' : ''}`;

  const empty = !loading && !error && rows.length === 0 && (
    <div className="mx-auto max-w-sm rounded-2xl border border-border bg-card p-5 text-center shadow-xl">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF5A00]/12"><Factory className="h-6 w-6 text-[#FF5A00]" aria-hidden="true" /></span>
      <p className="mt-3 text-[15px] font-black">No manufacturers {query || radius || activeFilterCount || area ? 'match this search' : 'on the map yet'}</p>
      <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">Is your factory missing? Register it and get found by buyers.</p>
      <Link to={registerHref} className="mt-3 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#FF5A00] text-[14px] font-black text-white hover:bg-[#E04E00]">
        <Factory className="h-4 w-4" aria-hidden="true" /> {registerLabel}
      </Link>
    </div>
  );

  const errorBox = error && (
    <div className="mx-auto max-w-sm rounded-2xl border border-border bg-card p-5 text-center shadow-xl">
      <p className="text-[14px] font-black">The map could not load</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">{error}</p>
      <button type="button" onClick={() => run({ refit: false })} className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-border px-4 text-[13px] font-bold hover:border-[#FF5A00]"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again</button>
    </div>
  );

  const sortControl = (
    <label className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
      <ArrowDownWideNarrow className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">Sort by</span>
      <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-lg border border-border bg-background px-1.5 py-1 text-[12px] font-semibold text-foreground outline-none focus:border-[#FF5A00]">
        <option value="match">{showMatch ? 'Best match' : 'Recommended'}</option>
        <option value="distance" disabled={!buyer}>Nearest{buyer ? '' : ' (set location)'}</option>
        <option value="rating">Top rated</option>
      </select>
    </label>
  );

  const list = (cols: string) => (
    <>
      <div className={cn('grid gap-3', cols)}>
        {sorted.map(({ s }) => (
          <SupplierCard key={s.company_id} s={s} match={matchOf(s.company_id)} selected={s.company_id === selectedId} onSelect={() => select(s.company_id)} onQuote={() => openQuote(s)} />
        ))}
      </div>
      {rows.length < total && (
        <button type="button" onClick={loadMore} disabled={loadingMore} className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-border text-[13px] font-bold hover:border-[#FF5A00]">
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Show more ({(total - rows.length).toLocaleString('en-IN')} left)
        </button>
      )}
    </>
  );

  const mapEl = (
    <Suspense fallback={<div className="flex h-full w-full items-center justify-center bg-[#0b0b0d]"><Loader2 className="h-7 w-7 animate-spin text-[#FF5A00]" /></div>}>
      <SupplierLeafletMap
        className={cn('bsm-map h-full w-full', theme === 'light' && 'bsm-light', !desktop && 'bsm-nozoom')}
        suppliers={rows}
        selectedId={selectedId}
        onSelect={(id) => select(id, desktop)}
        buyer={buyer}
        radiusKm={area ? null : radius}
        theme={theme}
        fitKey={fitKey}
        onUserMove={(b) => setMoved(b)}
        onView={setCentre}
        padding={desktop ? { top: 130, bottom: 30, left: 30, right: 30 } : { top: 140, bottom: open ? 40 : 250 }}
      />
    </Suspense>
  );

  const searchArea = moved && !loading && (
    <button type="button" onClick={() => { setRadius(null); setArea(moved); }}
      className="pointer-events-auto mx-auto inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-white px-4 text-[12.5px] font-black text-[#111] shadow-xl hover:bg-[#FF5A00] hover:text-white">
      <Search className="h-3.5 w-3.5" aria-hidden="true" /> Search this area
    </button>
  );

  const viewToggle = (
    <div className="pointer-events-auto inline-flex rounded-2xl border border-white/10 bg-[#111113]/95 p-1 shadow-xl" role="group" aria-label="View">
      {([['map', MapIcon, 'Map'], ['list', List, 'List']] as const).map(([v, Icon, label]) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
          className={cn('inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-bold', view === v ? 'bg-[#FF5A00] text-white' : 'text-white/75 hover:text-white')}>
          <Icon className="h-4 w-4" aria-hidden="true" /> {label}
        </button>
      ))}
    </div>
  );

  return (
    <MainLayout hideFooter>
      <PageMeta
        title="Live Verified Supplier Map – Find Manufacturers Near You, Worldwide | BulkSkart"
        description="Find verified manufacturers and wholesale suppliers near you, anywhere in the world, on a live map. Every factory is checked by BulkSkart: registration, location and active products. Search by product, distance, country, MOQ and capacity."
        keywords="verified manufacturers near me, supplier map, factory near me, global manufacturers directory, bulk suppliers worldwide, wholesale suppliers map, Indian manufacturers"
        canonical="https://www.bulkskart.com/supplier-map"
      />
      <h1 className="sr-only">Live Verified Supplier Map</h1>
      {/* desktop: under the site header; phones: the whole screen, like a maps app (z-40: over the header, under dialogs) */}
      <div ref={shell} className={cn('w-full overflow-hidden bg-[#0b0b0d]', desktop ? 'relative -mb-12 sm:-mb-16 md:-mb-20' : 'fixed inset-0 z-40 h-[100dvh]')} style={desktop ? { height: height ?? '78vh' } : undefined}>
        {desktop ? (
          <div className="flex h-full">
            <div className="relative min-w-0 flex-1">
              {view === 'map' ? mapEl : (
                <div className="h-full overflow-y-auto bg-background px-5 pb-6 pt-[132px]">
                  {error ? errorBox : rows.length === 0 && !loading ? empty : list('grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3')}
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] space-y-2 bg-gradient-to-b from-black/50 to-transparent p-4">
                <div className="flex items-start gap-3">
                  <div className="w-full max-w-2xl space-y-2">{searchBar}{chips}</div>
                  <div className="ml-auto">{viewToggle}</div>
                </div>
                <div className="flex gap-3">{placesPanel}{filtersPanel}</div>
                {view === 'map' && <div className="flex">{searchArea}</div>}
              </div>
              {view === 'map' && (error || (rows.length === 0 && !loading)) && (
                <div className="absolute inset-x-0 bottom-8 z-[500] px-4">{errorBox || empty}</div>
              )}
            </div>
            <aside className="flex w-[400px] shrink-0 flex-col border-l border-border bg-background" aria-label="Suppliers">
              {open && selected ? (
                <SupplierDetailPanel s={selected} detail={detail} loading={detailLoading} match={matchOf(selected.company_id)} onClose={() => setOpen(false)} onQuote={(p) => openQuote(selected, p)} />
              ) : (
                <>
                  <div className="shrink-0 space-y-1 border-b border-border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-[16px] font-black">Manufacturers on the map</h2>
                      {live}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12.5px] text-muted-foreground">{countLine}</p>
                      {rows.length > 1 && sortControl}
                    </div>
                    {listHref && (
                      <Link to={listHref} className="mt-2 flex min-h-[40px] items-center justify-between gap-2 rounded-xl border border-[#FF5A00]/40 bg-[#FF5A00]/8 px-3 text-[12.5px] font-bold hover:border-[#FF5A00]">
                        <span className="flex items-center gap-1.5"><Factory className="h-4 w-4 text-[#FF5A00]" aria-hidden="true" /> Manufacturer?</span>
                        <span className="text-[#E04E00] dark:text-[#FF8A3D]">{registerLabel} →</span>
                      </Link>
                    )}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    {loading && rows.length === 0 ? (
                      <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />)}</div>
                    ) : rows.length === 0 ? (
                      <div className="p-3 text-center text-[12.5px] text-muted-foreground">
                        <Factory className="mx-auto mb-2 h-8 w-8 text-[#FF5A00]" aria-hidden="true" />
                        Manufacturers with an active BulkSkart plan appear here. A green check means BulkSkart has verified them.
                      </div>
                    ) : view === 'map' ? list('grid-cols-1') : (
                      <p className="p-3 text-center text-[12.5px] text-muted-foreground">Pick a supplier to see the details here.</p>
                    )}
                  </div>
                </>
              )}
            </aside>
          </div>
        ) : (
          <>
            {view === 'map' ? <div className="absolute inset-0">{mapEl}</div> : (
              <div className="absolute inset-0 overflow-y-auto bg-background px-3 pb-6 pt-[128px]">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[12.5px] text-muted-foreground">{countLine}</p>
                  {rows.length > 1 && sortControl}
                </div>
                {error ? errorBox : rows.length === 0 && !loading ? empty : list('grid-cols-1')}
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] space-y-2 bg-gradient-to-b from-black/55 to-transparent p-3">
              {searchBar}
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">{chips}</div>
              </div>
              {placesPanel}
              {filtersPanel}
              {view === 'map' && <div className="flex justify-center">{searchArea}</div>}
            </div>

            {view === 'map' && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] pb-3">
                {error || (rows.length === 0 && !loading) ? (
                  <div className="pointer-events-auto px-3">{errorBox || empty}</div>
                ) : (
                  <>
                    {listHref && (
                      <div className="mx-3 mb-2 flex justify-end">
                        <Link to={listHref} className="pointer-events-auto inline-flex min-h-[36px] items-center gap-1 rounded-full bg-[#FF5A00] px-3.5 text-[12px] font-black text-white shadow-lg">
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {registerLabel}
                        </Link>
                      </div>
                    )}
                    <div className="pointer-events-auto mx-3 mb-2 flex items-center justify-between rounded-full bg-[#111113]/90 px-3 py-1.5 text-white shadow-lg">
                      <span className="truncate text-[11.5px] font-semibold">{countLine}</span>
                      <span className="ml-2 shrink-0 [&_span]:text-white/70">{live}</span>
                    </div>
                    <div ref={carousel} onScroll={onCarouselScroll} className="bsm-snap pointer-events-auto flex gap-3 overflow-x-auto px-[7%]" aria-label="Suppliers, swipe to browse">
                      {loading && rows.length === 0
                        ? [0, 1].map((i) => <div key={i} className="h-[178px] w-[86%] shrink-0 animate-pulse rounded-2xl bg-card" />)
                        : sorted.map(({ s }) => (
                            <div key={s.company_id} className="w-[86%] max-w-[380px] shrink-0">
                              <SupplierCard compact s={s} match={matchOf(s.company_id)} selected={s.company_id === selectedId} onSelect={() => select(s.company_id)} onQuote={() => openQuote(s)} />
                            </div>
                          ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {open && selected && (
              <div className="fixed inset-0 z-[1200] flex flex-col justify-end bg-black/50" role="dialog" aria-modal="true" aria-label={selected.company_name}>
                <button type="button" className="min-h-0 flex-1" aria-label="Close details" onClick={() => setOpen(false)} />
                <div className="h-[88dvh] overflow-hidden rounded-t-3xl bg-background shadow-2xl">
                  <SupplierDetailPanel s={selected} detail={detail} loading={detailLoading} match={matchOf(selected.company_id)} onClose={() => setOpen(false)} onQuote={(p) => openQuote(selected, p)} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {prompt && listHref && !user && <ListBusinessPrompt href={listHref} onAnswer={answerPrompt} />}

      {quote && (
        <InstantQuoteDialog
          open
          onOpenChange={(o) => { if (!o) setQuote(null); }}
          productId={quote.p.id}
          productName={quote.p.name}
          supplierCompanyId={quote.s.company_id}
          supplierName={quote.s.company_name}
          moq={quote.p.moq ? Number(quote.p.moq) : 1}
          moqUnit={quote.p.moq_unit ?? 'Pcs'}
        />
      )}
    </MainLayout>
  );
}
