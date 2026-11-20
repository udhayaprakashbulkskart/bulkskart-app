/**
 * LiveRequirementsFeed: the newest open buying requirements on the home page.
 *
 * Everything shown comes from the requirements table: the newest open posts (no generated or
 * demonstration rows), the real number of open requirements, and new posts as they are saved (the
 * realtime channel adds them to the top). Badges come from what the buyer entered (urgent, deadline,
 * verified buyer) and nothing is assigned by position.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Calendar, CheckCircle2, ChevronLeft, ChevronRight, LayoutGrid, MapPin, MessageSquare, Package, RefreshCw, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/db/supabase';
import { checkSupplierPaidSubscription, countOpenRequirements, getCategories, getOpenRequirements } from '@/lib/api';
import type { Category, Requirement } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import SubscribeToContactDialog, { type SubscriptionReason } from '@/components/common/SubscribeToContactDialog';
import SupplierRespondDialog from '@/components/common/SupplierRespondDialog';
import RequirementThumb, { categoryIcon } from '@/components/common/RequirementThumb';
import { getRequirementVisualInfo } from '@/lib/requirementVisuals';
import { ExternalSourceLink, GovernmentTenderBadge } from '@/components/common/ExternalSourceLink';
import { isSeededRequirement } from '@/lib/seedData';

const FEED_SIZE = 16;
const CARDS_PER_VIEW = 4;
const REFRESH_MS = 2 * 60 * 1000;

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function LiveRequirementsFeed() {
  const { user, profile, company } = useAuth();
  const navigate = useNavigate();

  const [reqs, setReqs] = useState<Requirement[]>([]);
  const [openTotal, setOpenTotal] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageOffset, setPageOffset] = useState(0);
  const [tick, setTick] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogReason, setDialogReason] = useState<SubscriptionReason>('not_logged_in');
  const [respondDialogReq, setRespondDialogReq] = useState<Requirement | null>(null);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  const categoryTabs = useMemo(
    () => [
      { id: 'all', name: 'All Categories', icon: LayoutGrid as ReturnType<typeof categoryIcon> },
      ...categories
        .filter((c) => !c.parent_id)
        .slice(0, 8)
        .map((c) => ({ id: c.id, name: c.name, icon: categoryIcon(c.slug || c.name) })),
    ],
    [categories],
  );

  const categoryIds = useMemo(() => {
    if (selectedCategory === 'all') return undefined;
    return [selectedCategory, ...categories.filter((c) => c.parent_id === selectedCategory).map((c) => c.id)];
  }, [selectedCategory, categories]);

  // ── The newest open requirements, and how many are open in all ─────────────
  const loadData = useCallback(async () => {
    const [page, counts] = await Promise.all([
      getOpenRequirements({ page: 1, pageSize: FEED_SIZE, sort: 'latest', categoryIds }),
      countOpenRequirements({}, ['all']),
    ]);
    setReqs(page.rows);
    setFailed(Boolean(page.error));
    setOpenTotal(counts.all);
    setLoading(false);
    // tick reloads the feed every two minutes and on "Fresh RFQs"
  }, [categoryIds, tick]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClear = () => {
      setSelectedCategory('all');
      setPageOffset(0);
    };
    window.addEventListener('bulkskart-clear-landing-filters', handleClear);
    return () => window.removeEventListener('bulkskart-clear-landing-filters', handleClear);
  }, []);

  // ── New requirements as buyers post them ───────────────────────────────────
  useEffect(() => {
    const isBot =
      typeof window !== 'undefined' &&
      /Lighthouse|PageSpeed|HeadlessChrome|Googlebot|Chrome-Lighthouse/i.test(navigator.userAgent || '');
    if (isBot) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`live-feed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requirements' }, async (payload) => {
          const id = (payload?.new as { id?: string } | undefined)?.id;
          if (!id) return;
          const { data } = await supabase
            .from('requirements')
            .select('*, profiles!buyer_id(id,full_name,company_name), categories!category_id(id,name,slug)')
            .eq('id', id)
            .maybeSingle();
          const row = data as Requirement | null;
          if (!row || row.status !== 'active' || isSeededRequirement(row)) return;
          if (categoryIds && !categoryIds.includes(row.category_id ?? '')) return;
          setReqs((prev) => (prev.some((p) => p.id === row.id) ? prev : [row, ...prev].slice(0, FEED_SIZE)));
          setOpenTotal((n) => (n === null ? n : n + 1));
        })
        .subscribe((status, err) => {
          if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) && channel) {
            supabase.removeChannel(channel);
            channel = null;
          }
        });
    } catch {
      // The feed still works without realtime; it reloads every two minutes.
    }
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [categoryIds]);

  const handleFreshRFQs = () => {
    setIsRefreshing(true);
    setPageOffset(0);
    setTick((t) => t + 1);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const pageCount = Math.max(1, Math.ceil(reqs.length / CARDS_PER_VIEW));
  const currentPage = Math.min(pageOffset, pageCount - 1);
  const visibleReqs = reqs.slice(currentPage * CARDS_PER_VIEW, currentPage * CARDS_PER_VIEW + CARDS_PER_VIEW);
  const firstShown = reqs.length ? currentPage * CARDS_PER_VIEW + 1 : 0;
  const lastShown = currentPage * CARDS_PER_VIEW + visibleReqs.length;

  const handleViewRFQ = (req: Requirement) => {
    navigate(`/requirement/${req.req_number || req.id}`);
  };

  // Send Quote: only a registered business with a paid plan can quote, as on the requirement page.
  const handleOpenRespond = async (req: Requirement) => {
    if (!user || !profile) { setDialogReason('not_logged_in'); setDialogOpen(true); return; }
    if (!company) { setDialogReason('not_registered_business'); setDialogOpen(true); return; }
    const check = await checkSupplierPaidSubscription(company.id, company);
    if (!check.allowed) {
      setDialogReason(check.reason === 'no_subscription' ? 'quotation_subscription' : check.reason);
      setDialogOpen(true);
      return;
    }
    setRespondDialogReq(req);
  };

  return (
    <section className="w-full py-3 sm:py-5 bg-background border-b border-border text-foreground relative overflow-hidden">
      <div className="w-full max-w-[1400px] mx-auto px-3.5 sm:px-5 md:px-6">

        {/* ── LIVE FEED HEADER ─────────────────────────────── */}
        <div className="mb-2 sm:mb-2.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-2 h-2 rounded-full bg-[#FF5A00] animate-pulse shadow-[0_0_8px_#FF5A00]" />
            <span className="text-[10px] font-black text-[#FF5A00] tracking-widest uppercase">
              LIVE FEED
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight leading-tight">
            Live <span className="text-[#FF5A00]">Buying Requirements</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The newest requirements posted by buyers on BulkSkart
          </p>
        </div>

        {/* ── STATS & ACTIONS ROW ─────────────────────────── */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 mb-2.5 w-full">
          <button
            type="button"
            onClick={handleFreshRFQs}
            className="flex h-11 shrink-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-orange-500/40 bg-card px-3 text-sm font-bold text-orange-700 shadow-sm transition-all active:scale-95 hover:bg-muted dark:text-orange-300 sm:flex-initial"
            title="Check for new requirements"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#FF5A00] shrink-0 transition-transform duration-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="truncate">Fresh RFQs</span>
          </button>

          <div className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 shadow-sm sm:flex-initial">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
            </span>
            <div className="text-left leading-tight truncate">
              <div className="text-xs sm:text-sm font-black text-foreground leading-tight">
                {openTotal === null ? '–' : openTotal.toLocaleString()}
              </div>
              <div className="text-sm font-medium leading-none text-muted-foreground">Open RFQs</div>
            </div>
          </div>

          <Link to="/requirements" className="flex-1 sm:flex-initial">
            <Button className="h-11 w-full gap-1.5 rounded-lg bg-[#FF5A00] px-3 text-sm font-bold text-white shadow-[0_2px_8px_rgba(255,90,0,0.3)] transition-all hover:bg-[#e04f00] sm:w-auto">
              <span className="truncate">View All</span> <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </Button>
          </Link>
        </div>

        {/* ── CATEGORY FILTER TABS ────────────────────────── */}
        <div className="w-full max-w-full flex items-center gap-1.5 overflow-x-auto pb-1.5 mb-2 scrollbar-none scroll-smooth overscroll-x-contain touch-pan-x">
          {categoryTabs.map(cat => {
            const active = selectedCategory === cat.id;
            const Icon = cat.icon;
            return (
              <button
                type="button"
                key={cat.id}
                aria-pressed={active}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setPageOffset(0);
                }}
                className={`flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-all ${
                  active
                    ? 'bg-primary/15 text-primary border border-primary shadow-sm font-bold'
                    : 'bg-card text-foreground/80 hover:text-foreground border border-border hover:border-foreground/20'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* ── FEED BAR: what is shown, and paging ───────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-2.5 sm:p-3 mb-3.5 flex items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="flex items-center gap-1.5 font-bold text-orange-700 dark:text-orange-400 bg-orange-500/10 border border-orange-500/30 px-2.5 py-1 rounded-full text-[11px] shadow-sm shrink-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
              </span>
              NEWEST FIRST
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {reqs.length > 0 ? (
                <>Showing <strong className="text-foreground">{firstShown}–{lastShown}</strong> of the {reqs.length} newest</>
              ) : (
                'New posts appear here as buyers post them'
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setPageOffset(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              aria-label="Previous requirements"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted text-foreground transition-colors hover:bg-muted/80 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPageOffset(Math.min(pageCount - 1, currentPage + 1))}
              disabled={currentPage >= pageCount - 1}
              aria-label="Next requirements"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#FF5A00] font-bold text-white shadow-sm transition-colors hover:bg-[#e04f00] disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── RFQ CARDS (Compact 2-col desktop layout) ── */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
          {loading && reqs.length === 0 ? (
            [1, 2, 3, 4].map(n => (
              <div key={n} className="h-44 rounded-2xl bg-muted/40 animate-pulse border border-border" />
            ))
          ) : visibleReqs.length === 0 ? (
            <div className="text-center py-12 w-full bg-card rounded-2xl border border-border md:col-span-2">
              <p className="text-muted-foreground text-xs sm:text-sm">
                {failed
                  ? 'Requirements could not be loaded just now.'
                  : selectedCategory === 'all'
                    ? 'No open requirements right now.'
                    : 'No open requirements in this category right now.'}
              </p>
              <Button
                size="sm"
                onClick={() => (selectedCategory === 'all' ? handleFreshRFQs() : setSelectedCategory('all'))}
                className="mt-3 text-xs h-9 px-4 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-semibold rounded-lg"
              >
                {selectedCategory === 'all' ? 'Check again' : 'View All Categories'}
              </Button>
            </div>
          ) : (
            visibleReqs.map((req, index) => {
              const visual = getRequirementVisualInfo(req, index);
              const isMine = Boolean(user && req.buyer_id === user.id);
              const quotes = Number(req.quote_count) || 0;

              return (
                <div
                  key={req.id}
                  className="bg-card hover:bg-muted/50 border border-border hover:border-[#FF5A00]/50 rounded-xl p-2.5 sm:p-3 transition-all shadow-sm group flex flex-col justify-between w-full min-w-0"
                >
                  <div className="w-full min-w-0">
                    <div className="flex gap-2.5 sm:gap-3 items-start w-full min-w-0">
                      {/* The buyer's own photo, or a plain tile */}
                      <button
                        type="button"
                        onClick={() => handleViewRFQ(req)}
                        aria-label={`Open ${visual.cleanTitle}`}
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-muted border border-border relative cursor-pointer aspect-square shadow-sm"
                      >
                        <RequirementThumb src={visual.image} alt={visual.cleanTitle} slug={req.categories?.slug || req.categories?.name || ''} />
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          {visual.tag.type === 'urgent' ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md tracking-wider uppercase flex items-center gap-0.5 bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30">
                              <Zap className="w-2.5 h-2.5 fill-current text-orange-500" />
                              URGENT
                            </span>
                          ) : visual.tag.type === 'new' ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md tracking-wider uppercase bg-orange-600 text-white">
                              New
                            </span>
                          ) : visual.tag.type === 'expiring' ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md tracking-wider uppercase bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30">
                              Closing soon
                            </span>
                          ) : null}
                          {visual.verifiedStatus && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md tracking-wider uppercase bg-[#FF5A00] text-white">
                              Verified buyer
                            </span>
                          )}
                          {visual.governmentTenderUrl && <GovernmentTenderBadge />}
                          <span className="text-[9.5px] text-muted-foreground ml-auto font-mono shrink-0">
                            {timeAgo(req.created_at)}
                          </span>
                        </div>

                        <h3
                          onClick={() => handleViewRFQ(req)}
                          className="mt-1 cursor-pointer text-sm font-bold leading-snug text-foreground line-clamp-2 transition-colors group-hover:text-[#FF5A00] sm:text-base"
                        >
                          {visual.cleanTitle}
                        </h3>

                        {visual.subtitle && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-1">
                            {visual.subtitle}
                          </p>
                        )}
                        {visual.governmentTenderUrl && (
                          <ExternalSourceLink
                            href={visual.governmentTenderUrl}
                            onClick={(event) => event.stopPropagation()}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#FF5A1F] hover:text-[#e04e00]"
                          >
                            View bid on GeM
                          </ExternalSourceLink>
                        )}

                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1.5 pt-1.5 border-t border-border text-[11px]">
                          <div className="min-w-0">
                            <div className="font-bold text-[#FF5A00] flex items-center gap-1 leading-tight truncate">
                              <Package className="w-3 h-3 text-[#FF5A00] shrink-0" />
                              <span className="truncate">{visual.quantityDisplay}</span>
                            </div>
                            <div className="text-[9px] text-muted-foreground leading-none mt-0.5">Quantity</div>
                          </div>

                          <div className="min-w-0">
                            <div className={`flex items-center gap-1 font-medium leading-tight truncate ${visual.hasLocation ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                              <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span className="truncate" title={visual.locationDisplay}>
                                {visual.hasLocation ? visual.locationDisplay : 'Not stated'}
                              </span>
                            </div>
                            <div className="text-[9px] text-muted-foreground leading-none mt-0.5">Delivery to</div>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1 text-foreground font-medium leading-tight truncate">
                              <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span className="truncate">
                                {req.deadline
                                  ? new Date(`${req.deadline.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                  : 'Not set'}
                              </span>
                            </div>
                            <div className="text-[9px] text-muted-foreground leading-none mt-0.5">Deadline</div>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1 text-foreground font-medium leading-tight truncate">
                              {visual.verifiedStatus ? (
                                <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
                              ) : (
                                <MessageSquare className="w-3 h-3 text-muted-foreground shrink-0" />
                              )}
                              <span className="truncate">{quotes} quote{quotes === 1 ? '' : 's'}</span>
                            </div>
                            <div className="text-[9px] text-muted-foreground leading-none mt-0.5">Received</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mt-2 pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      onClick={() => handleViewRFQ(req)}
                      className="w-full border-border bg-card hover:bg-muted font-medium text-[11px] sm:text-xs h-8 rounded-lg transition-all px-1 truncate shadow-none"
                    >
                      <span className="truncate">View Details</span>
                    </Button>
                    {isMine ? (
                      <Button
                        variant="outline"
                        onClick={() => handleViewRFQ(req)}
                        className="w-full font-bold text-[11px] sm:text-xs h-8 rounded-lg gap-1 transition-all px-1"
                      >
                        <span className="truncate">Your requirement</span>
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleOpenRespond(req)}
                        className="w-full bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold text-[11px] sm:text-xs h-8 rounded-lg shadow-sm gap-1 transition-all px-1"
                      >
                        <span className="truncate">Send Quote</span>
                        <ArrowRight className="w-3 h-3 shrink-0" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {respondDialogReq && user && company && (
        <SupplierRespondDialog
          requirement={respondDialogReq}
          open={!!respondDialogReq}
          onClose={() => setRespondDialogReq(null)}
          supplierId={user.id}
          supplierCompanyId={company.id}
          onResponded={() => {
            setRespondDialogReq(null);
            setTick((t) => t + 1);
          }}
        />
      )}

      <SubscribeToContactDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        reason={dialogReason}
      />
    </section>
  );
}
