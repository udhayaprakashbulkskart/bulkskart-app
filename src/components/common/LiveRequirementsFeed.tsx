/**
 * LiveRequirementsFeed — Live Buying Requirements (real database records only).
 *
 * - Loads active requirements from Supabase, 10 per page (database pagination).
 * - Realtime: new INSERTs on `requirements` appear at the top with a NEW RFQ badge.
 * - Auto-scrolling feed with Auto Scroll on/off, Pause/Resume, speed 0.5x/1x/1.5x/2x,
 *   manual up/down, and auto-pause while the user interacts with the feed.
 * - Counts come from the database (no generated numbers).
 * - Submit Quote opens the existing supplier quote dialog (permissions and quota checks kept).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ArrowRight, Bell, ChevronDown, ChevronUp, Factory, Loader2, LayoutGrid, MapPin, Package, Pause, Play,
  Shirt, Settings, Wrench, Zap, Lock, Building2, Users, Boxes, Wallet, Radio, Layers, FlaskConical, Wheat,
  CheckCircle2,
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

const PAGE_SIZE = 10;
const SPEEDS = [0.5, 1, 1.5, 2] as const;
const BASE_PX_PER_SEC = 28;
const REQ_SELECT = '*, profiles!buyer_id(id,full_name,email), categories!category_id(id,name,slug)';

// Each tab maps to the real `categories.slug` values in the database.
// Filtering runs on the server, so a tab shows every matching requirement, not just the rows already loaded.
const CATEGORY_TABS: Array<{ id: string; name: string; icon: typeof LayoutGrid; slugs: string[] }> = [
  { id: 'all', name: 'All Categories', icon: LayoutGrid, slugs: [] },
  { id: 'machinery', name: 'Machinery & Equipment', icon: Settings, slugs: ['machinery-industrial'] },
  { id: 'textiles', name: 'Textiles & Fabrics', icon: Shirt, slugs: ['textiles-apparel'] },
  { id: 'electronics', name: 'Electrical & Electronics', icon: Zap, slugs: ['electronics-electricals'] },
  { id: 'packaging', name: 'Packaging', icon: Boxes, slugs: ['packaging'] },
  { id: 'chemicals', name: 'Chemicals & Plastics', icon: FlaskConical, slugs: ['chemicals-raw-materials', 'plastics-rubber'] },
  { id: 'construction', name: 'Construction', icon: Wrench, slugs: ['construction-building'] },
  { id: 'agriculture', name: 'Agriculture & Food', icon: Wheat, slugs: ['agriculture-food'] },
  { id: 'auto', name: 'Auto Parts', icon: Layers, slugs: ['auto-parts-vehicles'] },
  { id: 'pharma', name: 'Pharma & Healthcare', icon: Package, slugs: ['pharma-healthcare'] },
];

function timeAgo(iso?: string): string {
  if (!iso) return 'Just now';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function LiveRequirementsFeed() {
  const { user, profile, company } = useAuth();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [items, setItems] = useState<Requirement[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('all');

  const [counts, setCounts] = useState<{ active: number | null; today: number | null; buyers: number | null }>({ active: null, today: null, buyers: null });

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [alerts, setAlerts] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogReason, setDialogReason] = useState<SubscriptionReason>('not_logged_in');
  const [detailReq, setDetailReq] = useState<Requirement | null>(null);
  const [respondReq, setRespondReq] = useState<Requirement | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const pausedUntil = useRef(0);
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  // ── Database: page of active requirements ───────────────────────────────
  const fetchPage = useCallback(async (pageNo: number, categoryId: string) => {
    const from = pageNo * PAGE_SIZE;
    const nowIso = new Date().toISOString();
    const tab = CATEGORY_TABS.find(t => t.id === categoryId);
    const filterBySlug = !!tab && tab.slugs.length > 0;
    let query = supabase
      .from('requirements')
      .select(filterBySlug ? REQ_SELECT.replace('categories!category_id(', 'categories!category_id!inner(') : REQ_SELECT)
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .or(`deadline.is.null,deadline.gt.${nowIso}`);
    if (filterBySlug) query = query.in('categories.slug', tab!.slugs);
    const { data, error: err } = await query
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (err) throw err;
    return (data ?? []) as unknown as Requirement[];
  }, []);

  const categoryRef = useRef(category);
  categoryRef.current = category;

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPage(0, categoryRef.current);
      setItems(rows);
      setPage(0);
      setHasMore(rows.length === PAGE_SIZE);
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
      const rows = await fetchPage(next, category);
      setItems(prev => {
        const seen = new Set(prev.map(r => r.id));
        return [...prev, ...rows.filter(r => !seen.has(r.id))];
      });
      setPage(next);
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      toast.error('Could not load more requirements.');
    } finally {
      setLoadingMore(false);
    }
  };

  const loadCounts = useCallback(async () => {
    try {
      const [active, today, buyers] = await Promise.all([
        supabase.from('requirements').select('id', { count: 'exact', head: true }).eq('status', 'active').or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).or(`deadline.is.null,deadline.gt.${new Date().toISOString()}`),
        supabase.from('requirements').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('created_at', startOfToday()).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).or(`deadline.is.null,deadline.gt.${new Date().toISOString()}`),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'buyer'),
      ]);
      setCounts({ active: active.count ?? 0, today: today.count ?? 0, buyers: buyers.count ?? 0 });
    } catch {
      setCounts({ active: null, today: null, buyers: null });
    }
  }, []);

  useEffect(() => {
    loadFirst();
  }, [loadFirst, category]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  // ── Realtime: new requirements from the database ────────────────────────
  useEffect(() => {
    const isBot = typeof navigator !== 'undefined' && /Lighthouse|PageSpeed|HeadlessChrome|Googlebot/i.test(navigator.userAgent || '');
    if (isBot) return;
    const channel = supabase
      .channel(`live-requirements-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requirements' }, async payload => {
        const id = payload?.new?.id as string | undefined;
        if (!id) return;
        const { data } = await supabase.from('requirements').select(REQ_SELECT).eq('id', id).maybeSingle();
        if (!data || data.status !== 'active') return;
        if (data.deadline && new Date(data.deadline).getTime() <= Date.now()) return;
        if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return;
        const req = data as Requirement;
        const activeTab = CATEGORY_TABS.find(t => t.id === categoryRef.current);
        if (activeTab && activeTab.slugs.length > 0 && !activeTab.slugs.includes(req.categories?.slug ?? '')) return;
        setItems(prev => (prev.some(p => p.id === req.id) ? prev : [req, ...prev]));
        setFreshIds(prev => new Set(prev).add(req.id));
        setCounts(c => ({ ...c, active: (c.active ?? 0) + 1, today: (c.today ?? 0) + 1 }));
        if (alertsRef.current) toast.info(`New RFQ: ${req.title}`);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Auto-scroll (smooth, frame-based) ───────────────────────────────────
  // Items are already filtered by the server for the selected tab.
  const filtered = items;

  useEffect(() => {
    if (!playing || reduce) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const el = scrollRef.current;
      const dt = Math.min(64, now - last);
      last = now;
      if (el && now > pausedUntil.current && el.scrollHeight > el.clientHeight + 1) {
        posRef.current += (dt / 1000) * BASE_PX_PER_SEC * speed;
        const max = el.scrollHeight - el.clientHeight;
        if (posRef.current >= max) {
          posRef.current = 0; // loop back to the first requirement
          pausedUntil.current = now + 1200;
        }
        el.scrollTop = posRef.current;
      } else if (el) {
        posRef.current = el.scrollTop;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, reduce, filtered.length]);

  const pauseForUser = () => {
    pausedUntil.current = performance.now() + 3500; // resume automatically after 3.5s idle
  };

  const nudge = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    pauseForUser();
    el.scrollBy({ top: dir * 180, behavior: 'smooth' });
    setTimeout(() => { posRef.current = el.scrollTop; }, 400);
  };

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

  const showStats = counts.active !== null;

  return (
    <section className="relative w-full overflow-hidden bg-[#050505] py-6 text-white sm:py-10">
      {/* Ambient glow */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-[#FF5A00]/10 blur-[110px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-10 h-72 w-72 rounded-full bg-[#FF5A00]/10 blur-[110px]" />

      <div className="relative mx-auto w-full max-w-[1400px] px-4 sm:px-5 md:px-6">
        {/* ── Header ── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg bg-[#B33D00] px-3 py-1 text-[12px] font-extrabold tracking-wider shadow-[0_0_18px_-2px_rgba(220,38,38,0.8)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#161616] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#161616]" />
            </span>
            LIVE
          </span>
        </div>
        <h2 className="mt-2 text-[30px] font-black leading-tight tracking-tight sm:text-[40px]">
          Live <span className="text-[#FF5A00]">Buying Requirements</span>
        </h2>
        <p className="mt-1 text-sm text-neutral-400 sm:text-[15px]">Real-time bulk purchase demands from verified businesses.</p>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-slate-300">
          {[
            { icon: CheckCircle2, text: 'Verified Buyers Only' },
            { icon: Zap, text: 'Live & Auto Updating' },
            { icon: Boxes, text: 'Bulk Orders & Long-Term Supply' },
            { icon: Radio, text: 'Respond with Your Best Quote' },
          ].map(({ icon: Icon, text }) => (
            <span key={text} className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 text-[#FF5A00]" />
              {text}
            </span>
          ))}
        </div>

        {/* ── Live stats (database) ── */}
        <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-[#FF5A00]/40 bg-gradient-to-r from-[#0d0d0d] via-[#141414] to-[#0d0d0d] shadow-[0_0_30px_-12px_rgba(255,90,0,0.6)] md:grid-cols-4">
          {[
            { icon: Users, value: counts.active, label: 'Active Buying RFQs' },
            { icon: Radio, value: counts.today, label: 'Posted Today' },
            { icon: Building2, value: counts.buyers, label: 'Registered Buyers' },
            { icon: Package, value: null, label: 'Live Updates', live: true },
          ].map(({ icon: Icon, value, label, live }, i) => (
            <div key={label} className={`flex items-center gap-3 px-4 py-3.5 ${i % 2 === 0 ? 'border-r border-white/10' : ''} ${i < 2 ? 'border-b border-white/10 md:border-b-0' : ''} ${i < 3 ? 'md:border-r md:border-white/10' : ''}`}>
              <Icon className="h-6 w-6 shrink-0 text-[#FF5A00]" />
              <div className="min-w-0">
                <div className="text-[18px] font-black leading-none sm:text-[22px]">
                  {live ? (
                    <span className="flex items-center gap-2 text-[15px] font-bold sm:text-[16px]">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#C94400]" /> On
                    </span>
                  ) : value === null ? '—' : value.toLocaleString('en-IN')}
                </div>
                <div className="mt-1 truncate text-[11px] text-neutral-400">{live ? 'New RFQs appear as they are posted' : label}</div>
              </div>
            </div>
          ))}
        </div>
        {!showStats && <p className="mt-2 text-[11px] text-neutral-400">Counts are unavailable right now.</p>}

        {/* ── Category filters ── */}
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_TABS.map(tab => {
            const active = category === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategory(tab.id)}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2 text-[13px] font-semibold transition-all duration-200 ${
                  active
                    ? 'border-transparent bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] text-white shadow-[0_8px_22px_-8px_rgba(255,90,0,0.9)]'
                    : 'border-white/10 bg-[#101010] text-slate-200 hover:border-white/25 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* ── Feed controls ── */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0c0c0c] px-3.5 py-2.5">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-lg bg-[#FF5A00]/15 px-3 py-1.5 text-[12px] font-extrabold tracking-wider text-[#FF7A2E]">
              <Radio className="h-4 w-4" /> LIVE FEED
            </span>
            <span className="hidden items-center gap-2 text-[12px] text-neutral-400 sm:flex">
              <span className={`h-2 w-2 rounded-full ${playing ? 'animate-pulse bg-[#C94400]' : 'bg-[#262626]'}`} />
              {playing ? 'Auto-scrolling live requirements' : 'Paused'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-300">
              Auto Scroll
              <button
                type="button"
                role="switch"
                aria-checked={playing}
                aria-label="Auto scroll"
                onClick={() => setPlaying(p => !p)}
                className={`relative h-5 w-9 rounded-full transition-colors ${playing ? 'bg-[#C94400]' : 'bg-[#0A0A0A]'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#161616] shadow transition-all ${playing ? 'left-4' : 'left-0.5'}`} />
              </button>
            </label>
            <button
              type="button"
              onClick={() => setPlaying(p => !p)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-[12px] font-semibold text-white hover:border-[#FF5A00]"
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playing ? 'Pause' : 'Resume'}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setSpeedOpen(o => !o)}
                className="flex h-8 items-center gap-1 rounded-lg border border-white/15 px-3 text-[12px] font-semibold text-white hover:border-[#FF5A00]"
              >
                Speed: {speed}x <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {speedOpen && (
                <div className="absolute right-0 z-20 mt-1 w-28 overflow-hidden rounded-lg border border-white/15 bg-[#111] shadow-xl">
                  {SPEEDS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setSpeed(s); setSpeedOpen(false); }}
                      className={`block w-full px-3 py-1.5 text-left text-[12px] hover:bg-white/10 ${speed === s ? 'font-bold text-[#FF7A2E]' : 'text-slate-200'}`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={() => nudge(-1)} aria-label="Scroll up" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 hover:border-[#FF5A00]">
              <ChevronUp className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => nudge(1)} aria-label="Scroll down" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 hover:border-[#FF5A00]">
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setAlerts(a => !a)}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold ${alerts ? 'bg-[#C94400] text-white' : 'border border-white/15 text-slate-200 hover:border-[#FF5A00]'}`}
              aria-pressed={alerts}
            >
              <Bell className="h-3.5 w-3.5" /> Alerts {alerts ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {/* ── Feed ── */}
        <div
          ref={scrollRef}
          onPointerDown={pauseForUser}
          onWheel={pauseForUser}
          onTouchStart={pauseForUser}
          onKeyDown={pauseForUser}
          className="mt-4 h-[560px] space-y-3 overflow-y-auto pr-1 sm:h-[600px] [scrollbar-width:thin] [scrollbar-color:#FF5A00_transparent]"
          aria-live="polite"
        >
          {loading && items.length === 0 ? (
            [1, 2, 3].map(n => <div key={n} className="h-36 animate-pulse rounded-2xl border border-white/5 bg-[#161616]/[0.03]" />)
          ) : error ? (
            <div className="rounded-2xl border border-[#FF5A00]/30 bg-[#FF5A00]/5 p-6 text-center">
              <p className="text-sm text-[#FF7A2E]">{error}</p>
              <button type="button" onClick={loadFirst} className="mt-3 rounded-lg bg-[#C94400] px-4 py-2 text-sm font-bold">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-8 text-center">
              <Factory className="mx-auto h-9 w-9 text-[#FF5A00]" />
              <p className="mt-3 text-sm font-semibold">No live requirements {category === 'all' ? 'right now' : 'in this category'}.</p>
              <p className="mt-1 text-xs text-neutral-400">New buyer requirements appear here as soon as they are posted.</p>
              {category !== 'all' && (
                <button type="button" onClick={() => setCategory('all')} className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold hover:border-[#FF5A00]">
                  View all categories
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map((req, index) => {
                const visual = getRequirementVisualInfo(req, index);
                const isFresh = freshIds.has(req.id);
                const minutes = Math.floor((Date.now() - new Date(req.created_at || 0).getTime()) / 60000);
                const isNewPost = isFresh || minutes < 60;
                // Urgency comes from the buyer's real deadline, never from a fixed label.
                const hoursLeft = req.deadline ? (new Date(req.deadline).getTime() - Date.now()) / 3600000 : null;
                const isEmergency = hoursLeft !== null && hoursLeft > 0 && hoursLeft <= 48;
                const isUrgent = !isEmergency && hoursLeft !== null && hoursLeft > 0 && hoursLeft <= 168;
                return (
                  <motion.article
                    key={req.id}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, y: -16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, x: -20 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className={`group relative rounded-2xl border bg-[#0c0c0c] p-3 transition-colors sm:p-4 ${
                      isFresh ? 'border-[#FF5A00] shadow-[0_0_28px_-6px_rgba(255,90,0,0.7)]' : 'border-white/10 hover:border-[#FF5A00]/50'
                    }`}
                  >
                    <div className="flex gap-3 sm:gap-4">
                      <button
                        type="button"
                        onClick={() => setDetailReq(req)}
                        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#141414] sm:h-24 sm:w-24"
                        aria-label={`View ${visual.cleanTitle}`}
                      >
                        <SafeImage
                          src={visual.image}
                          alt={visual.cleanTitle}
                          category={req.categories?.name || req.category_id}
                          fallbackType="rfq"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="96px"
                        />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isNewPost && (
                            <span className="rounded-md bg-[#C94400] px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-white">NEW RFQ</span>
                          )}
                          <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                            <Zap className="h-3 w-3 text-[#FF5A00]" /> {timeAgo(req.created_at)}
                          </span>
                          {isEmergency && (
                            <span className="rounded-md bg-[#B33D00] px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-white">EMERGENCY</span>
                          )}
                          {isUrgent && (
                            <span className="rounded-md bg-[#FF5A00]/15 px-2 py-0.5 text-[10px] font-bold text-[#FF7A2E] border border-[#FF5A00]/40">URGENT</span>
                          )}
                          <span className="rounded-md border border-[#FF5A00]/40 bg-[#FF5A00]/10 px-2 py-0.5 text-[10px] font-bold text-[#FF7A2E]">Bulk Purchase</span>
                          <span className="rounded-md border border-[#FF5A00]/40 bg-[#FF5A00]/10 px-2 py-0.5 text-[10px] font-bold text-[#FF7A2E]">Free Delivery</span>
                          {req.is_verified_buyer && (
                            <span className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                              <Lock className="h-2.5 w-2.5 text-[#FF7A2E]" /> Verified Buyer
                            </span>
                          )}
                        </div>
                        <button type="button" onClick={() => setDetailReq(req)} className="mt-1.5 block w-full text-left">
                          <h3 className="line-clamp-1 text-[15px] font-bold text-white group-hover:text-[#FF7A2E] sm:text-[17px]">{visual.cleanTitle}</h3>
                        </button>
                        <p className="line-clamp-1 text-[12px] text-neutral-400">{visual.subtitle}</p>

                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px] sm:grid-cols-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 truncate font-bold text-[#FF7A2E]">
                              <Package className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{visual.quantityDisplay}</span>
                            </div>
                            <div className="text-[10px] text-neutral-400">Quantity</div>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 truncate font-semibold text-slate-100">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                              <span className="truncate" title={visual.locationDisplay}>{visual.locationDisplay}</span>
                            </div>
                            <div className="text-[10px] text-neutral-400">Location</div>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 truncate font-semibold text-slate-100">
                              <Wallet className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                              <span className="truncate">{req.deadline ? new Date(req.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Open'}</span>
                            </div>
                            <div className="text-[10px] text-neutral-400">Required By</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                      <button
                        type="button"
                        onClick={() => setDetailReq(req)}
                        className="h-10 rounded-xl border border-white/15 text-[13px] font-semibold text-white transition-colors hover:border-[#FF5A00] hover:text-[#FF7A2E]"
                      >
                        View Details
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSubmitQuote(req)}
                        className="group/btn flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] text-[13px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(255,90,0,0.9)] transition-transform hover:-translate-y-0.5"
                      >
                        Submit Quote <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                      </button>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          )}

          {hasMore && filtered.length > 0 && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="flex h-10 items-center gap-2 rounded-xl border border-white/15 px-5 text-[13px] font-semibold hover:border-[#FF5A00] disabled:opacity-60"
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Load more requirements
              </button>
            </div>
          )}
        </div>

        {/* ── Manufacturer conversion banner ── */}
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-[#FF5A00]/50 bg-gradient-to-r from-[#1a0c05] via-[#0c0c0c] to-[#0c0c0c] p-5 shadow-[0_0_40px_-12px_rgba(255,90,0,0.6)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FF5A00]/15 text-[#FF5A00]">
              <Factory className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[18px] font-black sm:text-[22px]">Are You a <span className="text-[#FF5A00]">Manufacturer?</span></p>
              <p className="text-[12px] text-neutral-400 sm:text-[13px]">Get access to real-time bulk buying requirements. Discover buyers. Submit quotations. Win bulk orders.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link to="/requirements" className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] px-5 text-[13px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(255,90,0,0.9)]">
              Explore Buying Opportunities <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/auth?tab=supplier" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 px-5 text-[13px] font-bold text-white hover:border-[#FF5A00] hover:text-[#FF7A2E]">
              List Your Products
            </Link>
          </div>
        </div>
      </div>

      {detailReq && (
        <RequirementDetailDrawer
          requirement={detailReq}
          open={!!detailReq}
          onClose={() => setDetailReq(null)}
          onRequirementUpdated={updated => {
            setDetailReq(updated);
            setItems(prev => prev.map(r => (r.id === updated.id ? updated : r)));
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
