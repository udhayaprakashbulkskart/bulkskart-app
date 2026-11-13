import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Flame, Clock, MapPin, ArrowRight, ChevronLeft, ChevronRight, Sparkles, Gavel, FileText, Package, MessageSquare, Timer,
} from 'lucide-react';
import SafeImage from '@/components/common/SafeImage';
import { supabase } from '@/db/supabase';
import CreateReverseAuctionDialog from '@/components/auctions/CreateReverseAuctionDialog';
import { resolveAuctionImage } from '@/lib/auctionImageResolver';

export interface ReverseAuctionCardItem {
  id: string;
  auctionNumber: string;
  auctionType: 'reverse' | 'forward';
  title: string;
  category: string;
  quantity: string;
  priceRange: string;
  location: string;
  quotedCount: number;
  endTime: number; // epoch ms, from the database
  image: string;
}

const PER_PAGE = 3;
const CYCLE_SECONDS = 25;

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Maps a database auction row to the card shape. Only real fields are used.
function mapAuctionRow(d: any): ReverseAuctionCardItem {
  const auctionNumber = String(d.auction_number || '').trim();
  return {
    id: d.id,
    auctionNumber: auctionNumber && !isUuidLike(auctionNumber) ? auctionNumber : `AUC-${String(d.id).replace(/-/g, '').slice(0, 6).toUpperCase()}`,
    auctionType: d.auction_type === 'forward' ? 'forward' : 'reverse',
    title: d.title,
    category: d.category_name && !isUuidLike(String(d.category_name)) ? d.category_name : 'Bulk Lot',
    quantity: d.total_quantity ? `${Number(d.total_quantity).toLocaleString('en-IN')} ${d.quantity_unit || 'Units'}` : 'Bulk Lot',
    priceRange: d.starting_price ? `₹${Number(d.starting_price).toLocaleString('en-IN')} / ${d.quantity_unit || 'unit'}` : 'Competitive bidding',
    location: d.delivery_location || 'Pan-India',
    quotedCount: Number(d.total_bids) || 0,
    endTime: new Date(d.end_time).getTime(),
    image: resolveAuctionImage({ id: d.id, title: d.title || '', existing: d.images?.[0] }),
  };
}

export default function LiveReverseAuctionsRail() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [auctions, setAuctions] = useState<ReverseAuctionCardItem[]>([]);
  const [recentEnded, setRecentEnded] = useState<ReverseAuctionCardItem[]>([]);
  const [requestCount, setRequestCount] = useState<number | null>(null);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'live' | 'requests'>('live');
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [secondsLeft, setSecondsLeft] = useState(CYCLE_SECONDS);
  const [paused, setPaused] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Real open auctions only: status live AND end time still in the future.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const [open, openCount, reqCount, ended] = await Promise.all([
        supabase.from('auctions').select('*').eq('status', 'live').gt('end_time', nowIso).order('end_time', { ascending: true }).limit(24),
        supabase.from('auctions').select('id', { count: 'exact', head: true }).eq('status', 'live').gt('end_time', nowIso),
        supabase.from('requirements').select('id', { count: 'exact', head: true }).eq('status', 'active').or(`expires_at.is.null,expires_at.gt.${nowIso}`).or(`deadline.is.null,deadline.gt.${nowIso}`),
        // Recent completed auctions: shown only when nothing is live. Real records, labelled as ended.
        supabase.from('auctions').select('*').eq('status', 'completed').order('end_time', { ascending: false }).limit(6),
      ]);
      setAuctions(((open.data ?? []) as any[]).map(mapAuctionRow));
      setRecentEnded(((ended.data ?? []) as any[]).map(mapAuctionRow));
      setLiveCount(openCount.error ? null : openCount.count ?? 0);
      setRequestCount(reqCount.error ? null : reqCount.count ?? 0);
      setPage(0);
    } catch {
      setAuctions([]);
      setRecentEnded([]);
      setLiveCount(null);
      setRequestCount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live clock for countdowns (1s) and the batch rotation.
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      if (paused) return;
      setSecondsLeft(s => {
        if (s <= 1) {
          setPage(p => p + 1);
          return CYCLE_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [paused]);

  // Only auctions still open are shown.
  const openNow = useMemo(() => auctions.filter(a => a.endTime > now), [auctions, now]);
  const totalPages = Math.max(1, Math.ceil(openNow.length / PER_PAGE));
  const safePage = page % totalPages;
  const visible = openNow.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE);
  const progress = ((CYCLE_SECONDS - secondsLeft) / CYCLE_SECONDS) * 100;

  const openAuction = (a: ReverseAuctionCardItem) =>
    navigate(`/auctions/${a.auctionType === 'forward' ? 'forward' : 'reverse'}/${a.id}`);

  return (
    <section className="relative z-20 mx-auto mb-8 w-full max-w-[1400px] px-4 sm:mb-12 sm:px-5 md:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF5A00]/15 text-[#FF5A00]">
            <Flame className="h-5 w-5" />
          </span>
          <h2 className="text-[18px] font-black uppercase tracking-tight text-white sm:text-[22px]">Sell Products in 24 Hours</h2>
          <span className="rounded-md bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] px-2 py-0.5 text-[11px] font-black text-white">HOT</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[#FF5A00]/50 bg-[#0c0c0c] px-3.5 py-2 shadow-[0_0_24px_-8px_rgba(255,90,0,0.7)]">
          <Timer className="h-5 w-5 text-[#FF5A00]" />
          <div>
            <p className="text-[10px] text-neutral-400">Next batch in</p>
            <p className="font-mono text-[15px] font-bold tabular-nums text-white">
              {paused ? 'Paused' : `${String(secondsLeft).padStart(2, '0')}s`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPaused(p => !p)}
            aria-label={paused ? 'Resume rotation' : 'Pause rotation'}
            className="ml-1 rounded-md border border-white/15 px-2 py-1 text-[11px] font-semibold text-white hover:border-[#FF5A00]"
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      {/* Tabs (real counts only) */}
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => setTab('live')}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-all ${
            tab === 'live' ? 'border-transparent bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] text-white shadow-[0_8px_22px_-8px_rgba(255,90,0,0.9)]' : 'border-white/10 bg-[#101010] text-slate-200 hover:border-white/25'
          }`}
        >
          <Gavel className="h-4 w-4" /> Live Auctions {liveCount !== null && <span className="opacity-80">({liveCount})</span>}
        </button>
        <Link
          to="/requirements"
          onClick={() => setTab('requests')}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-all ${
            tab === 'requests' ? 'border-transparent bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] text-white' : 'border-white/10 bg-[#101010] text-slate-200 hover:border-white/25 hover:text-white'
          }`}
        >
          <FileText className="h-4 w-4" /> Bulk Requests {requestCount !== null && <span className="opacity-80">({requestCount})</span>}
        </Link>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="ml-auto flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-[13px] font-semibold text-white hover:border-[#FF5A00]"
        >
          <Sparkles className="h-4 w-4 text-[#FF5A00]" /> List Product in 24h
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[16px] font-black text-white">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#B33D00] shadow-[0_0_10px_rgba(220,38,38,0.9)]" />
          Live Now
        </h3>
        <Link to="/auctions" className="group flex items-center gap-1 text-[13px] font-bold text-[#FF7A2E] hover:text-[#FF5A00]">
          View All <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-[#C94400] via-[#C94400] to-orange-400 transition-[width] duration-1000 ease-linear" style={{ width: `${progress}%` }} />
      </div>

      {/* Cards */}
      <div className="mt-4">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(n => <div key={n} className="h-72 animate-pulse rounded-2xl border border-white/5 bg-[#161616]/[0.03]" />)}
          </div>
        ) : openNow.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-6 sm:p-8">
            <div className="text-center">
              <Package className="mx-auto h-9 w-9 text-[#FF5A00]" />
              <p className="mt-3 text-sm font-semibold text-white">No live auctions are open right now.</p>
              <p className="mt-1 text-xs text-neutral-400">Open auctions appear here with a live countdown as soon as they are listed.</p>
              <button type="button" onClick={() => setIsCreateOpen(true)} className="mt-4 rounded-xl bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] px-5 py-2.5 text-[13px] font-bold text-white">
                List a product in 24 hours
              </button>
            </div>
            {recentEnded.length > 0 && (
              <div className="mt-6 border-t border-white/10 pt-5">
                <p className="mb-3 text-[12px] font-bold uppercase tracking-wider text-neutral-400">Recently ended auctions</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {recentEnded.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => openAuction(a)}
                      className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#101010] p-3 text-left transition-colors hover:border-[#FF5A00]/60"
                    >
                      <span className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-[10px] font-bold text-neutral-300">ENDED</span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 block text-[13px] font-semibold text-white">{a.title}</span>
                        <span className="mt-1 block text-[11px] text-neutral-400">
                          {a.quantity} · {a.location} · {new Date(a.endTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={safePage}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -14 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3"
            >
              {visible.map(a => (
                <article
                  key={a.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => openAuction(a)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAuction(a); } }}
                  className="group relative w-[84vw] max-w-[360px] shrink-0 snap-start cursor-pointer overflow-hidden rounded-2xl border border-[#FF5A00]/40 bg-gradient-to-b from-[#121212] to-[#0a0a0a] shadow-[0_18px_50px_-22px_rgba(255,90,0,0.55)] transition-all duration-300 hover:-translate-y-1 hover:border-[#FF5A00] sm:w-auto sm:max-w-none"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0A0A0A]">
                    <SafeImage src={a.image} alt={a.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
                    <div className="absolute left-3 top-3 flex items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded-md bg-[#B33D00] px-2 py-1 text-[11px] font-extrabold text-white">
                        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-[#161616]" /> LIVE
                      </span>
                      <span className="flex items-center gap-1 rounded-md bg-[#0A0A0A]/70 px-2 py-1 font-mono text-[11px] font-bold text-white backdrop-blur">
                        <Clock className="h-3 w-3 text-[#FF5A00]" /> {formatCountdown(a.endTime - now)}
                      </span>
                    </div>
                    <span className="absolute right-3 top-3 rounded-md bg-[#0A0A0A]/70 px-2 py-1 font-mono text-[10px] text-slate-200 backdrop-blur">{a.auctionNumber}</span>
                    <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#0A0A0A]/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                      <Package className="h-3.5 w-3.5 text-[#FF5A00]" /> {a.category}
                    </span>
                  </div>

                  <div className="p-4">
                    <h4 className="line-clamp-2 min-h-[2.6em] text-[15px] font-bold leading-snug text-white group-hover:text-[#FF7A2E]">{a.title}</h4>
                    <p className="mt-2 flex items-center gap-2 text-[12px] text-slate-300"><Package className="h-3.5 w-3.5 text-neutral-400" /> {a.quantity}</p>
                    <p className="mt-1 text-[18px] font-black text-[#FF7A2E]">{a.priceRange}</p>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3 text-[12px]">
                      <span className="flex min-w-0 items-center gap-1.5 text-slate-300">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF5A00]" />
                        <span className="truncate">{a.location}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 font-semibold text-slate-100">
                        <MessageSquare className="h-3.5 w-3.5 text-[#FF5A00]" /> {a.quotedCount} {a.quotedCount === 1 ? 'Quotation' : 'Quotations'}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {openNow.length > 0 && (
        <>
          <div className="mt-4 flex justify-center gap-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setPage(i); setSecondsLeft(CYCLE_SECONDS); }}
                aria-label={`Show batch ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${i === safePage ? 'w-6 bg-[#C94400]' : 'w-2 bg-[#0A0A0A] hover:bg-[#262626]'}`}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-2.5 text-[12px] text-slate-300">
            <span>Batch {safePage + 1} of {totalPages} ({openNow.length} open {openNow.length === 1 ? 'auction' : 'auctions'})</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => { setPage(p => p - 1 < 0 ? totalPages - 1 : p - 1); setSecondsLeft(CYCLE_SECONDS); }} aria-label="Previous batch" className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 hover:border-[#FF5A00]"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => { setPage(p => p + 1); setSecondsLeft(CYCLE_SECONDS); }} aria-label="Next batch" className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 hover:border-[#FF5A00]"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </>
      )}

      <CreateReverseAuctionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => { setIsCreateOpen(false); load(); }}
      />
    </section>
  );
}
