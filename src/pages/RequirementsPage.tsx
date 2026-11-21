import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MainLayout from '@/components/layouts/MainLayout';
import {
  Search, ArrowRight, FileText, MessageSquare, Clock,
  Package, Zap, Plus, Eye, Calendar,
  Radio, User, MapPin, Tag, CheckCircle2,
  Boxes, Sparkles, RefreshCw
} from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';
import Breadcrumbs from '@/components/common/Breadcrumbs';
import {
  getCategories,
  checkSupplierPaidSubscription,
  getOpenRequirements,
  countOpenRequirements,
  getOpenRequirementPlaces,
  type OpenRequirementSort,
  type OpenRequirementTab,
} from '@/lib/api';
import type { Requirement, Category } from '@/types/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import SubscribeToContactDialog from '@/components/common/SubscribeToContactDialog';
import { toast } from 'sonner';
import PostRequirementDialog from '@/components/common/PostRequirementDialog';
import SupplierRespondDialog from '@/components/common/SupplierRespondDialog';
import RequirementDetailDrawer from '@/components/common/RequirementDetailDrawer';
import { getRequirementVisualInfo, placeLabel, quantityLabel } from '@/lib/requirementVisuals';
import RequirementThumb, { categoryIcon } from '@/components/common/RequirementThumb';
import { ExternalSourceLink, GovernmentTenderBadge } from '@/components/common/ExternalSourceLink';
import PublicListingsSection from '@/components/common/PublicListingsSection';

const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes
const PAGE_SIZE = 12;

type GateReason = React.ComponentProps<typeof SubscribeToContactDialog>['reason'];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return '1 hr ago';
  if (hrs < 24) return `${hrs} hrs ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function AnimatedCount({ target }: { target: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.max(1, Math.ceil(target / 40));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setDisplay(target); clearInterval(timer); }
      else setDisplay(start);
    }, 25);
    return () => clearInterval(timer);
  }, [target]);
  return <>{display.toLocaleString()}</>;
}

const TAB_LABELS: { key: OpenRequirementTab; label: string; icon?: React.ComponentType<{ className?: string }>; iconClass?: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'urgent', label: 'Urgent', icon: Zap, iconClass: 'text-orange-500' },
  { key: 'new', label: 'New', icon: Sparkles, iconClass: 'text-orange-500' },
  { key: 'expiring', label: 'Closing soon', icon: Clock, iconClass: 'text-orange-500' },
];

// Deal status pipeline config for My Requirements tab
type DealStatus = 'active' | 'responses_received' | 'negotiation' | 'deal_finalized' | 'fulfilled' | 'closed';

const DEAL_STAGES: { key: DealStatus; label: string; short: string }[] = [
  { key: 'active',             label: 'Active',             short: 'Active' },
  { key: 'responses_received', label: 'Responses Received', short: 'Responses' },
  { key: 'negotiation',        label: 'Negotiation',        short: 'Negotiation' },
  { key: 'deal_finalized',     label: 'Deal Finalized',     short: 'Finalized' },
  { key: 'fulfilled',          label: 'Fulfilled',          short: 'Fulfilled' },
  { key: 'closed',             label: 'Closed',             short: 'Closed' },
];

const STATUS_COLOR: Record<DealStatus, string> = {
  active:             'bg-[#FF5A00]/10 text-[#FF5A00] border-[#FF5A00]/30',
  responses_received: 'bg-primary/10 text-primary border-primary/30',
  negotiation:        'bg-orange-500/10 text-orange-500 border-orange-500/30',
  deal_finalized:     'bg-orange-500/10 text-orange-500 border-orange-500/30',
  fulfilled:          'bg-orange-500/10 text-orange-500 border-orange-500/30',
  closed:             'bg-muted text-muted-foreground border-border',
};

function StatusPipeline({ current }: { current: DealStatus }) {
  const idx = DEAL_STAGES.findIndex(s => s.key === current);
  return (
    <div className="flex items-center gap-0 w-full mt-3 overflow-x-auto pb-0.5">
      {DEAL_STAGES.map((stage, i) => {
        const done = i < idx;
        const active = i === idx;
        const last = i === DEAL_STAGES.length - 1;
        return (
          <div key={stage.key} className="flex items-center shrink-0">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
              active
                ? 'bg-[#FF5A00] text-white shadow-sm'
                : done
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-muted text-muted-foreground'
            }`}>
              {done && <CheckCircle2 className="w-2.5 h-2.5" />}
              {stage.short}
            </div>
            {!last && <span className="text-muted-foreground/50 mx-0.5 text-xs">›</span>}
          </div>
        );
      })}
    </div>
  );
}

function MyRequirementCard({
  req,
  onView,
}: {
  req: Requirement;
  onView: (req: Requirement) => void;
}) {
  const dealStatus = ((req as unknown as { deal_status?: DealStatus }).deal_status) || 'active';

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between gap-3 shadow-md hover:border-[#FF5A00]/40 transition-all">
      <div className="flex items-start justify-between gap-2">
        <span className={`text-[10px] font-semibold border rounded-full px-2.5 py-0.5 ${STATUS_COLOR[dealStatus]}`}>
          {DEAL_STAGES.find(s => s.key === dealStatus)?.label ?? dealStatus}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {new Date(req.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
        </span>
      </div>

      <div>
        <h3 className="text-base font-bold text-foreground leading-snug line-clamp-2">{req.title}</h3>
        {req.categories && (
          <div className="flex items-center gap-1 mt-1">
            <Tag className="w-3 h-3 text-[#FF5A00]" />
            <span className="text-xs text-[#FF5A00] font-medium">{req.categories.name}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Package className="w-3 h-3 shrink-0 text-[#FF5A00]" />
          {req.quantity.toLocaleString()} {req.quantity_unit}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3 shrink-0 text-[#FF5A00]" />
          <span className={req.quote_count > 0 ? 'text-[#FF5A00] font-bold' : ''}>
            {req.quote_count} quote{req.quote_count !== 1 ? 's' : ''}
          </span>
        </span>
      </div>

      <StatusPipeline current={dealStatus} />

      <Button
        size="sm"
        onClick={() => onView(req)}
        className="w-full mt-2 bg-[#FF5A00] hover:bg-[#e04e00] text-white text-xs h-9 font-semibold shadow-[0_2px_10px_rgba(255,90,0,0.3)] gap-1.5 rounded-xl"
      >
        <Eye className="w-3.5 h-3.5" /> View Quotes & Chat
      </Button>
    </div>
  );
}

export default function RequirementsPage() {
  const { profile, company, user } = useAuth();
  const navigate = useNavigate();

  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [places, setPlaces] = useState<{ value: string; label: string; count: number }[]>([]);
  const [latest, setLatest] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedSort, setSelectedSort] = useState<OpenRequirementSort>('latest');
  const [statusFilter, setStatusFilter] = useState<OpenRequirementTab>('all');
  const [totalCount, setTotalCount] = useState(0);
  const [tabCounts, setTabCounts] = useState<Record<OpenRequirementTab, number | null>>({ all: null, urgent: null, new: null, expiring: null });
  const [openTotal, setOpenTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Dialog and drawer state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogReason, setDialogReason] = useState<GateReason>('no_subscription');
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [respondDialogReq, setRespondDialogReq] = useState<Requirement | null>(null);
  const [detailDrawerReq, setDetailDrawerReq] = useState<Requirement | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'feed' | 'mine'>('feed');
  const [myReqs, setMyReqs] = useState<Requirement[]>([]);
  const [myReqsLoading, setMyReqsLoading] = useState(false);

  // Load categories
  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  // Category chips: the top-level categories, in the site's own order.
  const categoryChips = useMemo(
    () => [
      { id: 'all', name: 'All Categories', icon: Boxes as React.ComponentType<{ className?: string }> },
      ...categories
        .filter((c) => !c.parent_id)
        .slice(0, 12)
        .map((c) => ({ id: c.id, name: c.name, icon: categoryIcon(c.slug || c.name) })),
    ],
    [categories],
  );

  // A chosen category also covers its sub-categories.
  const categoryIds = useMemo(() => {
    if (selectedCat === 'all') return undefined;
    return [selectedCat, ...categories.filter((c) => c.parent_id === selectedCat).map((c) => c.id)];
  }, [selectedCat, categories]);

  // Apply what is typed in the search box after a short pause.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Check for new requirements every two minutes.
  useEffect(() => {
    const timer = setInterval(() => setRefreshTick((t) => t + 1), REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const filters = useMemo(
    () => ({
      categoryIds,
      search: search || undefined,
      location: selectedLocation === 'all' ? undefined : selectedLocation,
    }),
    [categoryIds, search, selectedLocation],
  );

  // One page of open requirements, straight from the database.
  const loadRequirements = useCallback(async () => {
    setLoading(true);
    const result = await getOpenRequirements({ ...filters, tab: statusFilter, sort: selectedSort, page, pageSize: PAGE_SIZE });
    setRequirements(result.rows);
    setTotalCount(result.total);
    setLoadError(result.error);
    setLoading(false);
    // refreshTick is a dependency so the two-minute check reloads the page
  }, [filters, statusFilter, selectedSort, page, refreshTick]);

  useEffect(() => {
    loadRequirements();
  }, [loadRequirements]);

  // How many requirements each tab holds under the current filters.
  useEffect(() => {
    let alive = true;
    countOpenRequirements(filters).then((counts) => {
      if (alive) setTabCounts(counts);
    });
    return () => {
      alive = false;
    };
  }, [filters, refreshTick]);

  // The whole board: open total, newest posts and the places buyers deliver to.
  useEffect(() => {
    let alive = true;
    countOpenRequirements({}, ['all']).then((counts) => alive && setOpenTotal(counts.all));
    getOpenRequirements({ page: 1, pageSize: 3, sort: 'latest' }).then((result) => alive && setLatest(result.rows));
    getOpenRequirementPlaces().then((list) => alive && setPlaces(list));
    return () => {
      alive = false;
    };
  }, [refreshTick]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, selectedCat, selectedLocation, statusFilter, selectedSort]);

  // Load buyer's own requirements
  useEffect(() => {
    if (activeTab !== 'mine' || !user) return;
    setMyReqsLoading(true);
    import('@/db/supabase').then(async ({ supabase }) => {
      const { data, error } = await supabase
        .from('requirements')
        .select(`
          *,
          categories ( id, name, slug ),
          profiles:buyer_id ( id, full_name, company_name )
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) toast.error('Failed to load your requirements');
      setMyReqs((data as unknown as Requirement[]) ?? []);
      setMyReqsLoading(false);
    });
  }, [activeTab, user, refreshTick]);

  const resetFilters = () => {
    setSelectedCat('all');
    setSelectedLocation('all');
    setStatusFilter('all');
    setSearchInput('');
    setSearch('');
  };

  // Handlers
  const handleOpenPostDialog = () => {
    if (!user || !profile) { setDialogReason('not_logged_in'); setDialogOpen(true); return; }
    setPostDialogOpen(true);
  };

  const handleOpenDetail = (req: Requirement) => {
    navigate(`/requirement/${req.req_number || req.id}`);
  };

  // Send Quote: only for a registered business with a paid plan, as on the requirement page.
  const handleViewAndQuote = async (req: Requirement) => {
    if (!user || !profile) {
      setDialogReason('not_logged_in');
      setDialogOpen(true);
      return;
    }
    if (!company) {
      setDialogReason('not_registered_business');
      setDialogOpen(true);
      return;
    }
    const check = await checkSupplierPaidSubscription(company.id, company);
    if (!check.allowed) {
      setDialogReason(check.reason === 'no_subscription' ? 'quotation_subscription' : check.reason);
      setDialogOpen(true);
      return;
    }
    setRespondDialogReq(req);
  };

  return (
    <MainLayout>
      <PageMeta
        title="Live Buying Requirements & Active B2B RFQs | BulkSkart"
        description="Browse open bulk buying requirements posted by buyers on BulkSkart. Filter by category, delivery location and deadline, and send your quotation to the buyer directly."
        keywords="active buying requirements, live bulk RFQs, buyer purchase requirements, wholesale supply leads, B2B procurement requests, direct factory tender"
        canonical="/requirements"
        ogType="website"
        breadcrumbs={[
          { name: 'Home', item: '/' },
          { name: 'Buying Requirements', item: '/requirements' },
        ]}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Live B2B Buying Requirements & RFQs',
          description: 'Open bulk purchase requirements posted by buyers on BulkSkart.',
          url: 'https://www.bulkskart.com/requirements',
        }}
      />

      <div className="bg-background text-foreground min-h-screen pb-20">
        <div className="max-w-[1240px] mx-auto px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">

          {/* Visual Breadcrumb Trail */}
          <Breadcrumbs
            items={[{ name: 'Active Buying Requirements' }]}
            className="mb-3"
          />

          {/* ── 1. Top Search Bar exactly matching Image 2 ───────────────── */}
          <div className="mb-4">
            <div className="flex items-center bg-card border border-border rounded-2xl p-1 sm:p-1.5 shadow-sm focus-within:border-[#FF5A00]/60 transition-colors">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 ml-2.5 sm:ml-3 text-muted-foreground shrink-0" />
              <Input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput.trim()); }}
                aria-label="Search buying requirements"
                placeholder="Search requirements by product or keyword..."
                className="flex-1 bg-transparent border-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 text-xs sm:text-sm md:text-base h-10 sm:h-11 px-2 sm:px-3"
              />
              <Button
                onClick={() => setSearch(searchInput.trim())}
                className="bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold h-9 sm:h-11 px-4 sm:px-7 rounded-xl shadow-[0_2px_10px_rgba(255,90,0,0.35)] shrink-0 text-xs sm:text-sm"
              >
                Search
              </Button>
            </div>
          </div>

          {/* ── 2. Category Horizontal Selector Pills matching Image 2 ───── */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 mb-4 sm:mb-6 scrollbar-none overscroll-x-contain touch-pan-x">
            {categoryChips.map(cat => {
              const Icon = cat.icon;
              const active = selectedCat === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.id)}
                  className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                    active
                      ? 'bg-[#FF5A00] text-white shadow-[0_2px_12px_rgba(255,90,0,0.35)] font-bold'
                      : 'bg-card text-foreground/80 hover:text-foreground border border-border hover:border-[#FF5A00]/40'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* ── 3. Header Block matching Image 2 ─────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5A00] animate-pulse" />
                <span className="text-[11px] font-extrabold text-[#FF5A00] uppercase tracking-widest">
                  OPEN REQUIREMENTS
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                Active Buying <span className="text-[#FF5A00]">Requirements</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Bulk buying requirements posted by buyers on BulkSkart
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Active RFQs Stat Badge */}
              <div className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-4 py-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                </span>
                <div>
                  <div className="text-lg font-black text-foreground leading-none">
                    {openTotal === null ? '–' : <AnimatedCount target={openTotal} />}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium">Open RFQs</div>
                </div>
              </div>

              {/* + Post Requirement Button */}
              <Button
                onClick={handleOpenPostDialog}
                className="bg-[#FF5A00] hover:bg-[#e04e00] text-white font-bold h-12 px-5 rounded-xl shadow-[0_2px_12px_rgba(255,90,0,0.35)] flex items-center gap-2 text-left"
              >
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-black uppercase leading-none">Post Requirement</div>
                  <div className="text-[10px] text-white/80 font-normal leading-tight mt-0.5">Get quotes from suppliers</div>
                </div>
              </Button>
            </div>
          </div>

          {/* ── Latest posts: the three newest open requirements ─────────── */}
          {latest.length > 0 && (
            <div className="mb-5 bg-card border border-border rounded-xl px-4 py-2 flex items-center justify-between gap-3 text-xs overflow-hidden">
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                </span>
                <span className="font-extrabold text-orange-600 dark:text-orange-400 text-[11px] uppercase tracking-wider">LATEST</span>
                <span className="text-muted-foreground/40 hidden sm:inline">|</span>
              </div>
              <div className="overflow-x-auto no-scrollbar whitespace-nowrap text-muted-foreground text-xs flex items-center gap-6 flex-1 px-2">
                {latest.map((item, i) => {
                  const place = placeLabel(item);
                  return (
                    <React.Fragment key={item.id}>
                      {i > 0 && <span className="text-border">•</span>}
                      <Link to={`/requirement/${item.req_number || item.id}`} className={`inline-flex items-center gap-1.5 hover:text-foreground ${i === 0 ? 'text-foreground' : ''}`}>
                        <span className="text-[#FF5A00] font-bold">{timeAgo(item.created_at)}:</span>
                        {quantityLabel(item)} {item.title}{place ? ` · ${place}` : ''}
                      </Link>
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="text-[11px] text-muted-foreground/60 shrink-0 font-medium hidden md:block">
                Checks for new posts every 2 minutes
              </div>
            </div>
          )}

          {/* ── Tabs (Live Feed / My Requirements) ───────────────────────── */}
          <div className="flex items-center gap-2 mb-5">
            <button
              onClick={() => setActiveTab('feed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === 'feed'
                  ? 'bg-muted text-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-[#FF5A00]" /> Live Feed Board
            </button>
            {user && (
              <button
                onClick={() => setActiveTab('mine')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === 'mine'
                    ? 'bg-muted text-foreground border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <User className="w-3.5 h-3.5 text-[#FF5A00]" /> My Requirements
                {myReqs.length > 0 && (
                  <span className="text-[10px] font-bold bg-[#FF5A00] text-white rounded-full px-1.5 py-0.2">
                    {myReqs.length}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* ═════════ MY REQUIREMENTS TAB ═════════ */}
          {activeTab === 'mine' && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">Your Posted Requirements</h2>
                <Button
                  onClick={handleOpenPostDialog}
                  size="sm"
                  className="bg-[#FF5A00] hover:bg-[#e04e00] text-white font-bold gap-1 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Post New
                </Button>
              </div>

              {myReqsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="h-48 rounded-2xl bg-muted/40 animate-pulse border border-border" />
                  ))}
                </div>
              ) : myReqs.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-10 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-foreground font-semibold">No requirements posted yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Post your first bulk requirement and receive quotes from suppliers</p>
                  <Button
                    onClick={handleOpenPostDialog}
                    className="bg-[#FF5A00] hover:bg-[#e04e00] text-white font-bold gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Post a Requirement
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {myReqs.map(req => (
                    <MyRequirementCard
                      key={req.id}
                      req={req}
                      onView={handleOpenDetail}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═════════ LIVE FEED TAB ═════════ */}
          {activeTab === 'feed' && (
            <>
              {/* ── 4. Filter Bar matching Image 2 ─────────────────────────── */}
              <div className="space-y-4 mb-6">
                {/* 3 Dropdown Row: Location, Category, Sort */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Location Dropdown */}
                  <div className="bg-card border border-border rounded-xl px-3 py-1 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#FF5A00] shrink-0" />
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger aria-label="Delivery location" className="w-full bg-transparent border-0 text-foreground text-xs h-9 p-0 focus:ring-0">
                        <SelectValue placeholder="All locations" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-foreground">
                        <SelectItem value="all">All locations</SelectItem>
                        {places.map(place => (
                          <SelectItem key={place.value} value={place.value}>
                            {place.label} ({place.count.toLocaleString()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category Dropdown */}
                  <div className="bg-card border border-border rounded-xl px-3 py-1 flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#FF5A00] shrink-0" />
                    <Select value={selectedCat} onValueChange={setSelectedCat}>
                      <SelectTrigger aria-label="Category" className="w-full bg-transparent border-0 text-foreground text-xs h-9 p-0 focus:ring-0">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-foreground">
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.parent_id ? `— ${c.name}` : c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sort Dropdown */}
                  <div className="bg-card border border-border rounded-xl px-3 py-1 flex items-center gap-2">
                    <span className="text-[#FF5A00] text-sm font-bold">⇅</span>
                    <Select value={selectedSort} onValueChange={(value) => setSelectedSort(value as OpenRequirementSort)}>
                      <SelectTrigger aria-label="Sort" className="w-full bg-transparent border-0 text-foreground text-xs h-9 p-0 focus:ring-0">
                        <SelectValue placeholder="Latest First" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-foreground">
                        <SelectItem value="latest">Latest First</SelectItem>
                        <SelectItem value="quotes_high">Most Quotes Received</SelectItem>
                        <SelectItem value="qty_high">Quantity: High to Low</SelectItem>
                        <SelectItem value="deadline">Deadline: Soonest First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Status tabs with the real number of requirements in each */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {TAB_LABELS.map(tab => {
                    const active = statusFilter === tab.key;
                    const Icon = tab.icon;

                    return (
                      <button
                        key={tab.key}
                        onClick={() => setStatusFilter(tab.key)}
                        aria-pressed={active}
                        className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-all shrink-0 ${
                          active
                            ? 'bg-[#FF5A00] text-white shadow-[0_2px_10px_rgba(255,90,0,0.35)] font-bold'
                            : 'bg-card text-foreground/80 hover:text-foreground border border-border hover:border-[#FF5A00]/40'
                        }`}
                      >
                        {Icon && <Icon className={`w-3 h-3 ${tab.iconClass}`} />}
                        <span>{tab.label}</span>
                        {tabCounts[tab.key] !== null && (
                          <span className={`text-[11px] ${active ? 'text-white/90' : 'text-muted-foreground'}`}>
                            ({(tabCounts[tab.key] ?? 0).toLocaleString()})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── 5. Requirements Cards List matching Image 2 ────────────── */}
              <div className="space-y-3.5 mb-8">
                {loading && requirements.length === 0 ? (
                  <div className="space-y-3 py-6">
                    {[1, 2, 3, 4].map(n => (
                      <div key={n} className="h-28 rounded-2xl bg-muted/40 animate-pulse border border-border" />
                    ))}
                  </div>
                ) : loadError && requirements.length === 0 ? (
                  <div className="text-center py-16 bg-card rounded-2xl border border-border">
                    <p className="text-foreground text-sm font-semibold">Requirements could not be loaded.</p>
                    <p className="text-muted-foreground text-xs mt-1">Check your connection and try again.</p>
                    <Button
                      size="sm"
                      onClick={() => setRefreshTick(t => t + 1)}
                      className="mt-3 text-xs bg-muted hover:bg-muted/80 text-foreground border border-border gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Try again
                    </Button>
                  </div>
                ) : requirements.length === 0 ? (
                  <div className="text-center py-16 bg-card rounded-2xl border border-border">
                    {search || selectedCat !== 'all' || selectedLocation !== 'all' || statusFilter !== 'all' ? (
                      <>
                        <p className="text-muted-foreground text-sm">No open requirements match your filters.</p>
                        <Button
                          size="sm"
                          onClick={resetFilters}
                          className="mt-3 text-xs bg-muted hover:bg-muted/80 text-foreground border border-border"
                        >
                          Reset All Filters
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-foreground text-sm font-semibold">No open requirements right now.</p>
                        <p className="text-muted-foreground text-xs mt-1">Post what you need and suppliers can send you quotes.</p>
                        <Button
                          size="sm"
                          onClick={handleOpenPostDialog}
                          className="mt-3 text-xs bg-[#FF5A00] hover:bg-[#e04e00] text-white font-bold gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Post Requirement
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  requirements.map((req, index) => {
                    const visual = getRequirementVisualInfo(req, index);
                    const isMine = Boolean(user && req.buyer_id === user.id);

                    return (
                      <div
                        key={req.id}
                        className="group bg-card hover:bg-muted/30 border border-border hover:border-[#FF5A00]/40 rounded-2xl p-4 md:p-5 transition-all duration-200 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
                      >
                        {/* Left: the buyer's own photo, or a plain tile */}
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(req)}
                          aria-label={`Open ${visual.cleanTitle}`}
                          className="w-full md:w-28 h-28 rounded-xl overflow-hidden shrink-0 bg-muted border border-border cursor-pointer"
                        >
                          <RequirementThumb src={visual.image} alt={visual.cleanTitle} slug={req.categories?.slug || req.categories?.name || ''} />
                        </button>

                        {/* Center: Details */}
                        <div className="flex-1 min-w-0">
                          {/* Tag Badge */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded tracking-wide uppercase flex items-center gap-1 ${visual.tag.bgClass} ${visual.tag.textClass}`}>
                              {visual.tag.type === 'urgent' && <Zap className="w-2.5 h-2.5 fill-current" />}
                              {visual.tag.label}
                            </span>
                            {req.req_number && (
                              <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">{req.req_number}</span>
                            )}
                          </div>

                          {/* Title with Quantity */}
                          <h3
                            onClick={() => handleOpenDetail(req)}
                            className="text-base md:text-lg font-bold text-foreground leading-snug group-hover:text-primary transition-colors cursor-pointer"
                          >
                            {visual.cleanTitle} - {visual.quantityDisplay}
                          </h3>

                          {/* First line of the buyer's description */}
                          {visual.subtitle && (
                            <p className="text-xs md:text-sm text-muted-foreground mt-0.5 line-clamp-1">
                              {visual.subtitle}
                            </p>
                          )}

                          {visual.governmentTenderUrl && (
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <GovernmentTenderBadge />
                              <ExternalSourceLink
                                href={visual.governmentTenderUrl}
                                className="inline-flex items-center gap-1 text-xs font-bold text-[#FF5A1F] hover:text-[#e04e00]"
                              >
                                View bid on GeM
                              </ExternalSourceLink>
                            </div>
                          )}

                          {/* Category Badge with Icon */}
                          {req.categories?.name && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted/60 border border-border text-foreground/80 mt-1.5">
                              <Tag className="w-3 h-3 text-[#FF5A00]" />
                              <span>{req.categories.name}</span>
                            </div>
                          )}

                          {/* Bottom Meta: Location & posted time */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                            <span className={`flex items-center gap-1 ${visual.hasLocation ? '' : 'italic'}`}>
                              <MapPin className="w-3 h-3 text-[#FF5A00] shrink-0" />
                              {visual.locationDisplay}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 shrink-0" />
                              {timeAgo(req.created_at)}
                            </span>
                          </div>
                        </div>

                        {/* Right Column: Badges & Send Quote Button */}
                        <div className="w-full md:w-auto shrink-0 flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-border">
                          <div className="flex flex-col items-start md:items-end gap-1">
                            {visual.verifiedStatus && (
                              <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                                <span>{visual.verifiedStatus}</span>
                              </div>
                            )}
                            {visual.orderAttribute && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                {visual.attributeIcon === 'calendar' ? (
                                  <Calendar className="w-3.5 h-3.5 text-muted-foreground/60" />
                                ) : (
                                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/60" />
                                )}
                                <span>{visual.orderAttribute}</span>
                              </div>
                            )}
                          </div>

                          {isMine ? (
                            <Button
                              onClick={() => handleOpenDetail(req)}
                              variant="outline"
                              className="font-bold text-sm px-6 py-2.5 rounded-xl shrink-0 gap-1.5"
                            >
                              Your requirement <ArrowRight className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleViewAndQuote(req)}
                              className="bg-[#FF5A00] hover:bg-[#e04e00] text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-[0_2px_10px_rgba(255,90,0,0.35)] shrink-0 gap-1.5"
                            >
                              Send Quote <ArrowRight className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* ── 5.1 Pagination Bar ─────────────────────────────────────── */}
              {totalPages > 1 && (
                <div className="bg-card border border-border rounded-2xl p-4 mb-16 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-muted-foreground">
                    Showing Page <strong className="text-foreground">{page}</strong> of{' '}
                    <strong className="text-foreground">{totalPages.toLocaleString()}</strong> ({totalCount.toLocaleString()} open requirement{totalCount === 1 ? '' : 's'})
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => {
                        setPage(p => Math.max(1, p - 1));
                        window.scrollTo({ top: 350, behavior: 'smooth' });
                      }}
                      className="h-8 px-3 text-xs bg-muted/50 border border-border text-foreground hover:bg-muted disabled:opacity-40"
                    >
                      &larr; Prev
                    </Button>

                    {/* Page Numbers */}
                    {[
                      Math.max(1, page - 2),
                      Math.max(1, page - 1),
                      page,
                      Math.min(totalPages, page + 1),
                      Math.min(totalPages, page + 2),
                    ]
                      .filter((val, idx, arr) => arr.indexOf(val) === idx && val <= totalPages)
                      .map(pNum => (
                        <button
                          key={pNum}
                          onClick={() => {
                            setPage(pNum);
                            window.scrollTo({ top: 350, behavior: 'smooth' });
                          }}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                            pNum === page
                              ? 'bg-[#FF5A00] text-white shadow-[0_0_10px_rgba(255,90,0,0.35)]'
                              : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted border border-border'
                          }`}
                        >
                          {pNum}
                        </button>
                      ))}

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => {
                        setPage(p => Math.min(totalPages, p + 1));
                        window.scrollTo({ top: 350, behavior: 'smooth' });
                      }}
                      className="h-8 px-3 text-xs bg-muted/50 border border-border text-foreground hover:bg-muted disabled:opacity-40"
                    >
                      Next &rarr;
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* ── 6. Bottom Sticky Active Requirements Bar matching Image 2 ─────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-4 md:px-8 py-3 shadow-xl">
        <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
            </span>
            <div>
              <div className="text-xs md:text-sm font-black text-foreground leading-tight flex items-center gap-2">
                {openTotal === null ? (
                  <span>Open requirements</span>
                ) : (
                  <span><AnimatedCount target={openTotal} /> open requirement{openTotal === 1 ? '' : 's'}</span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                Post what you need and get quotes from suppliers
              </div>
            </div>
          </div>

          <Button
            onClick={handleOpenPostDialog}
            className="bg-[#FF5A00] hover:bg-[#e04e00] text-white font-bold h-10 px-5 rounded-xl shadow-[0_2px_10px_rgba(255,90,0,0.35)] flex items-center gap-2 text-xs md:text-sm"
          >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Plus className="w-3.5 h-3.5 text-white" />
            </div>
            Post Requirement
          </Button>
        </div>
      </div>

      {/* ── Dialogs & Drawers ─────────────────────────────────────────────── */}
      {detailDrawerReq && (
        <RequirementDetailDrawer
          requirement={detailDrawerReq}
          open={detailDrawerOpen}
          onClose={() => setDetailDrawerOpen(false)}
          onRequirementUpdated={updated => {
            setDetailDrawerReq(updated);
            setRequirements(prev => prev.map(r => r.id === updated.id ? updated : r));
          }}
        />
      )}

      {respondDialogReq && user && company && (
        <SupplierRespondDialog
          requirement={respondDialogReq}
          open={!!respondDialogReq}
          onClose={() => setRespondDialogReq(null)}
          supplierId={user.id}
          supplierCompanyId={company.id}
          onResponded={() => {
            setRespondDialogReq(null);
            setRefreshTick(t => t + 1);
          }}
        />
      )}

      <PostRequirementDialog
        open={postDialogOpen}
        onClose={() => setPostDialogOpen(false)}
        categories={categories}
        buyerId={user?.id ?? ''}
        onPosted={() => setRefreshTick(t => t + 1)}
      />

      <SubscribeToContactDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        reason={dialogReason}
      />

      {/* buyer requirements from other marketplaces, kept apart from BulkSkart RFQs */}
      <PublicListingsSection />
    </MainLayout>
  );
}
