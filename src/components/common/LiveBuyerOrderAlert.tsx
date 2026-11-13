/**
 * Live buyer-alert popup.
 * Shows only active, unexpired requirements from the database.
 * Buyer names and companies are omitted: the public Buy Leads cards do not show them.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, MessageSquare, Pause, Play, X } from 'lucide-react';
import { supabase } from '@/db/supabase';
import { checkDirectMessageQuota, checkSupplierPaidSubscription } from '@/lib/api';
import type { Requirement } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import SubscribeToContactDialog, { type SubscriptionReason } from '@/components/common/SubscribeToContactDialog';
import SupplierRespondDialog from '@/components/common/SupplierRespondDialog';
import { resolveRfqImage } from '@/lib/contentImages';

const DISMISS_KEY = 'bsk_live_buyer_alert_dismissed';
const LEGACY_DISMISS_KEY = 'bsk_lead_popup_session';
const PAUSE_KEY = 'bsk_live_buyer_alert_paused';
const ROTATE_MS = 6000;
const POLL_MS = 60_000;
const LEAD_LIMIT = 12;

const LEAD_SELECT =
  'id,req_number,title,quantity,quantity_unit,destination_city,destination_country,status,is_verified_buyer,created_at,deadline,expires_at,attachment_url,images,buyer_id,category_id,categories!category_id(id,name,slug)';

type Stats = {
  active: number | null;
  today: number | null;
  buyers: number | null;
  countries: number | null;
};

function isTestTitle(title: string): boolean {
  return /\b(test|debug|timed|timeout)\b/i.test(title) || /^test\b/i.test(title.trim());
}

function activeFilters(nowIso: string) {
  return supabase
    .from('requirements')
    .select(LEAD_SELECT)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .or(`deadline.is.null,deadline.gt.${nowIso}`);
}

function timeAgo(iso?: string | null): string | null {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return null;
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function locationOf(req: Requirement): string | null {
  const city = req.destination_city?.trim();
  const country = req.destination_country?.trim();
  if (city && country) return `${city}, ${country}`;
  return city || country || null;
}

function quantityOf(req: Requirement): string | null {
  const qty = Number(req.quantity);
  if (!Number.isFinite(qty)) return null;
  const unit = req.quantity_unit?.trim();
  const formatted = qty.toLocaleString('en-IN');
  return unit ? `${formatted} ${unit}` : formatted;
}

function leadImage(req: Requirement): string {
  const listed = (req.images || []).find(url => url?.includes('/product-images/catalog/'));
  if (listed) return listed;
  if (req.attachment_url?.includes('/product-images/catalog/')) return req.attachment_url;
  return resolveRfqImage({
    id: req.id,
    title: req.title,
    attachment_url: req.attachment_url,
    category: req.categories?.name,
    categories: req.categories,
  });
}

function dedupe(rows: Requirement[]): Requirement[] {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const out: Requirement[] = [];
  for (const row of rows) {
    if (!row?.id || !row.title) continue;
    if (isTestTitle(row.title)) continue;
    const title = row.title.trim().toLowerCase();
    if (seenIds.has(row.id) || (title && seenTitles.has(title))) continue;
    seenIds.add(row.id);
    if (title) seenTitles.add(title);
    out.push(row);
  }
  return out;
}

function startOfToday(): string {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  return day.toISOString();
}

function readDismissed(): boolean {
  try {
    if (localStorage.getItem(DISMISS_KEY) === '1') return true;
    return sessionStorage.getItem(LEGACY_DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

function Count({ value, reduce }: { value: number; reduce: boolean }) {
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const from = shown;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 700);
      setShown(Math.round(from + (value - from) * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);
  return <>{shown.toLocaleString('en-IN')}</>;
}

export default function LiveBuyerOrderAlert() {
  const { user, profile, company } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const [dismissed, setDismissed] = useState(readDismissed);
  const [paused, setPaused] = useState(() => {
    try { return localStorage.getItem(PAUSE_KEY) === '1'; } catch { return false; }
  });
  const [hovering, setHovering] = useState(false);
  const [ready, setReady] = useState(false);
  const [leads, setLeads] = useState<Requirement[]>([]);
  const [cursor, setCursor] = useState(0);
  const [stats, setStats] = useState<Stats>({ active: null, today: null, buyers: null, countries: null });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogReason, setDialogReason] = useState<SubscriptionReason>('not_logged_in');
  const [respondReq, setRespondReq] = useState<Requirement | null>(null);

  const hiddenRoute =
    location.pathname.includes('/business-setup') ||
    location.pathname.includes('/onboarding') ||
    location.pathname.includes('/post-requirement') ||
    location.pathname.includes('/negotiation') ||
    location.pathname.includes('/auth') ||
    location.pathname.includes('/settings');

  const loadLeads = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const { data, error } = await activeFilters(nowIso)
      .order('created_at', { ascending: false })
      .limit(LEAD_LIMIT);
    if (error) throw error;
    return dedupe((data ?? []) as unknown as Requirement[]);
  }, []);

  const loadStats = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const open = supabase
      .from('requirements')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .or(`deadline.is.null,deadline.gt.${nowIso}`);
    const today = supabase
      .from('requirements')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('created_at', startOfToday())
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .or(`deadline.is.null,deadline.gt.${nowIso}`);
    const places = supabase
      .from('requirements')
      .select('buyer_id,destination_country')
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .or(`deadline.is.null,deadline.gt.${nowIso}`)
      .limit(1000);
    const [activeRes, todayRes, placeRes] = await Promise.all([open, today, places]);
    const rows = (placeRes.data ?? []) as { buyer_id?: string | null; destination_country?: string | null }[];
    const buyers = new Set(rows.map(row => row.buyer_id).filter(Boolean));
    const countries = new Set(rows.map(row => row.destination_country?.trim()).filter(Boolean));
    setStats({
      active: activeRes.error ? null : activeRes.count ?? 0,
      today: todayRes.error ? null : todayRes.count ?? 0,
      buyers: placeRes.error ? null : buyers.size,
      countries: placeRes.error ? null : countries.size,
    });
  }, []);

  useEffect(() => {
    if (dismissed || hiddenRoute) return;
    let cancelled = false;
    const showTimer = window.setTimeout(() => { if (!cancelled) setReady(true); }, 1200);
    (async () => {
      try {
        const [rows] = await Promise.all([loadLeads(), loadStats()]);
        if (!cancelled) setLeads(rows);
      } catch {
        if (!cancelled) setLeads([]);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
    };
  }, [dismissed, hiddenRoute, loadLeads, loadStats]);

  useEffect(() => {
    if (dismissed || hiddenRoute || leads.length === 0) return;
    const timer = window.setInterval(async () => {
      try {
        const newest = leads[0]?.created_at;
        if (!newest) return;
        const nowIso = new Date().toISOString();
        const { data, error } = await activeFilters(nowIso)
          .gt('created_at', newest)
          .order('created_at', { ascending: false })
          .limit(LEAD_LIMIT);
        if (error || !data?.length) return;
        const fresh = dedupe(data as unknown as Requirement[]);
        setLeads(prev => {
          const seen = new Set(prev.map(row => row.id));
          const added = fresh.filter(row => !seen.has(row.id));
          if (added.length === 0) return prev;
          setCursor(0);
          return [...added, ...prev].slice(0, LEAD_LIMIT);
        });
        loadStats();
      } catch {
        /* keep the leads already on screen */
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [dismissed, hiddenRoute, leads, loadStats]);

  useEffect(() => {
    if (dismissed || paused || hovering || reduce || leads.length < 2) return;
    const timer = window.setInterval(() => {
      setCursor(index => (index + 1) % leads.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [dismissed, paused, hovering, reduce, leads.length]);

  const ordered = useMemo(() => {
    if (leads.length === 0) return [];
    return [...leads.slice(cursor), ...leads.slice(0, cursor)];
  }, [leads, cursor]);

  const featured = ordered[0];
  const stacked = ordered.slice(1, 4);
  const visibleStats = [
    stats.active != null ? { label: 'Active Buyer Requirements', value: stats.active } : null,
    stats.today != null ? { label: 'New RFQs Today', value: stats.today } : null,
    stats.buyers != null ? { label: 'Active Buyers', value: stats.buyers } : null,
    stats.countries != null ? { label: 'Countries with Active Demand', value: stats.countries } : null,
  ].filter((item): item is { label: string; value: number } => item !== null);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
      sessionStorage.setItem(LEGACY_DISMISS_KEY, 'true');
    } catch { /* storage blocked */ }
    setDismissed(true);
  };

  const togglePause = () => {
    setPaused(current => {
      const next = !current;
      try { localStorage.setItem(PAUSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const openRequirement = (req: Requirement) => {
    navigate(`/requirement/${req.id}`);
  };

  const contactBuyer = async (req: Requirement) => {
    if (!user || !profile) { setDialogReason('not_logged_in'); setDialogOpen(true); return; }
    if (!company) { setDialogReason('not_registered_business'); setDialogOpen(true); return; }
    const sub = await checkSupplierPaidSubscription(company.id, company);
    if (!sub.allowed) { setDialogReason(sub.reason); setDialogOpen(true); return; }
    const quota = await checkDirectMessageQuota(company.id, company);
    if (quota !== 'ok') { setDialogReason(quota); setDialogOpen(true); return; }
    setRespondReq(req);
  };

  if (dismissed || hiddenRoute || !ready || !featured) return null;

  return (
    <>
      <style>{`
        @keyframes bsk-alert-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes bsk-alert-in { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bsk-sms-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bsk-alert-glow { 0%,100% { box-shadow: 0 0 0 1px rgba(255,101,0,0.4), 0 16px 40px -22px rgba(255,138,0,0.8); } 50% { box-shadow: 0 0 0 1px rgba(255,138,0,0.7), 0 16px 44px -18px rgba(255,101,0,0.9); } }
        @media (prefers-reduced-motion: reduce) {
          .bsk-alert-motion { animation: none !important; }
        }
      `}</style>
      <aside
        className="bsk-alert-motion fixed z-40 flex max-h-[min(100dvh-24px,640px)] w-[calc(100%-24px)] flex-col overflow-hidden rounded-[22px] border border-[#FF6500]/70 bg-[#080808]/92 text-white shadow-[0_18px_50px_-24px_rgba(255,138,0,0.9)] backdrop-blur-xl bottom-[max(12px,env(safe-area-inset-bottom))] left-3 right-3 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[360px]"
        style={{ animation: reduce ? undefined : 'bsk-alert-in 0.4s ease both, bsk-alert-glow 3.6s ease-in-out infinite, bsk-alert-float 4.5s ease-in-out 0.4s infinite' }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        aria-label="Live buyer alert"
      >
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/10 bg-[#080808]/95 px-3 py-2.5 backdrop-blur">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF6500] text-white">
            <MessageSquare className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[13px] font-bold text-white">Bulkskart</p>
              <span className="rounded-full bg-[#FF6500] px-1.5 py-px text-[9px] font-black tracking-wide text-white">SMS</span>
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className={`absolute inline-flex h-full w-full rounded-full bg-[#FF8A00] opacity-70 ${reduce ? '' : 'animate-ping'}`} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#FF8A00]" />
              </span>
            </div>
            <p className="text-[11px] leading-snug text-white/65">New bulk requirements are arriving right now!</p>
          </div>
          <button
            type="button"
            onClick={togglePause}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10"
            aria-label={paused ? 'Resume buyer alerts' : 'Pause buyer alerts'}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10"
            aria-label="Close buyer alerts"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3">
          <FeaturedLead
            req={featured}
            animate={!reduce}
            onView={() => openRequirement(featured)}
            onContact={() => contactBuyer(featured)}
          />

          {stacked.length > 0 && (
            <div className="space-y-2">
              {stacked.map((req, index) => (
                <MiniLead
                  key={req.id}
                  req={req}
                  depth={index}
                  animate={!reduce}
                  onView={() => openRequirement(req)}
                />
              ))}
            </div>
          )}

          {visibleStats.length > 0 && (
            <div className={`grid gap-1.5 ${visibleStats.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {visibleStats.map(stat => (
                <div key={stat.label} className="rounded-2xl bg-white/[0.04] px-2.5 py-1.5">
                  <p className="text-[14px] font-black tabular-nums text-[#FF8A00]">
                    <Count value={stat.value} reduce={reduce} />
                  </p>
                  <p className="text-[10px] leading-tight text-white/60">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          <Link
            to="/requirements"
            className="flex h-11 w-full items-center justify-center rounded-full bg-[#FF6500] text-[13px] font-bold text-white hover:bg-[#FF8A00] sm:h-10"
          >
            View All Buyer Requirements
          </Link>
        </div>
      </aside>

      <SubscribeToContactDialog open={dialogOpen} onClose={() => setDialogOpen(false)} reason={dialogReason} />
      {respondReq && user && company && (
        <SupplierRespondDialog
          requirement={respondReq}
          open={!!respondReq}
          onClose={() => setRespondReq(null)}
          supplierId={user.id}
          supplierCompanyId={company.id}
          onResponded={() => setRespondReq(null)}
        />
      )}
    </>
  );
}

function FeaturedLead({
  req,
  animate,
  onView,
  onContact,
}: {
  req: Requirement;
  animate: boolean;
  onView: () => void;
  onContact: () => void;
}) {
  const qty = quantityOf(req);
  const place = locationOf(req);
  const posted = timeAgo(req.created_at);
  return (
    <div>
      <article
        key={req.id}
        className="max-w-full rounded-[18px] rounded-tl-[6px] bg-white px-3 py-2.5 text-[#111] shadow-sm"
        style={animate ? { animation: 'bsk-sms-in 0.35s ease' } : undefined}
      >
        <div className="flex gap-2.5">
          <button type="button" onClick={onView} className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#F3F3F3]" aria-label={`View ${req.title}`}>
            <img src={leadImage(req)} alt="" className="h-full w-full object-cover" width={112} height={112} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#FF6500]">New buy requirement</p>
            <button type="button" onClick={onView} className="mt-0.5 block w-full text-left">
              <h3 className="line-clamp-3 break-words text-[14px] font-semibold leading-snug text-[#111]">{req.title}</h3>
            </button>
          </div>
        </div>
        <div className="mt-2 space-y-0.5 text-[13px] leading-snug text-[#222]">
          {qty && <p className="break-words">Qty: {qty}</p>}
          {place && <p className="break-words">{place}</p>}
          {req.is_verified_buyer && (
            <p className="inline-flex items-center gap-1 font-medium text-[#111]">
              <BadgeCheck className="h-3.5 w-3.5 text-[#FF6500]" /> Verified buyer
            </p>
          )}
        </div>
      </article>
      {posted && <p className="mt-1 pl-1 text-[10px] text-white/50">{posted}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={onView} className="h-9 rounded-full border border-white/20 text-[12px] font-semibold text-white hover:border-[#FF6500]">
          View Requirement
        </button>
        <button type="button" onClick={onContact} className="h-9 rounded-full bg-[#FF6500] text-[12px] font-bold text-white hover:bg-[#FF8A00]">
          Contact Buyer
        </button>
      </div>
    </div>
  );
}

function MiniLead({
  req,
  depth,
  animate,
  onView,
}: {
  req: Requirement;
  depth: number;
  animate: boolean;
  onView: () => void;
}) {
  const qty = quantityOf(req);
  const place = locationOf(req);
  const posted = timeAgo(req.created_at);
  const detail = [qty, place].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={onView}
      className="flex w-full max-w-full items-end gap-2 text-left"
      style={{ animation: animate ? `bsk-sms-in 0.35s ease ${depth * 0.06}s both` : undefined }}
    >
      <span className="min-w-0 flex-1 rounded-[16px] rounded-tl-[6px] bg-[#F4F4F5] px-2.5 py-2 text-[#111]">
        <span className="flex items-center gap-2">
          <img src={leadImage(req)} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" width={64} height={64} />
          <span className="min-w-0">
            <span className="line-clamp-2 block break-words text-[12px] font-semibold leading-snug">{req.title}</span>
            {detail && <span className="mt-0.5 line-clamp-1 block break-words text-[11px] text-[#444]">{detail}</span>}
          </span>
        </span>
      </span>
      {posted && <span className="mb-1 shrink-0 text-[10px] text-white/45">{posted}</span>}
    </button>
  );
}
