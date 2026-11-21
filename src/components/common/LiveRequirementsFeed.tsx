/**
 * Live RFQ — buying requirements on the home page, laid out from the BulkSkart "Live RFQ" design picture.
 *
 * - Real database records only: active requirements, 10 per page, filtered on the server.
 * - Live: new requirements appear at the top as they are posted (realtime), counts refresh every minute and each
 *   card counts down to the buyer's deadline.
 * - Listings taken from tender portals or other websites are left out (see lib/rfqSources).
 * - Submit Quotation opens the existing supplier quote dialog (permissions and quota checks kept).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight, Bookmark, Box, CalendarDays, CheckCircle2, ChevronDown, Clock, Coins, Crown, FileText, Filter, Flame,
  BellOff, BellRing, Handshake, Layers, LayoutGrid, Loader2, Lock, MapPin, Plus, Sparkles, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { checkDirectMessageQuota, checkSupplierPaidSubscription } from '@/lib/api';
import type { Requirement } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import SubscribeToContactDialog, { type SubscriptionReason } from '@/components/common/SubscribeToContactDialog';
import RequirementDetailDrawer from '@/components/common/RequirementDetailDrawer';
import SafeImage from '@/components/common/SafeImage';
import SupplierRespondDialog from '@/components/common/SupplierRespondDialog';
import { getRequirementVisualInfo } from '@/lib/requirementVisuals';
import { formatMoney } from '@/lib/productPrice';
import { isOutsideListing } from '@/lib/rfqSources';
import { isMissingColumnError, isPublicListing } from '@/lib/publicListings';
import { RFQ_ALERTS_EVENT, rfqAlertsOff, setRfqAlertsOff } from '@/lib/rfqAlerts';
import { INCLUDE_TEMPLATE_SEED_DATA, isSeededRequirement, SEEDED_RFQ_TITLE_LIKE } from '@/lib/seedData';

const PAGE_SIZE = 10;
const REQ_SELECT = '*, profiles!buyer_id(id,full_name,email), categories!category_id(id,name,slug)';
const SAVED_KEY = 'bulkskart_saved_rfqs';
const HOUR = 3600e3;
const URGENT_BADGE_HOURS = 6; // red badge: ends within 6 hours
const URGENT_FILTER_HOURS = 24; // Urgent filter: ends within a day, soonest first
const NEW_HOURS = 48;
const HIGH_VALUE_INR = 500000;

type Quick = 'all' | 'urgent' | 'new' | 'high' | 'mine';

const QUICK_FILTERS: Array<{ id: Quick; label: string; icon: typeof LayoutGrid }> = [
  { id: 'all', label: 'All RFQs', icon: LayoutGrid },
  { id: 'urgent', label: 'Urgent', icon: Flame },
  { id: 'new', label: 'New', icon: Sparkles },
  { id: 'high', label: 'High Value', icon: Coins },
  { id: 'mine', label: 'My RFQs', icon: Bookmark },
];

// Each option maps to the real `categories.slug` values in the database (filtered on the server).
const CATEGORIES: Array<{ id: string; name: string; slugs: string[] }> = [
  { id: 'all', name: 'All Categories', slugs: [] },
  { id: 'machinery', name: 'Machinery & Equipment', slugs: ['machinery-industrial'] },
  { id: 'textiles', name: 'Textiles & Apparel', slugs: ['textiles-apparel'] },
  { id: 'electronics', name: 'Electrical & Electronics', slugs: ['electronics-electricals'] },
  { id: 'packaging', name: 'Packaging', slugs: ['packaging'] },
  { id: 'chemicals', name: 'Chemicals & Plastics', slugs: ['chemicals-raw-materials', 'plastics-rubber'] },
  { id: 'construction', name: 'Construction', slugs: ['construction-building'] },
  { id: 'agriculture', name: 'Agriculture & Food', slugs: ['agriculture-food'] },
  { id: 'auto', name: 'Auto Parts', slugs: ['auto-parts-vehicles'] },
  { id: 'pharma', name: 'Pharma & Healthcare', slugs: ['pharma-healthcare'] },
];

const LOCATIONS = ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Ahmedabad', 'Coimbatore', 'Surat', 'Jaipur', 'Ludhiana', 'Trichy', 'Kochi'];

const PROMISES = ['Genuine Buyers', 'Bulk Orders', 'Direct Quotation', 'High Opportunity'];

// Pictures from the design, used when an RFQ is for the same kind of product and has no picture of its own
const DESIGN_PICTURES: Array<[RegExp, string]> = [
  [/\bfryer\b/i, '/home-design/rfq-fryer.jpg'],
  [/\b(t-?shirts?|polo shirts?|tees?)\b/i, '/home-design/rfq-tshirts.jpg'],
  [/\b(computer|laptops?|desktops?|ram|ssd|hdd|motherboards?|monitors?|cpu)\b/i, '/home-design/rfq-computer.jpg'],
  [/\b(gas stoves?|stoves?|burners?|cooktops?)\b/i, '/home-design/rfq-stove.jpg'],
];

function readSaved(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw.filter((v) => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeSaved(ids: Set<string>) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable: saving lasts for this visit only */
  }
}

function endsIn(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

function postedOn(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isMultiProduct(title: string): boolean {
  return /\([^)]*,[^)]*,[^)]*\)/.test(title) || (title.match(/,/g) ?? []).length >= 3;
}

type Badge = { label: string; icon: typeof Flame; className: string };

/** One badge per RFQ, from its real budget, title, deadline and posting time (in that order). */
function primaryBadge(req: Requirement, now: number, fresh: boolean): Badge | null {
  const deadline = req.deadline ? new Date(req.deadline).getTime() : null;
  if ((req.currency || 'INR') === 'INR' && Number(req.budget_max) >= HIGH_VALUE_INR) {
    return { label: 'High Value', icon: Crown, className: 'bg-[#F7C531] text-[#1A1200]' };
  }
  if (isMultiProduct(req.title || '')) {
    return { label: 'Multi-Product RFQ', icon: Layers, className: 'bg-[#8B3DFF] text-white' };
  }
  if (deadline && deadline > now && deadline - now <= URGENT_BADGE_HOURS * HOUR) {
    return { label: 'Urgent RFQ', icon: Flame, className: 'bg-[#E5322D] text-white' };
  }
  if (fresh || (req.created_at && now - new Date(req.created_at).getTime() <= NEW_HOURS * HOUR)) {
    return { label: 'New RFQ', icon: Sparkles, className: 'bg-[#1DB954] text-white' };
  }
  return null;
}

function compactCount(n: number | null): string {
  if (n === null) return '—';
  return n > 0 ? `${n.toLocaleString('en-IN')}+` : '0';
}

export default function LiveRequirementsFeed() {
  const { user, profile, company } = useAuth();
  const reduce = useReducedMotion();

  const [items, setItems] = useState<Requirement[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quick, setQuick] = useState<Quick>('all');
  const [category, setCategory] = useState('all');
  const [location, setLocation] = useState('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(() => readSaved());

  const [counts, setCounts] = useState<{ live: number | null; buyers: number | null; value: number | null; industries: number | null }>({ live: null, buyers: null, value: null, industries: null });
  const [now, setNow] = useState(() => Date.now());
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogReason, setDialogReason] = useState<SubscriptionReason>('not_logged_in');
  const [detailReq, setDetailReq] = useState<Requirement | null>(null);
  const [respondReq, setRespondReq] = useState<Requirement | null>(null);

  const sectionRef = useRef<HTMLElement>(null);
  const filtersRef = useRef({ quick, category, location, verifiedOnly, saved, userId: user?.id });
  filtersRef.current = { quick, category, location, verifiedOnly, saved, userId: user?.id };

  // ── Database: a page of active requirements for the chosen filters ─────
  const fetchPage = useCallback(async (pageNo: number): Promise<Requirement[]> => {
    const f = filtersRef.current;
    const from = pageNo * PAGE_SIZE;
    const nowIso = new Date().toISOString();
    const cat = CATEGORIES.find((c) => c.id === f.category);
    const bySlug = !!cat && cat.slugs.length > 0;
    if (f.quick === 'mine' && !f.userId && f.saved.size === 0) return [];
    let query = supabase
      .from('requirements')
      .select(bySlug ? REQ_SELECT.replace('categories!category_id(', 'categories!category_id!inner(') : REQ_SELECT)
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .or(`deadline.is.null,deadline.gt.${nowIso}`);
    // demonstration rows from the template migrations are never shown as live demand
    if (!INCLUDE_TEMPLATE_SEED_DATA) query = query.not('title', 'like', SEEDED_RFQ_TITLE_LIKE);
    if (bySlug) query = query.in('categories.slug', cat!.slugs);
    if (f.location !== 'all') query = query.ilike('destination_city', `%${f.location}%`);
    if (f.verifiedOnly) query = query.eq('is_verified_buyer', true);
    if (f.quick === 'urgent') query = query.lte('deadline', new Date(Date.now() + URGENT_FILTER_HOURS * HOUR).toISOString());
    if (f.quick === 'new') query = query.gte('created_at', new Date(Date.now() - NEW_HOURS * HOUR).toISOString());
    if (f.quick === 'high') query = query.eq('currency', 'INR').gte('budget_max', HIGH_VALUE_INR);
    if (f.quick === 'mine') {
      // RFQs you saved with the bookmark, and the ones you posted
      const parts = [f.userId ? `buyer_id.eq.${f.userId}` : '', f.saved.size ? `id.in.(${[...f.saved].join(',')})` : ''].filter(Boolean);
      query = query.or(parts.join(','));
    }
    const ordered =
      f.quick === 'urgent' ? query.order('deadline', { ascending: true }) :
      f.quick === 'high' ? query.order('budget_max', { ascending: false }) :
      query.order('created_at', { ascending: false });
    const { data, error: err } = await ordered.range(from, from + PAGE_SIZE - 1);
    if (err) throw err;
    return ((data ?? []) as unknown as Requirement[]).filter((r) => !isOutsideListing(r) && !isSeededRequirement(r) && !isPublicListing(r));
  }, []);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPage(0);
      setItems(rows);
      setPage(0);
      setHasMore(rows.length >= PAGE_SIZE - 2);
      setUpdatedAt(Date.now());
    } catch (e) {
      console.error('Live requirements failed to load', e);
      setError('Live requirements could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const rows = await fetchPage(next);
      setItems((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...rows.filter((r) => !seen.has(r.id))];
      });
      setPage(next);
      setHasMore(rows.length >= PAGE_SIZE - 2);
    } catch {
      toast.error('Could not load more requirements.');
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Counts (database) ───────────────────────────────────────────────────
  const loadCounts = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const monthAgo = new Date(Date.now() - 30 * 24 * HOUR).toISOString();
    try {
      // live BulkSkart RFQs (public listings from other marketplaces are counted apart)
      const liveCount = async (withoutPublic: boolean) => {
        let liveQuery = supabase.from('requirements').select('id', { count: 'exact', head: true }).eq('status', 'active').or(`expires_at.is.null,expires_at.gt.${nowIso}`).or(`deadline.is.null,deadline.gt.${nowIso}`);
        if (!INCLUDE_TEMPLATE_SEED_DATA) liveQuery = liveQuery.not('title', 'like', SEEDED_RFQ_TITLE_LIKE);
        if (withoutPublic) liveQuery = liveQuery.neq('source_type', 'public_listing');
        return liveQuery;
      };
      const [liveFirst, buyers, month, industries] = await Promise.all([
        liveCount(true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'buyer').eq('status', 'active'),
        // Budgets of RFQs posted in the last 30 days (rupees); up to 1,000 rows, so the total is a lower bound
        supabase.from('requirements').select('budget_max').eq('currency', 'INR').gte('created_at', monthAgo).not('budget_max', 'is', null).limit(1000),
        supabase.from('categories').select('id', { count: 'exact', head: true }).is('parent_id', null),
      ]);
      // before the public-listings migration the column is missing; count the old way then
      const live = isMissingColumnError(liveFirst.error) ? await liveCount(false) : liveFirst;
      const value = Array.isArray(month.data) ? (month.data as Array<{ budget_max: number | null }>).reduce((s, r) => s + (Number(r.budget_max) || 0), 0) : null;
      setCounts({ live: live.count ?? null, buyers: buyers.count ?? null, value, industries: industries.count ?? null });
    } catch {
      setCounts({ live: null, buyers: null, value: null, industries: null });
    }
  }, []);

  useEffect(() => {
    loadFirst();
  }, [loadFirst, quick, category, location, verifiedOnly]);

  useEffect(() => {
    loadCounts();
    const t = setInterval(loadCounts, 60e3);
    return () => clearInterval(t);
  }, [loadCounts]);

  // Countdowns tick every second while the section is on screen
  useEffect(() => {
    const el = sectionRef.current;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!timer) timer = setInterval(() => setNow(Date.now()), 1000); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    if (!el || typeof IntersectionObserver === 'undefined') { start(); return stop; }
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
    io.observe(el);
    return () => { io.disconnect(); stop(); };
  }, []);

  // ── Realtime: new requirements from the database ────────────────────────
  useEffect(() => {
    const isBot = typeof navigator !== 'undefined' && /Lighthouse|PageSpeed|HeadlessChrome|Googlebot/i.test(navigator.userAgent || '');
    if (isBot) return;
    const channel = supabase
      .channel(`live-requirements-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requirements' }, async (payload) => {
        const id = payload?.new?.id as string | undefined;
        if (!id) return;
        const { data } = await supabase.from('requirements').select(REQ_SELECT).eq('id', id).maybeSingle();
        if (!data || data.status !== 'active') return;
        const req = data as Requirement;
        if (req.deadline && new Date(req.deadline).getTime() <= Date.now()) return;
        if (isOutsideListing(req) || isSeededRequirement(req) || isPublicListing(req)) return;
        const f = filtersRef.current;
        const cat = CATEGORIES.find((c) => c.id === f.category);
        if (cat && cat.slugs.length > 0 && !cat.slugs.includes(req.categories?.slug ?? '')) return;
        if (f.quick !== 'all' && f.quick !== 'new') return;
        setItems((prev) => (prev.some((p) => p.id === req.id) ? prev : [req, ...prev]));
        setFreshIds((prev) => new Set(prev).add(req.id));
        setCounts((c) => ({ ...c, live: (c.live ?? 0) + 1 }));
        setUpdatedAt(Date.now());
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // the "New RFQ Posted!" popups at the top of the site can be switched off and on here
  const [alertsOff, setAlertsOff] = useState(rfqAlertsOff);
  useEffect(() => {
    const sync = () => setAlertsOff(rfqAlertsOff());
    window.addEventListener(RFQ_ALERTS_EVENT, sync);
    return () => window.removeEventListener(RFQ_ALERTS_EVENT, sync);
  }, []);

  /** Guests sign up as a supplier; signed-in people without a company finish their company profile. */
  const registerCompanyHref = user ? '/dashboard/supplier/profile' : '/auth?tab=supplier';

  // ── Quote flow (existing permissions and quota) ─────────────────────────
  const handleSubmitQuote = async (req: Requirement) => {
    if (!user || !profile) { setDialogReason('not_logged_in'); setDialogOpen(true); return; }
    if (!company) { setDialogReason('not_registered_business'); setDialogOpen(true); return; }
    const sub = await checkSupplierPaidSubscription(company.id, company);
    if (!sub.allowed) { setDialogReason(sub.reason); setDialogOpen(true); return; }
    const quota = await checkDirectMessageQuota(company.id, company);
    if (quota !== 'ok') { setDialogReason(quota); setDialogOpen(true); return; }
    setRespondReq(req);
  };

  const toggleSaved = (id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      writeSaved(next);
      return next;
    });
  };

  const locations = useMemo(() => {
    const fromFeed = items.map((r) => (r.destination_city || '').trim()).filter(Boolean);
    return [...new Set([...LOCATIONS, ...fromFeed])].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const stats = [
    { icon: FileText, value: compactCount(counts.live), label: 'Live RFQs' },
    { icon: Users, value: compactCount(counts.buyers), label: 'Active Buyers' },
    { icon: Box, value: counts.value === null ? '—' : counts.value > 0 ? `${formatMoney({ amount: counts.value, currency: 'INR', approximate: false }, { compact: true })}+` : '₹0', label: 'RFQ Value (Monthly)' },
    { icon: Handshake, value: compactCount(counts.industries), label: 'Industries' },
  ];

  const secondsAgo = Math.max(0, Math.round((now - updatedAt) / 1000));

  return (
    <section ref={sectionRef} className="relative w-full overflow-hidden bg-[#070707] py-5 text-white sm:py-8" aria-labelledby="live-rfq-title">
      {/* port picture top right, fading into the black */}
      <img
        src="/home-design/rfq-port.jpg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 h-[150px] w-[44%] max-w-[520px] object-cover [mask-image:linear-gradient(90deg,transparent_0%,#000_45%),linear-gradient(0deg,transparent_0%,#000_40%)] [mask-composite:intersect] [-webkit-mask-composite:source-in] sm:h-[190px] md:h-[240px]"
        loading="lazy"
        decoding="async"
      />
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-10 h-60 w-60 rounded-full bg-[#FF5A00]/10 blur-[100px]" />

      <div className="relative mx-auto w-full max-w-[1400px] px-2.5 sm:px-5 md:px-6">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-1 md:gap-5">
          <img src="/home-design/rfq-icon.png" alt="" aria-hidden="true" className="h-[52px] w-[49px] shrink-0 object-contain md:h-[84px] md:w-[79px]" loading="lazy" />
          <div className="min-w-0">
            <h2 id="live-rfq-title" className="flex items-center gap-2 text-[30px] font-black leading-none tracking-tight md:text-[48px]">
              <span>Live <span className="text-[#FF6A14]">RFQ</span></span>
              <span className="relative ml-0.5 flex h-2.5 w-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E5322D] opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#E5322D]" />
              </span>
            </h2>
            <p className="mt-1 max-w-[230px] text-[12.5px] leading-snug text-white/85 md:max-w-none md:text-[17px]">Real-Time Bulk Requirements from Verified Buyers</p>
          </div>
        </div>

        <ul className="mt-3.5 grid grid-cols-4 md:mt-5 md:max-w-[900px]">
          {PROMISES.map((text, i) => (
            <li key={text} className={`flex min-w-0 items-center justify-center gap-[3px] px-0.5 md:justify-start md:gap-2 md:px-4 ${i > 0 ? 'border-l border-white/20' : 'md:pl-1'}`}>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 fill-[#FF6A14] text-black md:h-5 md:w-5" aria-hidden="true" />
              <span className="whitespace-nowrap text-[8.5px] font-medium tracking-[-0.01em] text-white/90 min-[400px]:text-[9px] sm:text-[11px] md:text-[15px]">{text}</span>
            </li>
          ))}
        </ul>

        {/* ── Live counts (database) ── */}
        <div className="mt-3.5 grid grid-cols-4 rounded-2xl border border-[#FF5A00]/45 bg-gradient-to-b from-[#16100c] to-[#0b0b0b] px-1 py-3 shadow-[0_0_30px_-14px_rgba(255,90,0,0.8)] md:mt-5 md:py-5">
          {stats.map(({ icon: Icon, value, label }, i) => (
            <div key={label} className={`flex flex-col items-center px-1 text-center ${i > 0 ? 'border-l border-white/10' : ''}`}>
              <Icon className="h-[22px] w-[22px] text-[#FF6A14] md:h-8 md:w-8" strokeWidth={1.6} aria-hidden="true" />
              <span className="mt-1 text-[16px] font-extrabold leading-none tabular-nums min-[400px]:text-[17px] md:mt-2 md:text-[30px]">{value}</span>
              <span className="mt-1 whitespace-nowrap text-[8.5px] leading-tight text-white/80 min-[400px]:text-[9.5px] sm:text-[11px] md:text-[15px]">{label}</span>
            </div>
          ))}
        </div>

        {/* ── Quick filters ── */}
        <div className="mt-3.5 flex gap-1 overflow-x-auto pb-0.5 scrollbar-none md:mt-5 md:gap-3">
          {QUICK_FILTERS.map(({ id, label, icon: Icon }) => {
            const active = quick === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => setQuick(id)}
                className={`flex h-[30px] shrink-0 items-center gap-[3px] whitespace-nowrap rounded-full border px-1.5 text-[9.5px] font-semibold transition-colors min-[380px]:px-2 min-[380px]:text-[10px] min-[400px]:text-[11px] md:h-11 md:gap-1.5 md:px-5 md:text-[15px] ${
                  active
                    ? 'border-transparent bg-gradient-to-b from-[#FF7A1A] to-[#F25600] text-white shadow-[0_0_16px_-4px_rgba(255,90,0,0.9)]'
                    : 'border-white/20 bg-[#101010] text-white hover:border-[#FF5A00]/70'
                }`}
              >
                <Icon className={`h-3 w-3 min-[400px]:h-3.5 min-[400px]:w-3.5 md:h-5 md:w-5 ${active ? '' : 'text-[#FF6A14]'}`} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Category, location, verified buyers ── */}
        <div className="mt-2.5 flex gap-1.5 md:mt-4 md:gap-3">
          <label className="relative flex h-[32px] min-w-0 flex-1 items-center rounded-xl border border-white/20 bg-[#101010] md:h-11 md:max-w-[340px]">
            <Box className="pointer-events-none absolute left-2.5 h-4 w-4 text-white/80" aria-hidden="true" />
            <span className="sr-only">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-full w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent pl-8 pr-7 text-[11.5px] text-white focus:outline-none md:text-[14px]">
              {CATEGORIES.map((c) => <option key={c.id} value={c.id} className="bg-[#111]">{c.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-white/80" aria-hidden="true" />
          </label>
          <label className="relative flex h-[32px] min-w-0 flex-1 items-center rounded-xl border border-white/20 bg-[#101010] md:h-11 md:max-w-[340px]">
            <MapPin className="pointer-events-none absolute left-2.5 h-4 w-4 text-white/80" aria-hidden="true" />
            <span className="sr-only">Delivery location</span>
            <select value={location} onChange={(e) => setLocation(e.target.value)} className="h-full w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent pl-8 pr-7 text-[11.5px] text-white focus:outline-none md:text-[14px]">
              <option value="all" className="bg-[#111]">All Locations</option>
              {locations.map((l) => <option key={l} value={l} className="bg-[#111]">{l}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-white/80" aria-hidden="true" />
          </label>
          <button
            type="button"
            aria-pressed={verifiedOnly}
            onClick={() => setVerifiedOnly((v) => !v)}
            title={verifiedOnly ? 'Showing verified buyers only' : 'Show verified buyers only'}
            aria-label="Verified buyers only"
            className={`flex h-[32px] w-[44px] shrink-0 items-center justify-center rounded-xl border transition-colors md:h-11 md:w-14 ${verifiedOnly ? 'border-[#FF5A00] bg-[#FF5A00]/15 text-[#FF7A2E]' : 'border-white/20 bg-[#101010] text-white hover:border-[#FF5A00]/70'}`}
          >
            <Filter className="h-4 w-4 md:h-5 md:w-5" />
          </button>
        </div>

        {/* ── Live feed ── */}
        <div className="mt-3 flex items-center gap-2 px-1">
          <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[10.5px] text-white/60 md:text-[13px]" aria-live="polite">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#E5322D]" aria-hidden="true" />
            <span className="min-w-0">Live feed · new RFQs appear as buyers post them · updated {secondsAgo < 5 ? 'just now' : `${secondsAgo}s ago`}</span>
          </p>
          <button
            type="button"
            aria-pressed={!alertsOff}
            onClick={() => setRfqAlertsOff(!alertsOff)}
            title={alertsOff ? 'Show "New RFQ Posted!" popups at the top of the site' : 'Stop the "New RFQ Posted!" popups'}
            className={`flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[10.5px] font-semibold transition-colors md:h-8 md:text-[12.5px] ${alertsOff ? 'border-[#FF5A00]/60 text-[#FF8A3D] hover:bg-[#FF5A00]/10' : 'border-white/15 text-white/70 hover:border-white/35 hover:text-white'}`}
          >
            {alertsOff ? <BellRing className="h-3.5 w-3.5" aria-hidden="true" /> : <BellOff className="h-3.5 w-3.5" aria-hidden="true" />}
            {alertsOff ? 'Turn on RFQ alerts' : 'RFQ alerts on'}
          </button>
        </div>

        {/* Who can quote */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-xl border border-[#FF5A00]/40 bg-[#FF5A00]/[0.07] px-3 py-2 md:mt-3 md:px-4 md:py-2.5" role="note">
          <span className="flex min-w-0 flex-1 items-center gap-2 text-[11.5px] leading-snug md:text-[14px]">
            <Lock className="h-4 w-4 shrink-0 text-[#FF7A2E]" aria-hidden="true" />
            <span>
              <strong className="font-bold">Only registered companies can send quotations.</strong>{' '}
              <span className="text-white/70">
                {company ? `You are quoting as ${company.company_name}.` : 'Register your business to quote on buyer RFQs.'}
              </span>
            </span>
          </span>
          {!company && (
            <Link
              to={registerCompanyHref}
              className="group inline-flex shrink-0 items-center gap-1 text-[11.5px] font-bold text-[#FF8A3D] hover:text-[#FFA766] md:text-[14px]"
            >
              Register your company
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          )}
        </div>

        {/* Who can quote */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-xl border border-[#FF5A00]/40 bg-[#FF5A00]/[0.07] px-3 py-2 md:mt-3 md:px-4 md:py-2.5" role="note">
          <span className="flex min-w-0 flex-1 items-center gap-2 text-[11.5px] leading-snug md:text-[14px]">
            <Lock className="h-4 w-4 shrink-0 text-[#FF7A2E]" aria-hidden="true" />
            <span>
              <strong className="font-bold">Only registered companies can send quotations.</strong>{' '}
              <span className="text-white/70">
                {company ? `You are quoting as ${company.company_name}.` : 'Register your business to quote on buyer RFQs.'}
              </span>
            </span>
          </span>
          {!company && (
            <Link
              to={registerCompanyHref}
              className="group inline-flex shrink-0 items-center gap-1 text-[11.5px] font-bold text-[#FF8A3D] hover:text-[#FFA766] md:text-[14px]"
            >
              Register your company
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          )}
        </div>

        <div className="mt-2 grid gap-2 md:mt-3 md:grid-cols-2 md:gap-4">
          {loading && items.length === 0 ? (
            [1, 2, 3, 4].map((n) => <div key={n} className="h-[118px] animate-pulse rounded-2xl border border-white/10 bg-[#121212] md:h-[160px]" />)
          ) : error ? (
            <div className="rounded-2xl border border-[#FF5A00]/30 bg-[#FF5A00]/5 p-6 text-center md:col-span-2">
              <p className="text-sm text-[#FF7A2E]">{error}</p>
              <button type="button" onClick={loadFirst} className="mt-3 rounded-lg bg-[#C94400] px-4 py-2 text-sm font-bold">Retry</button>
            </div>
          ) : items.length === 0 ? (
            quick === 'all' && category === 'all' && location === 'all' && !verifiedOnly ? (
              <div className="rounded-2xl border border-[#FF5A00]/35 bg-gradient-to-b from-[#140d08] to-[#0b0b0b] px-5 py-7 text-center md:col-span-2 md:py-10">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FF5A00]/40 bg-[#FF5A00]/10">
                  <Lock className="h-6 w-6 text-[#FF7A2E]" aria-hidden="true" />
                </span>
                <p className="mt-3 text-[16px] font-black md:text-[20px]">No open RFQs right now</p>
                <p className="mx-auto mt-1.5 max-w-[460px] text-[12.5px] leading-relaxed text-white/70 md:text-[14px]">
                  New buying requirements appear here live as soon as buyers post them.{' '}
                  <strong className="font-bold text-white">Only registered companies are allowed to send quotations.</strong>
                </p>
                {!company && (
                  <Link
                    to={registerCompanyHref}
                    className="group mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-[#FF7A1A] to-[#F25600] px-5 text-[13px] font-bold text-white shadow-[0_8px_22px_-10px_rgba(255,90,0,0.95)] md:h-11 md:text-[14px]"
                  >
                    Register your company to quote
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-7 text-center md:col-span-2">
                <FileText className="mx-auto h-8 w-8 text-[#FF5A00]" />
                <p className="mt-2 text-sm font-semibold">
                  {quick === 'mine' ? (user ? 'No saved or posted RFQs yet.' : 'Sign in to see the RFQs you saved or posted.') : 'No live RFQs match these filters right now.'}
                </p>
                <p className="mt-1 text-xs text-white/60">{quick === 'mine' ? 'Tap the bookmark on any RFQ to keep it here.' : 'New buyer requirements appear here as soon as they are posted.'}</p>
                {quick === 'mine' && !user ? (
                  <Link to="/auth" className="mt-4 inline-flex rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold hover:border-[#FF5A00]">Sign in</Link>
                ) : (
                  <button type="button" onClick={() => { setQuick('all'); setCategory('all'); setLocation('all'); setVerifiedOnly(false); }} className="mt-4 rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold hover:border-[#FF5A00]">
                    Show all RFQs
                  </button>
                )}
              </div>
            )
          ) : (
            <AnimatePresence initial={false}>
              {items.map((req, index) => {
                const visual = getRequirementVisualInfo(req, index);
                const ownPicture = Array.isArray(req.images) && req.images.find((u) => typeof u === 'string' && u.trim());
                const designPicture = DESIGN_PICTURES.find(([re]) => re.test(req.title || ''))?.[1];
                const picture = ownPicture || designPicture || visual.image;
                const badge = primaryBadge(req, now, freshIds.has(req.id));
                const showBulk = Number(req.quantity) >= 50 && badge?.label !== 'Multi-Product RFQ';
                const ends = req.deadline || req.expires_at;
                const left = ends ? new Date(ends).getTime() - now : null;
                const isSaved = saved.has(req.id);
                return (
                  <motion.article
                    key={req.id}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className={`relative flex gap-2.5 rounded-2xl border bg-gradient-to-b from-[#161616] to-[#0d0d0d] p-2 md:gap-4 md:p-3 ${freshIds.has(req.id) ? 'border-[#FF5A00] shadow-[0_0_24px_-6px_rgba(255,90,0,0.75)]' : 'border-white/15'}`}
                  >
                    <button type="button" onClick={() => setDetailReq(req)} className="h-[70px] w-[82px] shrink-0 overflow-hidden rounded-xl bg-[#e9e9eb] md:h-[118px] md:w-[140px]" aria-label={`View ${visual.cleanTitle}`}>
                      <SafeImage src={picture} alt={visual.cleanTitle} category={req.categories?.name || req.category_id} fallbackType="rfq" className="h-full w-full object-cover" sizes="140px" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1 md:gap-1.5">
                        {badge && (
                          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-[2px] text-[9px] font-bold md:px-2 md:text-[12px] ${badge.className}`}>
                            <badge.icon className="h-2.5 w-2.5 md:h-3.5 md:w-3.5" aria-hidden="true" /> {badge.label}
                          </span>
                        )}
                        {showBulk && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-[2px] text-[9px] font-semibold text-white/90 md:px-2 md:text-[12px]">
                            <Box className="h-2.5 w-2.5 md:h-3.5 md:w-3.5" aria-hidden="true" /> Bulk Order
                          </span>
                        )}
                      </div>
                      <button type="button" onClick={() => setDetailReq(req)} className="mt-1 block w-full text-left">
                        <h3 className="line-clamp-2 text-[11.5px] font-bold leading-tight text-white hover:text-[#FF7A2E] md:text-[16px]">{visual.cleanTitle}</h3>
                      </button>
                      <dl className="mt-1 space-y-[1px] text-[9.5px] leading-snug text-white/85 md:mt-2 md:space-y-1 md:text-[13px]">
                        <div className="flex gap-1.5">
                          <dt className="flex shrink-0 items-center gap-1 text-white/70"><Users className="h-3 w-3 md:h-3.5 md:w-3.5" aria-hidden="true" />Quantity:</dt>
                          <dd className="truncate">{visual.quantityDisplay}</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="flex shrink-0 items-center gap-1 text-white/70"><MapPin className="h-3 w-3 md:h-3.5 md:w-3.5" aria-hidden="true" />Delivery:</dt>
                          <dd className="truncate">{visual.locationDisplay}</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="flex shrink-0 items-center gap-1 text-white/70"><CalendarDays className="h-3 w-3 md:h-3.5 md:w-3.5" aria-hidden="true" />Posted:</dt>
                          <dd className="truncate">{postedOn(req.created_at)}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex w-[112px] shrink-0 flex-col items-end justify-between md:w-[170px]">
                      <div className="flex w-full items-start justify-end gap-1">
                        <div className="flex items-center gap-1 rounded-lg border border-[#E5322D]/60 bg-[#2a0d0b] px-1.5 py-1 md:gap-2 md:px-2.5 md:py-1.5">
                          <Clock className="h-3.5 w-3.5 text-[#FF4D3D] md:h-5 md:w-5" aria-hidden="true" />
                          <span className="leading-none">
                            <span className="block text-[8px] text-white/70 md:text-[11px]">{left !== null ? 'Ends in' : 'Status'}</span>
                            <span className="block whitespace-nowrap text-[11px] font-extrabold tabular-nums md:text-[16px]">{left !== null ? endsIn(left) : 'Open'}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSaved(req.id)}
                          aria-pressed={isSaved}
                          aria-label={isSaved ? 'Remove from My RFQs' : 'Save to My RFQs'}
                          className="flex h-6 w-5 items-start justify-center text-white/85 hover:text-[#FF7A2E] md:h-7 md:w-6"
                        >
                          <Bookmark className={`h-4 w-4 md:h-5 md:w-5 ${isSaved ? 'fill-[#FF6A14] text-[#FF6A14]' : ''}`} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSubmitQuote(req)}
                        className="group/btn mt-2 flex h-[28px] w-full items-center justify-center gap-0.5 whitespace-nowrap rounded-lg bg-gradient-to-b from-[#FF7A1A] to-[#F25600] px-1 text-[10px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(255,90,0,0.9)] transition-transform hover:-translate-y-0.5 md:h-10 md:rounded-xl md:text-[14px]"
                      >
                        Submit Quotation <ArrowRight className="h-3 w-3 shrink-0 transition-transform group-hover/btn:translate-x-0.5 md:h-4 md:w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {hasMore && items.length > 0 && (
          <div className="mt-3 flex justify-center">
            <button type="button" onClick={loadMore} disabled={loadingMore} className="flex h-9 items-center gap-2 rounded-xl border border-white/15 px-5 text-[12.5px] font-semibold hover:border-[#FF5A00] disabled:opacity-60">
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              Load more RFQs
            </button>
          </div>
        )}

        <Link
          to="/post-requirement"
          className="group mt-4 flex h-[46px] items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-b from-[#FF7A1A] to-[#F25600] px-4 text-[14.5px] font-bold text-white shadow-[0_10px_30px_-10px_rgba(255,90,0,0.95)] transition-transform hover:-translate-y-0.5 md:mx-auto md:mt-6 md:h-14 md:max-w-[640px] md:text-[18px]"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          Post a Buying Requirement (RFQ)
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>

      {detailReq && (
        <RequirementDetailDrawer
          requirement={detailReq}
          open={!!detailReq}
          onClose={() => setDetailReq(null)}
          onRequirementUpdated={(updated) => {
            setDetailReq(updated);
            setItems((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          }}
        />
      )}

      {respondReq && user && company && (
        <SupplierRespondDialog
          requirement={respondReq}
          open={!!respondReq}
          onClose={() => setRespondReq(null)}
          supplierId={user.id}
          supplierCompanyId={company.id}
          onResponded={() => {
            setRespondReq(null);
            loadFirst();
          }}
        />
      )}

      <SubscribeToContactDialog open={dialogOpen} onClose={() => setDialogOpen(false)} reason={dialogReason} />
    </section>
  );
}
